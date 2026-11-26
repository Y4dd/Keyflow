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

/** Driving four-on-the-floor in E minor: octave bass in 8ths, open hats and chord stabs offbeat. */
export const BOOGIE: Groove = {
  id: 'boogie',
  name: 'Boogie',
  tempo: 116,
  swing: 0.05,
  key: { tonic: 4, mode: 'minor' },
  bars: 4,
  progression: [
    { rn: 'i7', beats: 8 },
    { rn: 'iv7', beats: 8 },
  ],
  drums: {
    kick: everyBeat([1, 0, 0, 0]),
    snare: [0, 0, 0, 0, 0.7, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, 0],
    clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: everyBeat([0.5, 0.3, 0, 0.3]),
    openHat: everyBeat([0, 0, 0.6, 0]),
  },
  bass: {
    steps: 16,
    register: 28,
    notes: [
      { step: 0, length: 1, velocity: 1, degree: 1 },
      { step: 2, length: 1, velocity: 0.8, degree: 8 },
      { step: 4, length: 1, velocity: 0.95, degree: 1 },
      { step: 6, length: 1, velocity: 0.8, degree: 8 },
      { step: 8, length: 1, velocity: 0.95, degree: 1 },
      { step: 10, length: 1, velocity: 0.8, degree: 8 },
      { step: 11, length: 1, velocity: 0.65, degree: 8 },
      { step: 12, length: 1, velocity: 0.95, degree: 1 },
      { step: 14, length: 1, velocity: 0.8, degree: 8 },
      { step: 15, length: 1, velocity: 0.6, degree: 5 },
    ],
  },
  chords: {
    steps: 16,
    voicing: [1, 2, 3, 4],
    register: 57,
    hits: [
      { step: 2, length: 1, velocity: 0.6 },
      { step: 6, length: 1, velocity: 0.55 },
      { step: 10, length: 1, velocity: 0.6 },
      { step: 13, length: 2, velocity: 0.5 },
    ],
  },
  soloScale: 'minor pentatonic',
  altScales: ['minor blues'],
}

// P1-T3c audition: three R&B and neo-soul candidates for Boogie's place; the pick stays, the
// others go.

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

/** A♭ major at 96, R&B: a punchy kick with 16th doubles, clap on the backbeat, ii–V–I–vi. */
export const RNB_BOUNCE: Groove = {
  id: 'rnb-bounce',
  name: 'R&B bounce',
  tempo: 96,
  swing: 0.3,
  key: { tonic: 8, mode: 'major' },
  bars: 4,
  progression: [
    { rn: 'ii9', beats: 4 },
    { rn: 'V13', beats: 4 },
    { rn: 'Imaj9', beats: 4 },
    { rn: 'vi9', beats: 4 },
  ],
  drums: {
    kick: [1, 0, 0, 0.7, 0, 0, 0, 0, 0, 0, 1, 0.6, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    clap: [0, 0, 0, 0, 0.6, 0, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 0],
    hat: [0.7, 0.3, 0.5, 0.3, 0.7, 0.3, 0.5, 0.6, 0.7, 0.3, 0.5, 0.3, 0.7, 0.3, 0.5, 0.3],
  },
  bass: {
    steps: 16,
    register: 36,
    notes: [
      { step: 0, length: 3, velocity: 1, degree: 1 },
      { step: 3, length: 1, velocity: 0.7, degree: 1 },
      { step: 6, length: 1, velocity: 0.75, degree: 3 },
      { step: 7, length: 2, velocity: 0.8, degree: 5 },
      { step: 10, length: 1, velocity: 0.9, degree: 1 },
      { step: 11, length: 1, velocity: 0.6, degree: 1 },
      { step: 12, length: 2, velocity: 0.75, degree: 7, octave: -1 },
      { step: 14, length: 2, velocity: 0.7, degree: 5, octave: -1 },
    ],
  },
  chords: {
    steps: 16,
    voicing: [1, 3, 4],
    register: 55,
    hits: [
      { step: 2, length: 2, velocity: 0.55 },
      { step: 6, length: 1, velocity: 0.45 },
      { step: 8, length: 3, velocity: 0.5 },
      { step: 14, length: 2, velocity: 0.45 },
    ],
  },
  soloScale: 'major pentatonic',
  altScales: ['major'],
}

/** B♭ major at 88, soul R&B with a gospel turn: a deep shuffle, a walking bass, I–II7–ii–V. */
export const SUNDAY_SHUFFLE: Groove = {
  id: 'sunday-shuffle',
  name: 'Sunday shuffle',
  tempo: 88,
  swing: 0.6,
  key: { tonic: 10, mode: 'major' },
  bars: 4,
  progression: [
    { rn: 'Imaj7', beats: 4 },
    { rn: 'II7', beats: 4 },
    { rn: 'ii9', beats: 4 },
    { rn: 'V13', beats: 4 },
  ],
  drums: {
    kick: [1, 0, 0, 0.5, 0, 0, 0, 0, 0.9, 0, 0, 0.5, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0.2, 0, 0, 0, 0, 1, 0, 0, 0.2],
    hat: [0.55, 0.3, 0.45, 0.3, 0.55, 0.3, 0.45, 0.3, 0.55, 0.3, 0.45, 0.3, 0.55, 0.3, 0, 0.3],
    openHat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0],
  },
  bass: {
    steps: 16,
    register: 36,
    notes: [
      { step: 0, length: 2, velocity: 0.95, degree: 1 },
      { step: 3, length: 1, velocity: 0.6, degree: 5, octave: -1 },
      { step: 4, length: 2, velocity: 0.8, degree: 1 },
      { step: 7, length: 1, velocity: 0.6, degree: 2 },
      { step: 8, length: 2, velocity: 0.85, degree: 3 },
      { step: 11, length: 1, velocity: 0.7, degree: 5 },
      { step: 12, length: 2, velocity: 0.75, degree: 6 },
      { step: 14, length: 2, velocity: 0.7, degree: 5 },
    ],
  },
  chords: {
    steps: 16,
    voicing: [1, 3, 4],
    register: 55,
    hits: [
      { step: 0, length: 3, velocity: 0.5 },
      { step: 6, length: 2, velocity: 0.5 },
      { step: 10, length: 1, velocity: 0.4 },
      { step: 12, length: 3, velocity: 0.45 },
    ],
  },
  soloScale: 'major pentatonic',
  altScales: ['major'],
}

/** The first one opens when the app starts. */
export const GROOVES: readonly Groove[] = [
  ELECTRO_FUNK_VAMP,
  SOUL_GROOVE,
  SLOW_JAM,
  BOOGIE,
  NEO_SOUL_DRIFT,
  RNB_BOUNCE,
  SUNDAY_SHUFFLE,
]
