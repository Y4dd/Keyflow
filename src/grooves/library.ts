// The grooves the app ships. Original patterns, not modelled on any song or named after anyone.
// Bass degrees are chord-relative, so they're picked to stay in the key under every chord
// (library.test.ts checks it); chord voicings stay chord tones.

import type { Groove } from './groove.ts'

/** One beat's four 16ths, repeated for a bar. */
const everyBeat = (beat: number[]) => [...beat, ...beat, ...beat, ...beat]

export const ELECTRO_FUNK_VAMP: Groove = {
  id: 'electro-funk-vamp',
  name: 'Electro-funk vamp',
  tempo: 108,
  swing: 0.15,
  key: { tonic: 2, mode: 'minor' },
  bars: 4,
  progression: [
    { rn: 'i7', beats: 8 },
    { rn: 'IV7', beats: 8 },
  ],
  drums: {
    kick: [1, 0, 0, 0, 0, 0, 0.8, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.3],
    hat: [0.7, 0.4, 0.6, 0.4, 0.7, 0.4, 0.6, 0.4, 0.7, 0.4, 0.6, 0.4, 0.7, 0.4, 0.6, 0],
    openHat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5],
  },
  bass: {
    steps: 16,
    register: 36,
    notes: [
      { step: 0, length: 3, velocity: 1, degree: 1 },
      { step: 3, length: 1, velocity: 0.7, degree: 8 },
      { step: 6, length: 2, velocity: 0.9, degree: 7, octave: -1 },
      { step: 10, length: 2, velocity: 0.9, degree: 5 },
      { step: 14, length: 1, velocity: 0.6, degree: 4 },
    ],
  },
  chords: {
    steps: 16,
    voicing: [1, 3, 4],
    register: 57,
    hits: [
      { step: 2, length: 1, velocity: 0.75 },
      { step: 7, length: 2, velocity: 0.65 },
      { step: 12, length: 1, velocity: 0.6 },
    ],
  },
  soloScale: 'minor pentatonic',
  altScales: ['dorian', 'minor blues'],
}

/** A laid-back backbeat in E♭ major: a held chord on the one, a push into beat 3, ghost snares. */
export const SOUL_GROOVE: Groove = {
  id: 'soul-groove',
  name: 'Soul groove',
  tempo: 84,
  swing: 0.3,
  key: { tonic: 3, mode: 'major' },
  bars: 4,
  progression: [
    { rn: 'Imaj7', beats: 4 },
    { rn: 'vi7', beats: 4 },
    { rn: 'ii7', beats: 4 },
    { rn: 'V7', beats: 4 },
  ],
  drums: {
    kick: [1, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 0.9, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0.2, 0, 0, 0, 0, 1, 0, 0, 0.25],
    hat: [0.6, 0, 0.35, 0.2, 0.6, 0, 0.35, 0, 0.6, 0, 0.35, 0.2, 0.6, 0, 0.35, 0],
  },
  bass: {
    steps: 16,
    register: 36,
    notes: [
      { step: 0, length: 5, velocity: 0.95, degree: 1 },
      { step: 6, length: 1, velocity: 0.7, degree: 5, octave: -1 },
      { step: 7, length: 1, velocity: 0.8, degree: 1 },
      { step: 10, length: 2, velocity: 0.85, degree: 3 },
      { step: 12, length: 2, velocity: 0.8, degree: 5 },
      // The chord's 7th below, before the next chord.
      { step: 14, length: 2, velocity: 0.7, degree: 7, octave: -1 },
    ],
  },
  chords: {
    steps: 16,
    voicing: [1, 2, 3, 4],
    register: 55,
    hits: [
      { step: 0, length: 6, velocity: 0.55 },
      { step: 10, length: 5, velocity: 0.5 },
    ],
  },
  soloScale: 'major pentatonic',
  altScales: ['major'],
}

/** Half-time and lush in D♭ major: the snare and clap on beat 3, chords left ringing. */
export const SLOW_JAM: Groove = {
  id: 'slow-jam',
  name: 'Slow jam',
  tempo: 70,
  swing: 0.3,
  key: { tonic: 1, mode: 'major' },
  bars: 4,
  progression: [
    { rn: 'IVmaj7', beats: 4 },
    { rn: 'iii7', beats: 4 },
    { rn: 'ii7', beats: 4 },
    { rn: 'Imaj7', beats: 4 },
  ],
  drums: {
    kick: [1, 0, 0, 0.5, 0, 0, 0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0.4],
    snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    clap: [0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 0, 0, 0, 0],
    rim: [0, 0, 0, 0, 0, 0, 0.3, 0, 0, 0, 0, 0, 0, 0.25, 0, 0],
    hat: everyBeat([0.45, 0.2, 0.3, 0.2]),
  },
  bass: {
    steps: 16,
    register: 36,
    notes: [
      { step: 0, length: 6, velocity: 0.9, degree: 1 },
      { step: 6, length: 2, velocity: 0.6, degree: 5, octave: -1 },
      { step: 10, length: 3, velocity: 0.8, degree: 3 },
      { step: 14, length: 2, velocity: 0.7, degree: 5 },
    ],
  },
  chords: {
    steps: 16,
    // 3rd, 7th, root and 5th above: wide and open.
    voicing: [1, 3, 4, 6],
    register: 52,
    hits: [
      { step: 0, length: 10, velocity: 0.5 },
      { step: 10, length: 6, velocity: 0.38 },
    ],
  },
  soloScale: 'major pentatonic',
  altScales: ['major'],
}

/** F minor at 80, neo-soul: heavily swung 16ths, a lazy kick, rootless ninth chords left ringing. */
export const NEO_SOUL_DRIFT: Groove = {
  id: 'neo-soul-drift',
  name: 'Neo-soul drift',
  tempo: 80,
  swing: 0.5,
  key: { tonic: 5, mode: 'minor' },
  bars: 4,
  progression: [
    { rn: 'i9', beats: 4 },
    { rn: 'iv9', beats: 4 },
    { rn: 'bVImaj7', beats: 4 },
    { rn: 'bVII9', beats: 4 },
  ],
  drums: {
    kick: [1, 0, 0, 0, 0, 0, 0, 0.55, 0, 0, 0.8, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 0.85, 0, 0, 0, 0, 0, 0, 0, 0.85, 0, 0, 0.2],
    rim: [0, 0, 0.2, 0, 0, 0, 0, 0, 0, 0.2, 0, 0, 0, 0, 0, 0],
    hat: everyBeat([0.5, 0.25, 0.4, 0.2]),
  },
  bass: {
    steps: 16,
    register: 36,
    notes: [
      { step: 0, length: 5, velocity: 0.95, degree: 1 },
      { step: 6, length: 1, velocity: 0.6, degree: 5, octave: -1 },
      { step: 7, length: 2, velocity: 0.7, degree: 7, octave: -1 },
      { step: 10, length: 2, velocity: 0.8, degree: 1 },
      { step: 12, length: 2, velocity: 0.75, degree: 3 },
      // A step down from the 3rd before the next chord.
      { step: 14, length: 2, velocity: 0.65, degree: 2 },
    ],
  },
  chords: {
    steps: 16,
    // 3rd, 7th and 9th on the ninth chords: rootless, the bass has the root.
    voicing: [1, 3, 4],
    register: 53,
    hits: [
      { step: 2, length: 6, velocity: 0.5 },
      { step: 10, length: 4, velocity: 0.42 },
      { step: 15, length: 1, velocity: 0.35 },
    ],
  },
  soloScale: 'minor pentatonic',
  altScales: ['dorian', 'minor blues'],
}

/** The first one opens when the app starts. */
export const GROOVES: readonly Groove[] = [ELECTRO_FUNK_VAMP, SOUL_GROOVE, SLOW_JAM, NEO_SOUL_DRIFT]
