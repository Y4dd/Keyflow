// Pedal modes and bends, pure: what the pedal and the bend sources ask the instruments to do.
// No Tone, no DOM. The engine (src/audio/tone/engine.ts) applies the targets.
//
// One pedal, so its function is a mode (decisions log, 2026-11-23): Sustain holds notes, Bend
// bends up by the bend amount, Glide-hold forces glide on. Bends from every source add up and
// never pass the bend amount either way. At "to next scale tone" (P1-T5) bends count in scale
// steps, not semitones: 1 is the next solo-scale tone up, -1 the one below, and the instrument
// turns that into semitones for each note it sounds (src/music/bend.ts).

import type { InputSource } from '../input/types.ts'

export type PedalMode = 'sustain' | 'bend' | 'glideHold'

export interface ExpressionSettings {
  pedalMode: PedalMode
  /**
   * How far the pedal and the bend key bend up, and the furthest any bend goes either way:
   * semitones, or one step of the solo scale.
   */
  bendSemitones: 1 | 2 | 'scale'
  /** How long a full bend takes, ms; smaller moves take proportionally less. */
  bendTimeMs: number
}

export const DEFAULT_EXPRESSION: ExpressionSettings = {
  pedalMode: 'sustain',
  bendSemitones: 'scale',
  bendTimeMs: 100,
}

export const MAX_BEND_TIME_MS = 400

/** The full bend in the units bends count in: semitones, or 1 scale step. */
export const bendRange = (s: ExpressionSettings): number =>
  s.bendSemitones === 'scale' ? 1 : s.bendSemitones

export interface ExpressionTargets {
  sustain: boolean
  glideHold: boolean
  /** From center: semitones, or scale steps at "to next scale tone". */
  bend: number
}

export interface Expression {
  pedal(down: boolean): ExpressionTargets
  /** A source's bend, semitones from center; it replaces that source's last one. */
  bend(source: InputSource, semitones: number): ExpressionTargets
  /** A mode change with the pedal down leaves the old mode as if the pedal lifted. */
  setSettings(settings: ExpressionSettings): ExpressionTargets
  targets(): ExpressionTargets
  settings(): ExpressionSettings
}

export function createExpression(initial: ExpressionSettings): Expression {
  let settings = initial
  let pedalDown = false
  const bends: Record<InputSource, number> = { midi: 0, computer: 0, onscreen: 0, sim: 0 }

  function targets(): ExpressionTargets {
    const mode = settings.pedalMode
    const range = bendRange(settings)
    const down = (m: PedalMode) => pedalDown && mode === m
    const sum = bends.midi + bends.computer + bends.onscreen + bends.sim
    const bend = Math.min(range, Math.max(-range, sum + (down('bend') ? range : 0)))
    return { sustain: down('sustain'), glideHold: down('glideHold'), bend }
  }

  return {
    pedal(down) {
      pedalDown = down
      return targets()
    },
    bend(source, semitones) {
      bends[source] = semitones
      return targets()
    },
    setSettings(next) {
      settings = next
      return targets()
    },
    targets,
    settings: () => settings,
  }
}

/** Seconds a bend move takes: a full bend takes the bend time, smaller moves less. */
export function bendRampSeconds(from: number, to: number, settings: ExpressionSettings): number {
  return ((Math.abs(to - from) / bendRange(settings)) * settings.bendTimeMs) / 1000
}

export interface SustainLatch {
  /** Pedal down or up. On up, returns the withheld note-offs to send now, one per press. */
  hold(down: boolean): number[]
  /** True: send the note-off now. False: withheld until the pedal lifts. */
  noteOff(note: number): boolean
  /** Forgets one pitch's withheld note-offs (its voice was stolen, so they'd stop a new press). */
  forget(note: number): void
  /** Forgets withheld note-offs (after the instrument released everything itself). */
  clear(): void
}

/** Withholds note-offs while the sustain pedal is down. Per instrument. */
export function createSustainLatch(): SustainLatch {
  let down = false
  // A count, not a set: instruments ref-count pitches, so a note pressed again while
  // sustained is held twice and needs two note-offs.
  const withheld = new Uint8Array(128)

  return {
    hold(next) {
      down = next
      if (down) return []
      const notes: number[] = []
      for (let note = 0; note < 128; note++) {
        for (let i = 0; i < withheld[note]; i++) notes.push(note)
      }
      withheld.fill(0)
      return notes
    },
    noteOff(note) {
      if (!down) return true
      if (withheld[note] < 255) withheld[note]++
      return false
    },
    forget(note) {
      withheld[note] = 0
    },
    clear: () => void withheld.fill(0),
  }
}
