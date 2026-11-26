import { describe, expect, it } from 'vitest'
import {
  BEATS_PER_BAR,
  harmonyAt,
  PPQ,
  scaleTempo,
  stepTick,
  STEPS_PER_BEAT,
  transpose,
  type Groove,
} from './groove.ts'

// An original test vamp: C minor, i7 for two bars, IV7 for two (a Dorian sound).
const vamp: Groove = {
  id: 'test-vamp',
  name: 'Test vamp',
  tempo: 108,
  swing: 0.2,
  key: { tonic: 0, mode: 'minor' },
  bars: 4,
  progression: [
    { rn: 'i7', beats: 8 },
    { rn: 'IV7', beats: 8 },
  ],
  drums: {
    kick: [1, 0, 0, 0, 0, 0, 0.8, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.3],
    hat: [0.7, 0.4, 0.6, 0.4, 0.7, 0.4, 0.6, 0.4, 0.7, 0.4, 0.6, 0.4, 0.7, 0.4, 0.6, 0.4],
  },
  bass: {
    steps: 16,
    register: 36,
    notes: [
      { step: 0, length: 3, velocity: 1, degree: 1 },
      { step: 3, length: 1, velocity: 0.7, degree: 8 },
      { step: 6, length: 2, velocity: 0.9, degree: 7, octave: -1 },
      { step: 10, length: 2, velocity: 0.9, degree: 5 },
    ],
  },
  chords: {
    steps: 16,
    voicing: [1, 3, 4],
    register: 55,
    hits: [
      { step: 2, length: 1, velocity: 0.8 },
      { step: 7, length: 2, velocity: 0.7 },
    ],
  },
  soloScale: 'minor pentatonic',
  altScales: ['dorian', 'minor blues'],
}

const beat = (n: number) => n * PPQ

describe('harmonyAt', () => {
  it('gives the chord, key and solo scale at the start', () => {
    expect(harmonyAt(vamp, 0)).toEqual({
      keyTonic: 0,
      keyMode: 'minor',
      rn: 'i7',
      chordRoot: 0,
      chordQuality: 'm7',
      chordTones: [0, 3, 7, 10],
      soloScale: [0, 3, 5, 7, 10],
    })
  })

  it('changes chord exactly on the boundary tick, not a tick early', () => {
    expect(harmonyAt(vamp, beat(8) - 1).rn).toBe('i7')
    expect(harmonyAt(vamp, beat(8)).rn).toBe('IV7')
    expect(harmonyAt(vamp, beat(8)).chordTones).toEqual([5, 9, 0, 3])
  })

  it('holds a chord across a bar line', () => {
    expect(harmonyAt(vamp, beat(BEATS_PER_BAR)).rn).toBe('i7')
    expect(harmonyAt(vamp, beat(12)).rn).toBe('IV7')
  })

  it('loops past the end, which the half-beat preview reaches near the loop point', () => {
    expect(harmonyAt(vamp, beat(16)).rn).toBe('i7')
    expect(harmonyAt(vamp, beat(15.5) + PPQ / 2).rn).toBe('i7')
    expect(harmonyAt(vamp, beat(16 * 3 + 9)).rn).toBe('IV7')
  })

  it('reads negative ticks (a count-in) as the end of the loop', () => {
    expect(harmonyAt(vamp, -1).rn).toBe('IV7')
    expect(harmonyAt(vamp, -beat(9)).rn).toBe('i7')
  })

  it('uses another solo scale when one is picked, still rooted on the key', () => {
    expect(harmonyAt(vamp, 0, 'dorian').soloScale).toEqual([0, 2, 3, 5, 7, 9, 10])
  })

  it('handles uneven chord lengths', () => {
    const g: Groove = {
      ...vamp,
      key: { tonic: 7, mode: 'major' },
      progression: [
        { rn: 'Imaj7', beats: 6 },
        { rn: 'vi7', beats: 2 },
        { rn: 'ii7', beats: 4 },
        { rn: 'V7', beats: 4 },
      ],
    }
    expect([0, 5, 6, 7, 8, 12, 15].map((b) => harmonyAt(g, beat(b)).chordRoot)).toEqual([
      7, 7, 4, 4, 9, 2, 2,
    ])
  })
})

describe('transpose', () => {
  it('moves only the key; every chord and scale follows', () => {
    const up = transpose(vamp, 3)
    expect(up.key).toEqual({ tonic: 3, mode: 'minor' })
    expect(harmonyAt(up, beat(8)).chordRoot).toBe(8)
    expect(harmonyAt(up, 0).soloScale).toEqual([3, 6, 8, 10, 1])
    expect(vamp.key.tonic).toBe(0)
  })

  it('wraps below C and past B', () => {
    expect(transpose(vamp, -1).key.tonic).toBe(11)
    expect(transpose(vamp, -13).key.tonic).toBe(11)
    expect(transpose(transpose(vamp, 7), 7).key.tonic).toBe(2)
  })
})

describe('scaleTempo', () => {
  it('scales the tempo without moving the harmony in ticks', () => {
    const fast = scaleTempo(vamp, 1.3)
    expect(fast.tempo).toBeCloseTo(140.4)
    expect(vamp.tempo).toBe(108)
    expect(harmonyAt(fast, beat(8))).toEqual(harmonyAt(vamp, beat(8)))
  })
})

describe('stepTick', () => {
  const step = PPQ / STEPS_PER_BEAT

  it('puts straight 16ths on the grid with no swing', () => {
    expect([0, 1, 2, 3, 4].map((s) => stepTick(s, 0))).toEqual([0, 48, 96, 144, 192])
  })

  it('delays every second 16th; full swing is a 2:1 triplet feel', () => {
    expect(stepTick(1, 1)).toBe(64)
    expect(stepTick(3, 1)).toBe(2 * step + 64)
    expect(stepTick(1, 0.5)).toBe(56)
  })

  it('leaves on-beat and 8th-note steps where they are', () => {
    expect(stepTick(0, 1)).toBe(0)
    expect(stepTick(2, 1)).toBe(96)
    expect(stepTick(4, 0.7)).toBe(192)
  })

  it('rounds to whole ticks', () => {
    expect(stepTick(1, 0.3)).toBe(53)
    expect(Number.isInteger(stepTick(17, 0.37))).toBe(true)
  })
})

describe('groove format', () => {
  it('survives a JSON round trip', () => {
    expect(JSON.parse(JSON.stringify(vamp))).toEqual(vamp)
  })

  it('fills its bars with the progression', () => {
    const beats = vamp.progression.reduce((sum, c) => sum + c.beats, 0)
    expect(beats).toBe(vamp.bars * BEATS_PER_BAR)
  })
})
