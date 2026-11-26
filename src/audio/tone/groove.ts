// The groove player: the pure schedule (src/grooves/schedule.ts) on Tone's Transport. Drums,
// bass (Round Bass) and chords (EP Keys) play at the transport callbacks' times, never
// through the live input path.
//
// Transport ticks start at 0 with the count-in bar, when there is one; groove ticks are
// transport ticks minus it, so the count-in is groove bar −1 (harmonyAt's negative ticks).
// Each bar is scheduled half a bar before it starts: far enough ahead of the look-ahead, and a
// key change made in the first half of a bar reaches the next one.

import * as Tone from 'tone'
import { PPQ, transpose, type Groove } from '../../grooves/groove.ts'
import { BAR_TICKS, barEvents, countInEvents, type GrooveEvent } from '../../grooves/schedule.ts'
import type { PresetId } from '../presets/types.ts'
import { createDrumKit } from './drums.ts'
import type { Instrument } from './instrument.ts'

/** The grooves' bass: clean, so it sits under a lead (P1-T3b). */
export const GROOVE_BASS: PresetId = 'round-bass'

export interface GrooveSettings {
  groove: Groove
  /** Key tonic, pitch class; the groove is transposed to it. */
  tonic: number
  bpm: number
  /** Plays on until stopped; off, it ends after the groove's bars. */
  loop: boolean
  countIn: boolean
}

export interface GroovePlayer {
  /** Starts from the top (after a stop, if it was playing). Calls `onEnd` if it ends by itself. */
  play(settings: GrooveSettings, onEnd: () => void): void
  /** Key, tempo and loop changes while playing; the count-in applies from the next play. */
  update(settings: GrooveSettings): void
  stop(): void
  /** Groove ticks at the audio clock now (negative in the count-in); null when stopped. */
  ticks(): number | null
  heldCount(): number
}

export function createGroovePlayer(options: {
  bass: Instrument
  chords: Instrument
  destination: Tone.InputNode
  /** The transport starts at `time`: line tempo-synced LFOs up with it. */
  onStart(time: number): void
}): GroovePlayer {
  const transport = Tone.getTransport()
  // The schedule's ticks assume Tone's default PPQ.
  if (transport.PPQ !== PPQ) throw new Error(`Transport PPQ is ${transport.PPQ}, not ${PPQ}`)
  transport.swing = 0 // swing is in the schedule (stepTick)
  const context = Tone.getContext()
  const drums = createDrumKit(options.destination)
  const parts = { bass: options.bass, chords: options.chords }
  // The pitch each sounding note started at, by event id, so its off ends that pitch even after
  // a key change.
  const sounding = new Map<string, number>()
  const ids = new Set<number>()
  let settings: GrooveSettings | null = null
  let groove: Groove | null = null
  let offset = 0
  let nextBar = 0
  let ended: (() => void) | null = null

  function fire(e: GrooveEvent, time: number) {
    // A throw here would make the Transport drop the rest of its tick window, note-offs
    // included, and leave notes stuck; one lost event is the smaller harm.
    try {
      send(e, time)
    } catch (err) {
      console.error('Groove event failed', err)
    }
  }

  function send(e: GrooveEvent, time: number) {
    switch (e.kind) {
      case 'drum':
        drums.hit(e.voice, e.velocity, time)
        break
      case 'click':
        drums.click(e.accent, time)
        break
      case 'on':
        sounding.set(e.id, e.note)
        parts[e.part].noteOn(e.note, e.velocity, time)
        break
      case 'off': {
        const note = sounding.get(e.id)
        if (note === undefined) break
        sounding.delete(e.id)
        parts[e.part].noteOff(note, time)
        break
      }
    }
  }

  const once = (fn: (time: number) => void, tick: number) => {
    const id = transport.scheduleOnce((time) => {
      ids.delete(id)
      fn(time)
    }, `${tick}i`)
    ids.add(id)
  }

  /** Schedules groove bar `bar` (−1 is the count-in). */
  function scheduleBar(bar: number) {
    if (!groove) return
    // At the end of each pass, Loop off (as it is then) ends the groove before the next bar's
    // events at that tick, which the end clears.
    if (bar > 0 && bar % groove.bars === 0) {
      once(
        (time) => {
          if (settings && !settings.loop) end(time)
        },
        bar * BAR_TICKS + offset,
      )
    }
    const events = bar < 0 ? countInEvents() : barEvents(groove, bar)
    for (const e of events) once((time) => fire(e, time), e.tick + offset)
  }

  function apply(next: GrooveSettings) {
    settings = next
    groove = transpose(next.groove, next.tonic - next.groove.key.tonic)
    transport.bpm.value = next.bpm
  }

  /** Stops at `time`, releasing every groove note then (and any scheduled up to it). */
  function halt(time: number) {
    // Only the player's own events: nothing else uses the transport yet, but it's shared.
    for (const id of ids) transport.clear(id)
    ids.clear()
    transport.stop(time)
    for (const part of Object.values(parts)) part.releaseAll(time)
    sounding.clear()
    settings = null
    groove = null
  }

  function end(time: number) {
    const done = ended
    ended = null
    halt(time)
    done?.()
  }

  function stop() {
    if (!settings) return
    ended = null
    // Everything the transport already handed to the instruments starts within one look-ahead.
    halt(Tone.immediate() + context.lookAhead)
  }

  return {
    play(next, onEnd) {
      stop()
      apply(next)
      ended = onEnd
      offset = next.countIn ? BAR_TICKS : 0
      nextBar = next.countIn ? -1 : 0
      scheduleBar(nextBar++)
      // Each bar's events go in half a bar before it starts.
      ids.add(
        transport.scheduleRepeat(
          () => scheduleBar(nextBar++),
          `${BAR_TICKS}i`,
          `${BAR_TICKS / 2}i`,
        ),
      )
      // One look-ahead out: the Clock runs ticks from where it last got to, which is up to a
      // look-ahead past the audio clock, so an earlier start would skip tick 0.
      const start = Tone.immediate() + context.lookAhead
      transport.start(start)
      options.onStart(start)
    },
    update(next) {
      if (settings) apply({ ...next, countIn: settings.countIn })
    },
    stop,
    ticks: () => (settings ? transport.getTicksAtTime(Tone.immediate()) - offset : null),
    heldCount: () => options.bass.heldCount() + options.chords.heldCount(),
  }
}
