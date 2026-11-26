// The grooves the app ships. Original patterns, not modelled on any song.
// shortcut: one placeholder groove so the player has something to play; P1-T3 writes the four
// real ones and replaces this.

import type { Groove } from './groove.ts'

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

export const GROOVES: readonly Groove[] = [ELECTRO_FUNK_VAMP]
