// The groove format: plain JSON-serializable data the app generates its backing from, so it
// always knows the chord. Pure: no Tone, no DOM. The groove player (P1-T2) schedules from it.
//
// Time is a 16th-note step grid inside a pattern, and transport ticks (PPQ per beat) outside.
// shortcut: 4/4 and a straight-16ths grid only, no A/B sections; add a meter or a steps-per-beat
// field when a groove needs triplets or another time signature.

import { chordOf, pc, scalePcs, type HarmonyAt, type Key, type ScaleId } from '../music/harmony.ts'

/** Ticks per beat. Tone's Transport defaults to 192; the player (P1-T2) must assert it matches. */
export const PPQ = 192
export const BEATS_PER_BAR = 4
export const STEPS_PER_BEAT = 4

export type DrumVoice = 'kick' | 'snare' | 'clap' | 'hat' | 'openHat' | 'rim'

/** One chord of the progression: a Roman numeral relative to the key, for some beats. */
export interface ProgressionStep {
  rn: string
  beats: number
}

/** A hit on the step grid. */
export interface Hit {
  /** 16th-note step from the pattern start. */
  step: number
  /** In steps. */
  length: number
  /** 0..1. */
  velocity: number
}

export interface BassNote extends Hit {
  /** 1-based degree of the current chord's own scale (`degreeSemitones`); 8 is the root up an octave. */
  degree: number
  /** Octaves from the bass register; −1 drops the note an octave. Defaults to 0. */
  octave?: number
}

export interface Groove {
  id: string
  name: string
  /** BPM. */
  tempo: number
  /** 0..1: how late every second 16th lands (`stepTick`). */
  swing: number
  key: Key
  bars: number
  /** Loops on its own length, which should total bars × BEATS_PER_BAR. */
  progression: ProgressionStep[]
  /** Velocity (0..1, 0 = rest) per 16th step, per voice; each pattern loops on its length. */
  drums: Partial<Record<DrumVoice, number[]>>
  /** A looping pattern of chord-relative degrees, so it follows the changes. */
  bass: {
    steps: number
    /** MIDI note the chord root (degree 1, octave 0) sits at or above. */
    register: number
    notes: BassNote[]
  }
  chords: {
    steps: number
    /**
     * Chord-tone indexes, low to high: 0 root, 1 third, 2 fifth, 3 seventh; an index past the
     * last tone is that tone an octave up. [1, 3, 4] is the 3rd, 7th and root above.
     */
    voicing: number[]
    /** MIDI note the voicing's lowest note sits at or above. */
    register: number
    hits: Hit[]
  }
  soloScale: ScaleId
  /** The other scales the solo-scale picker offers. */
  altScales: ScaleId[]
}

/** The progression step at a transport position (unswung ticks); negative ticks wrap from the end. */
export function stepIndexAt(groove: Groove, ticks: number): number {
  const total = groove.progression.reduce((sum, c) => sum + c.beats, 0) * PPQ
  let t = ((ticks % total) + total) % total
  for (const [i, step] of groove.progression.entries()) {
    if (t < step.beats * PPQ) return i
    t -= step.beats * PPQ
  }
  return 0 // unreachable: t < total
}

/** The harmony at a transport position (unswung ticks); negative ticks wrap from the end. */
export function harmonyAt(groove: Groove, ticks: number, scale = groove.soloScale): HarmonyAt {
  const { tonic, mode } = groove.key
  const step = groove.progression[stepIndexAt(groove, ticks)]!
  const chord = chordOf(step.rn, tonic)
  return {
    keyTonic: tonic,
    keyMode: mode,
    rn: step.rn,
    chordRoot: chord.root,
    chordQuality: chord.quality,
    chordTones: chord.tones,
    soloScale: scalePcs(scale, tonic),
  }
}

/**
 * The position whose harmony the keyboard shows, from the player's groove ticks (null when
 * stopped): half a beat ahead, so a chord change shows before it sounds, and the first chord
 * when stopped and through the count-in (whose negative ticks would wrap to the last chord).
 */
export const previewTick = (ticks: number | null): number =>
  ticks === null ? 0 : Math.max(0, ticks + PPQ / 2)

/** The same groove in another key: only the tonic moves, since all harmony is relative to it. */
export const transpose = (groove: Groove, semitones: number): Groove => ({
  ...groove,
  key: { ...groove.key, tonic: pc(groove.key.tonic + semitones) },
})

/** The same groove at `factor` times its tempo; positions in ticks don't change. */
export const scaleTempo = (groove: Groove, factor: number): Groove => ({
  ...groove,
  tempo: groove.tempo * factor,
})

/**
 * Transport tick of a 16th-note step with swing: every second 16th moves later, from halfway
 * through its 8th (swing 0) to two thirds of the way (swing 1, a 2:1 triplet feel). The player
 * uses this and leaves Tone's own Transport swing at 0, so the schedule stays testable data.
 */
export function stepTick(step: number, swing: number): number {
  const eighth = PPQ / 2
  const offbeat = step % 2 === 1 ? eighth * (1 / 2 + swing / 6) : 0
  return Math.round(Math.floor(step / 2) * eighth + offbeat)
}
