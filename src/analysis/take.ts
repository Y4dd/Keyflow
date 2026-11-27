// A take: what you played over a groove, saved to the Dexie `takes` table (src/storage/db.ts).
// Pure: no DOM, no Tone, no React.
//
// Events are timed in ms (`at`) from the transport's start as heard (the count-in's first click
// when there is one), mapped with the same clock pairing as calibration (contextToPerfMs). A
// take keeps one groove, key and tempo (the Groove card locks them while recording), so a
// transport position is `tickAt(take, at)`. Replay feeds the events back through the simulated
// source (SimPlayer.play(events, start)): a take's events are SimEvents with `at` always set.
//
// shortcut: assumes the audio and performance clocks don't drift apart over a take (unmeasured);
// re-pair the clocks per bar if long takes drift from the groove on replay.

import { Midi } from '@tonejs/midi'
import { PPQ } from '../grooves/groove.ts'
import { BAR_TICKS } from '../grooves/schedule.ts'
import { SCALE_IDS, type ScaleId } from '../music/harmony.ts'
import type { InputEvent } from '../input/types.ts'

/** Bumped when the stored shape changes, with a migration (CLAUDE.md: never break user data). */
export const TAKE_FORMAT = 1

/** An input event without its source, timed from the take's start. */
export type TakeEvent =
  | { kind: 'noteOn'; note: number; velocity: number; at: number }
  | { kind: 'noteOff'; note: number; at: number }
  | { kind: 'pedal'; down: boolean; at: number }
  | { kind: 'bend'; semitones: number; at: number }

export interface Take {
  format: typeof TAKE_FORMAT
  /** Epoch ms. */
  createdAt: number
  grooveId: string
  /** Key tonic, pitch class. */
  tonic: number
  bpm: number
  scale: ScaleId
  countIn: boolean
  /** ms from the start to where recording stopped. */
  lengthMs: number
  /** Sorted by `at`; every note and the pedal end up released, and a bend back at 0. */
  events: TakeEvent[]
  /**
   * The calibration offset in use when recorded (ms, positive = you land late) with the clock
   * lead it was measured under, and the clock mapping's getOutputTimestamp lead when this take
   * was recorded (src/audio/latency.ts; null = the fallback pair), so grading (P1-T8 and later)
   * can line notes up with the beat the way calibration measured it.
   */
  offsetMs: number | null
  offsetLeadMs: number | null
  leadMs: number | null
}

/** On the 0.001 ms grid, so a replay re-recorded gives back the same numbers. */
const grid = (ms: number) => Math.round(ms * 1000) / 1000

/**
 * Collects input events into take events from `origin` (performance ms of the transport start).
 * A press before the origin (in the look-ahead after Record) counts from 0; a release of a key
 * held from before recording is dropped. A key pressed twice before its release (the same key
 * on two MIDI channels, or from MIDI and the computer keys) counts presses like the zone router:
 * one note-on at the first press, one note-off at the last release, so a replay can't strand it.
 * `finish` releases whatever is still down.
 * shortcut: bends from different sources (bend key, wheel) are stored as one value each and
 * replay as one source, so two at once replay as the later; store the source if that matters.
 */
export function createTakeRecorder(origin: number) {
  const events: TakeEvent[] = []
  const held = new Map<number, number>() // note → presses not yet released
  let pedal = false
  let bend = 0
  let done = false
  const at = (time: number) => Math.max(0, grid(time - origin))

  return {
    add(e: InputEvent) {
      if (done) return
      switch (e.kind) {
        case 'noteOn': {
          const presses = held.get(e.note) ?? 0
          held.set(e.note, presses + 1)
          if (presses === 0)
            events.push({ kind: 'noteOn', note: e.note, velocity: e.velocity, at: at(e.time) })
          break
        }
        case 'noteOff': {
          const presses = held.get(e.note)
          if (presses === undefined) break
          if (presses > 1) held.set(e.note, presses - 1)
          else {
            held.delete(e.note)
            events.push({ kind: 'noteOff', note: e.note, at: at(e.time) })
          }
          break
        }
        case 'pedal':
          pedal = e.down
          events.push({ kind: 'pedal', down: e.down, at: at(e.time) })
          break
        case 'bend':
          bend = e.semitones
          events.push({ kind: 'bend', semitones: e.semitones, at: at(e.time) })
          break
      }
    },
    /** Ends the take at `end` (performance ms). */
    finish(end: number): { events: TakeEvent[]; lengthMs: number } {
      if (!done) {
        done = true
        const last = Math.max(at(end), events.at(-1)?.at ?? 0)
        for (const note of held.keys()) events.push({ kind: 'noteOff', note, at: last })
        if (pedal) events.push({ kind: 'pedal', down: false, at: last })
        if (bend !== 0) events.push({ kind: 'bend', semitones: 0, at: last })
        held.clear()
        events.sort((a, b) => a.at - b.at) // stable: same-time events keep their order
      }
      return { events, lengthMs: Math.max(at(end), events.at(-1)?.at ?? 0) }
    },
  }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isNote = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 127

function parseEvent(raw: unknown): TakeEvent | null {
  if (typeof raw !== 'object' || raw === null) return null
  const e = raw as Record<string, unknown>
  if (!isNum(e.at) || e.at < 0) return null
  const at = e.at
  switch (e.kind) {
    case 'noteOn':
      return isNote(e.note) && isNum(e.velocity) && e.velocity > 0 && e.velocity <= 1
        ? { kind: 'noteOn', note: e.note as number, velocity: e.velocity, at }
        : null
    case 'noteOff':
      return isNote(e.note) ? { kind: 'noteOff', note: e.note as number, at } : null
    case 'pedal':
      return typeof e.down === 'boolean' ? { kind: 'pedal', down: e.down, at } : null
    case 'bend':
      return isNum(e.semitones) ? { kind: 'bend', semitones: e.semitones, at } : null
    default:
      return null
  }
}

/**
 * A stored take, checked (IndexedDB may hold an older or damaged one): null if its header can't
 * be read; events that can't be read are dropped one at a time.
 */
export function parseTake(raw: unknown): Take | null {
  if (typeof raw !== 'object' || raw === null) return null
  const t = raw as Record<string, unknown>
  const nullableNum = (v: unknown) => v === null || isNum(v)
  if (
    t.format !== TAKE_FORMAT ||
    !isNum(t.createdAt) ||
    typeof t.grooveId !== 'string' ||
    !Number.isInteger(t.tonic) ||
    (t.tonic as number) < 0 ||
    (t.tonic as number) > 11 ||
    !isNum(t.bpm) ||
    t.bpm <= 0 ||
    !SCALE_IDS.includes(t.scale as ScaleId) ||
    typeof t.countIn !== 'boolean' ||
    !isNum(t.lengthMs) ||
    t.lengthMs < 0 ||
    !Array.isArray(t.events) ||
    !nullableNum(t.offsetMs) ||
    !nullableNum(t.offsetLeadMs ?? null) ||
    !nullableNum(t.leadMs)
  )
    return null
  return {
    format: TAKE_FORMAT,
    createdAt: t.createdAt,
    grooveId: t.grooveId,
    tonic: t.tonic as number,
    bpm: t.bpm,
    scale: t.scale as ScaleId,
    countIn: t.countIn,
    lengthMs: t.lengthMs,
    events: t.events.map(parseEvent).filter((e) => e !== null),
    offsetMs: t.offsetMs as number | null,
    // Takes recorded in the first P1-T7 build (2026-11-26) don't have it.
    offsetLeadMs: (t.offsetLeadMs ?? null) as number | null,
    leadMs: t.leadMs as number | null,
  }
}

/** A key press as a bar: pressed at `start`, released at `end` (ms from the take's start). */
export interface TakeNote {
  note: number
  velocity: number
  start: number
  end: number
}

/**
 * The keys pressed, in press order. A key pressed again before its release ends there; one never
 * released ends with the take. The pedal isn't applied: these are presses, not sounding notes.
 */
export function takeNotes(take: Take): TakeNote[] {
  const notes: TakeNote[] = []
  const open = new Map<number, TakeNote>()
  for (const e of take.events) {
    if (e.kind !== 'noteOn' && e.kind !== 'noteOff') continue
    const was = open.get(e.note)
    if (was) {
      was.end = e.at
      open.delete(e.note)
    }
    if (e.kind === 'noteOn') {
      const n = { note: e.note, velocity: e.velocity, start: e.at, end: take.lengthMs }
      notes.push(n)
      open.set(e.note, n)
    }
  }
  return notes
}

/** Transport ticks at `ms` into a take (the count-in bar included). */
const transportTicks = (take: Take, ms: number) => (ms / 60_000) * take.bpm * PPQ

/** Groove ticks at `ms` into a take: negative in the count-in, as harmonyAt takes them. */
export const tickAt = (take: Take, ms: number): number =>
  transportTicks(take, ms) - (take.countIn ? BAR_TICKS : 0)

/**
 * The take as a Standard MIDI File: one track of the keys pressed, at the take's tempo. Time 0
 * is the take's start, so with a count-in the file's first bar is the count-in and a pickup
 * played in it keeps its place. Keys as pressed (zone octave shifts aren't applied, and only
 * move whole octaves).
 * shortcut: notes only, no pedal or bends (the pedal may have been a bend, which the take
 * doesn't record); add CC64 and pitch bend once the take stores the pedal mode.
 */
export function takeToMidi(take: Take): Uint8Array<ArrayBuffer> {
  const midi = new Midi()
  midi.header.setTempo(take.bpm)
  const track = midi.addTrack()
  track.name = 'Keyflow take'
  const ticks = (ms: number) => Math.round((transportTicks(take, ms) * midi.header.ppq) / PPQ)
  for (const n of takeNotes(take)) {
    const start = ticks(n.start)
    track.addNote({
      midi: n.note,
      ticks: start,
      durationTicks: Math.max(1, ticks(n.end) - start),
      velocity: n.velocity,
    })
  }
  return new Uint8Array(midi.toArray()) // ArrayBuffer-backed, as Blob takes it
}
