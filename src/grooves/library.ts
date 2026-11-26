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

// P1-T3c audition: three funk candidates for Boogie's place; the pick stays, the others go.

/** A minor at 100: a ghost-note snare and a busy 16th bass with octave pops, i7 to IV9. */
export const GHOST_NOTE_POCKET: Groove = {
  id: 'ghost-note-pocket',
  name: 'Ghost-note pocket',
  tempo: 100,
  swing: 0.12,
  key: { tonic: 9, mode: 'minor' },
  bars: 4,
  progression: [
    { rn: 'i7', beats: 8 },
    { rn: 'IV9', beats: 8 },
  ],
  drums: {
    kick: [1, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, 1, 0, 0, 0, 0, 0.5],
    snare: [0, 0, 0, 0, 1, 0, 0, 0.22, 0, 0.18, 0, 0, 1, 0, 0, 0.25],
    hat: [0.8, 0.3, 0.55, 0.3, 0.8, 0.3, 0.55, 0.3, 0.8, 0.3, 0.55, 0.3, 0.8, 0.3, 0, 0.3],
    openHat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.45, 0],
  },
  bass: {
    steps: 16,
    register: 36,
    notes: [
      { step: 0, length: 2, velocity: 1, degree: 1 },
      { step: 3, length: 1, velocity: 0.8, degree: 8 },
      { step: 4, length: 1, velocity: 0.3, degree: 1 },
      { step: 6, length: 1, velocity: 0.85, degree: 5, octave: -1 },
      { step: 7, length: 1, velocity: 0.7, degree: 7, octave: -1 },
      { step: 8, length: 1, velocity: 0.95, degree: 1 },
      { step: 10, length: 1, velocity: 0.8, degree: 8 },
      { step: 11, length: 1, velocity: 0.3, degree: 8 },
      { step: 12, length: 1, velocity: 0.8, degree: 3 },
      { step: 13, length: 1, velocity: 0.75, degree: 4 },
      { step: 14, length: 2, velocity: 0.85, degree: 5 },
    ],
  },
  chords: {
    steps: 16,
    voicing: [1, 3, 4],
    register: 57,
    hits: [
      { step: 2, length: 1, velocity: 0.6 },
      { step: 5, length: 1, velocity: 0.45 },
      { step: 9, length: 1, velocity: 0.55 },
      { step: 14, length: 1, velocity: 0.5 },
    ],
  },
  soloScale: 'minor pentatonic',
  altScales: ['dorian', 'minor blues'],
}

/** G minor at 112: a two-bar slap-feel bass, low thumb notes and popped octaves with ghost notes. */
export const SLAP_AND_POP: Groove = {
  id: 'slap-and-pop',
  name: 'Slap and pop',
  tempo: 112,
  swing: 0.05,
  key: { tonic: 7, mode: 'minor' },
  bars: 4,
  progression: [
    { rn: 'i7', beats: 12 },
    { rn: 'IV7', beats: 4 },
  ],
  drums: {
    kick: [1, 0, 0, 0, 0, 0, 0.8, 0, 0, 0, 0.9, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0.2, 1, 0, 0, 0],
    rim: [0, 0, 0, 0, 0, 0, 0, 0.3, 0, 0, 0, 0, 0, 0, 0, 0.3],
    hat: [0.75, 0, 0.5, 0.2, 0.75, 0, 0.5, 0.2, 0.75, 0, 0.5, 0.2, 0.75, 0, 0, 0.2],
    openHat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0],
  },
  bass: {
    steps: 32,
    register: 36,
    notes: [
      { step: 0, length: 1, velocity: 1, degree: 1 },
      { step: 2, length: 1, velocity: 0.85, degree: 8 },
      { step: 3, length: 1, velocity: 0.3, degree: 8 },
      { step: 5, length: 1, velocity: 0.8, degree: 8 },
      { step: 6, length: 1, velocity: 0.8, degree: 7 },
      { step: 8, length: 1, velocity: 0.95, degree: 1 },
      { step: 10, length: 1, velocity: 0.3, degree: 1 },
      { step: 11, length: 1, velocity: 0.85, degree: 8 },
      { step: 13, length: 1, velocity: 0.75, degree: 5 },
      { step: 14, length: 1, velocity: 0.7, degree: 7, octave: -1 },
      { step: 16, length: 1, velocity: 1, degree: 1 },
      { step: 18, length: 1, velocity: 0.85, degree: 8 },
      { step: 19, length: 1, velocity: 0.3, degree: 8 },
      { step: 21, length: 1, velocity: 0.8, degree: 8 },
      { step: 22, length: 1, velocity: 0.75, degree: 5 },
      { step: 24, length: 1, velocity: 0.9, degree: 3 },
      { step: 25, length: 1, velocity: 0.7, degree: 4 },
      { step: 26, length: 1, velocity: 0.8, degree: 5 },
      { step: 28, length: 1, velocity: 0.85, degree: 8 },
      { step: 29, length: 1, velocity: 0.3, degree: 8 },
      { step: 30, length: 2, velocity: 0.8, degree: 7 },
    ],
  },
  chords: {
    steps: 16,
    voicing: [1, 2, 3],
    register: 57,
    hits: [
      { step: 4, length: 1, velocity: 0.6 },
      { step: 7, length: 1, velocity: 0.45 },
      { step: 12, length: 1, velocity: 0.6 },
      { step: 15, length: 1, velocity: 0.45 },
    ],
  },
  soloScale: 'minor pentatonic',
  altScales: ['dorian', 'minor blues'],
}

/** F at 94, laid back: two dominant chords, a bass walking up the chord, rim ghosts. */
export const DOMINANT_STRUT: Groove = {
  id: 'dominant-strut',
  name: 'Dominant strut',
  tempo: 94,
  swing: 0.25,
  key: { tonic: 5, mode: 'major' },
  bars: 4,
  progression: [
    { rn: 'I7', beats: 8 },
    { rn: 'IV7', beats: 8 },
  ],
  drums: {
    kick: [1, 0, 0, 0.6, 0, 0, 0, 0, 0, 0, 0.85, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    rim: [0, 0, 0, 0, 0, 0, 0.25, 0, 0, 0.2, 0, 0, 0, 0, 0, 0.25],
    hat: everyBeat([0.6, 0.2, 0.45, 0.25]),
  },
  bass: {
    steps: 16,
    register: 36,
    notes: [
      { step: 0, length: 3, velocity: 1, degree: 1 },
      { step: 3, length: 1, velocity: 0.7, degree: 3 },
      { step: 4, length: 2, velocity: 0.85, degree: 5 },
      { step: 6, length: 1, velocity: 0.35, degree: 5 },
      { step: 7, length: 1, velocity: 0.75, degree: 6 },
      { step: 8, length: 2, velocity: 0.9, degree: 7 },
      { step: 10, length: 1, velocity: 0.85, degree: 8 },
      { step: 13, length: 1, velocity: 0.75, degree: 7 },
      { step: 14, length: 2, velocity: 0.8, degree: 5 },
    ],
  },
  chords: {
    steps: 16,
    voicing: [1, 3, 4],
    register: 57,
    hits: [
      { step: 2, length: 2, velocity: 0.55 },
      { step: 6, length: 1, velocity: 0.45 },
      { step: 10, length: 2, velocity: 0.55 },
      { step: 15, length: 1, velocity: 0.4 },
    ],
  },
  soloScale: 'minor pentatonic',
  altScales: ['minor blues', 'mixolydian'],
}

/** The first one opens when the app starts. */
export const GROOVES: readonly Groove[] = [
  ELECTRO_FUNK_VAMP,
  SOUL_GROOVE,
  SLOW_JAM,
  BOOGIE,
  GHOST_NOTE_POCKET,
  SLAP_AND_POP,
  DOMINANT_STRUT,
]
