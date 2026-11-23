// Scripted input for tests and dev tools. Pure: no DOM, no timers.

import type { InputEvent } from '../types.ts'

/**
 * A simulated event: an InputEvent without `source` and `time`, timed by `at`, in ms from the
 * start of playback (default 0). Velocity is 0..1 (default DEFAULT_SIM_VELOCITY).
 */
export type SimEvent =
  | { kind: 'noteOn'; note: number; velocity?: number; at?: number }
  | { kind: 'noteOff'; note: number; at?: number }
  | { kind: 'pedal'; down: boolean; at?: number }
  | { kind: 'bend'; semitones: number; at?: number }

export const DEFAULT_SIM_VELOCITY = 0.8

export interface ChordOptions {
  /** Start offset in ms. Default 0. */
  at?: number
  /** Release after this many ms. Omitted: the notes stay held. */
  holdMs?: number
  velocity?: number
}

/** All notes on at once, e.g. chord([52, 55, 59], { holdMs: 500 }) for an E minor triad. */
export function chord(notes: readonly number[], options: ChordOptions = {}): SimEvent[] {
  const at = options.at ?? 0
  const events: SimEvent[] = notes.map((note) => ({
    kind: 'noteOn',
    note,
    velocity: options.velocity,
    at,
  }))
  if (options.holdMs !== undefined) {
    const off = at + options.holdMs
    for (const note of notes) events.push({ kind: 'noteOff', note, at: off })
  }
  return events
}

export interface SequenceOptions {
  at?: number
  /** Time between note starts. */
  stepMs: number
  /** How long each note is held. Default: stepMs (each off lands with the next on). */
  gateMs?: number
  velocity?: number
}

/** One note after another, e.g. a scale run. */
export function sequence(notes: readonly number[], options: SequenceOptions): SimEvent[] {
  const start = options.at ?? 0
  const gate = options.gateMs ?? options.stepMs
  return notes.flatMap((note, i): SimEvent[] => {
    const at = start + i * options.stepMs
    return [
      { kind: 'noteOn', note, velocity: options.velocity, at },
      { kind: 'noteOff', note, at: at + gate },
    ]
  })
}

function check(ok: boolean, message: string) {
  if (!ok) throw new Error(`Invalid sim event: ${message}`)
}

function checkNote(note: number) {
  check(Number.isInteger(note) && note >= 0 && note <= 127, `note must be 0..127 (got ${note})`)
}

/** Converts one SimEvent to an InputEvent at `startTime + at`. Throws on invalid input. */
export function toInputEvent(event: SimEvent, startTime: number): InputEvent {
  const at = event.at ?? 0
  check(Number.isFinite(at) && at >= 0, `at must be a number >= 0 (got ${String(at)})`)
  const time = startTime + at
  switch (event.kind) {
    case 'noteOn': {
      const velocity = event.velocity ?? DEFAULT_SIM_VELOCITY
      checkNote(event.note)
      check(
        Number.isFinite(velocity) && velocity > 0 && velocity <= 1,
        `velocity must be in (0, 1] (got ${String(velocity)})`,
      )
      return { kind: 'noteOn', note: event.note, velocity, time, source: 'sim' }
    }
    case 'noteOff':
      checkNote(event.note)
      return { kind: 'noteOff', note: event.note, time, source: 'sim' }
    case 'pedal':
      check(typeof event.down === 'boolean', 'pedal needs down: true or false')
      return { kind: 'pedal', down: event.down, time, source: 'sim' }
    case 'bend':
      check(Number.isFinite(event.semitones), 'bend needs a numeric semitones')
      return { kind: 'bend', semitones: event.semitones, time, source: 'sim' }
    default:
      throw new Error(
        `Invalid sim event: unknown kind ${JSON.stringify((event as { kind?: unknown }).kind)}`,
      )
  }
}
