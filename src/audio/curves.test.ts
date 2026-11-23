import { describe, expect, it } from 'vitest'
import {
  dbToGain,
  fmIndex,
  knobToPosition,
  midiToHz,
  positionToKnob,
  safetyClip,
  velocityToGain,
} from './curves.ts'

describe('midiToHz', () => {
  it('is equal-tempered around A4 = 440 Hz', () => {
    expect(midiToHz(69)).toBe(440)
    expect(midiToHz(81)).toBe(880)
    expect(midiToHz(60)).toBeCloseTo(261.626, 3)
    expect(midiToHz(36)).toBeCloseTo(65.406, 3)
  })
})

describe('velocityToGain', () => {
  it('maps full velocity to 0 dB and velocity 0 to -rangeDb', () => {
    expect(velocityToGain(1, 24)).toBe(1)
    expect(velocityToGain(0, 24)).toBeCloseTo(dbToGain(-24))
    expect(velocityToGain(0.5, 24)).toBeCloseTo(dbToGain(-12))
  })

  it('rises with velocity and clamps out-of-range input', () => {
    expect(velocityToGain(0.3, 12)).toBeLessThan(velocityToGain(0.6, 12))
    expect(velocityToGain(2, 12)).toBe(1)
    expect(velocityToGain(-1, 12)).toBeCloseTo(dbToGain(-12))
  })

  it('makes the YPT-380 range audible: velocity 20 vs 79 of 127 differs by >= 8 dB on EP', () => {
    const ratioDb = 20 * Math.log10(velocityToGain(79 / 127, 18) / velocityToGain(20 / 127, 18))
    expect(ratioDb).toBeGreaterThanOrEqual(8)
  })
})

describe('safetyClip', () => {
  it('is exactly linear below the knee', () => {
    for (const x of [0, 0.1, -0.5, 0.9, -0.9]) expect(safetyClip(x)).toBe(x)
  })

  it('bends smoothly above it and stays below full scale', () => {
    expect(safetyClip(0.95)).toBeGreaterThan(0.9)
    expect(safetyClip(0.95)).toBeLessThan(0.95)
    expect(safetyClip(1)).toBeCloseTo(0.976, 3)
    expect(safetyClip(-1)).toBeCloseTo(-0.976, 3)
    expect(safetyClip(1.5)).toBeLessThan(1)
    // Monotonic: louder in never comes out quieter.
    let last = 0
    for (let x = 0; x <= 1; x += 0.01) {
      expect(safetyClip(x)).toBeGreaterThanOrEqual(last)
      last = safetyClip(x)
    }
  })
})

describe('fmIndex', () => {
  it('is brighter for harder notes and for more brightness', () => {
    expect(fmIndex(1, 0.5)).toBeGreaterThan(fmIndex(0.3, 0.5))
    expect(fmIndex(0.5, 1)).toBeGreaterThan(fmIndex(0.5, 0))
    expect(fmIndex(0, 0)).toBeGreaterThan(0)
  })
})

describe('knob position mapping', () => {
  it('round-trips linear and log knobs', () => {
    for (const curve of ['linear', 'log'] as const) {
      for (const v of [200, 1000, 6000]) {
        const p = knobToPosition(v, 200, 6000, curve)
        expect(positionToKnob(p, 200, 6000, curve)).toBeCloseTo(v, 6)
      }
    }
  })

  it('log knobs put each octave at an equal distance', () => {
    expect(knobToPosition(400, 100, 1600, 'log')).toBeCloseTo(0.5)
    expect(positionToKnob(0.25, 100, 1600, 'log')).toBeCloseTo(200)
  })

  it('clamps', () => {
    expect(knobToPosition(10, 100, 1600, 'log')).toBe(0)
    expect(knobToPosition(5, 0, 1, 'linear')).toBe(1)
    expect(positionToKnob(2, 0, 0.3, 'linear')).toBeCloseTo(0.3)
  })
})
