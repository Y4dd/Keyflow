import { describe, expect, it } from 'vitest'
import {
  bendRampSeconds,
  createExpression,
  createSustainLatch,
  DEFAULT_EXPRESSION,
  type ExpressionSettings,
} from './expression.ts'

const settings = (patch: Partial<ExpressionSettings> = {}): ExpressionSettings => ({
  ...DEFAULT_EXPRESSION,
  ...patch,
})

describe('pedal and bend targets per mode', () => {
  it('sustain: the pedal holds notes and bends nothing', () => {
    const x = createExpression(settings({ pedalMode: 'sustain' }))
    expect(x.pedal(true)).toEqual({ sustain: true, glideHold: false, bend: 0 })
    expect(x.pedal(false)).toEqual({ sustain: false, glideHold: false, bend: 0 })
  })

  it('bend: the pedal bends up by the bend amount and back on release', () => {
    const x = createExpression(settings({ pedalMode: 'bend', bendSemitones: 2 }))
    expect(x.pedal(true)).toEqual({ sustain: false, glideHold: false, bend: 2 })
    expect(x.pedal(false)).toEqual({ sustain: false, glideHold: false, bend: 0 })
    x.setSettings(settings({ pedalMode: 'bend', bendSemitones: 1 }))
    expect(x.pedal(true).bend).toBe(1)
  })

  it('glide-hold: the pedal forces glide on', () => {
    const x = createExpression(settings({ pedalMode: 'glideHold' }))
    expect(x.pedal(true)).toEqual({ sustain: false, glideHold: true, bend: 0 })
    expect(x.pedal(false)).toEqual({ sustain: false, glideHold: false, bend: 0 })
  })

  it('bend events from each source add up, and never pass the bend amount', () => {
    const x = createExpression(settings({ pedalMode: 'bend', bendSemitones: 2 }))
    expect(x.bend('computer', 1.5).bend).toBe(1.5)
    expect(x.bend('sim', -0.5).bend).toBe(1)
    expect(x.pedal(true).bend).toBe(2) // 2 + 1.5 - 0.5, clamped
    expect(x.bend('computer', -2).bend).toBe(-0.5) // pedal 2 - 2 - 0.5
    expect(x.bend('computer', -9).bend).toBe(-2)
  })

  it('a mode change with the pedal down leaves the old mode as if the pedal lifted', () => {
    const x = createExpression(settings({ pedalMode: 'sustain' }))
    x.pedal(true)
    expect(x.setSettings(settings({ pedalMode: 'bend' }))).toEqual({
      sustain: false,
      glideHold: false,
      bend: 1, // the default amount is one scale step
    })
    expect(x.setSettings(settings({ pedalMode: 'glideHold' }))).toEqual({
      sustain: false,
      glideHold: true,
      bend: 0,
    })
  })

  it('a smaller bend amount re-clamps a bend already held', () => {
    const x = createExpression(settings({ bendSemitones: 2 }))
    x.bend('computer', 2)
    expect(x.setSettings(settings({ bendSemitones: 1 })).bend).toBe(1)
  })

  it('to next scale tone: bends count in scale steps, one at most either way', () => {
    const x = createExpression(settings({ pedalMode: 'bend', bendSemitones: 'scale' }))
    expect(x.pedal(true).bend).toBe(1)
    expect(x.bend('computer', -5).bend).toBe(-1)
  })
})

describe('bendRampSeconds', () => {
  it('takes the bend time for a full bend, and proportionally less for smaller moves', () => {
    const s = settings({ bendSemitones: 2, bendTimeMs: 100 })
    expect(bendRampSeconds(0, 2, s)).toBeCloseTo(0.1)
    expect(bendRampSeconds(2, 0, s)).toBeCloseTo(0.1)
    expect(bendRampSeconds(0.5, 1, s)).toBeCloseTo(0.025)
    expect(bendRampSeconds(1, 1, s)).toBe(0)
    expect(bendRampSeconds(0, 2, settings({ bendTimeMs: 0 }))).toBe(0)
    expect(bendRampSeconds(0, 1, settings({ bendSemitones: 'scale' }))).toBeCloseTo(0.1)
  })
})

describe('sustain latch', () => {
  it('passes note-offs through while the pedal is up', () => {
    const latch = createSustainLatch()
    expect(latch.noteOff(60)).toBe(true)
  })

  it('withholds note-offs while the pedal is down and returns them on release', () => {
    const latch = createSustainLatch()
    expect(latch.hold(true)).toEqual([])
    expect(latch.noteOff(60)).toBe(false)
    expect(latch.noteOff(64)).toBe(false)
    expect(latch.hold(false)).toEqual([60, 64])
    expect(latch.hold(false)).toEqual([])
    expect(latch.noteOff(60)).toBe(true)
  })

  it('counts a pitch pressed again while sustained, so every press gets its note-off', () => {
    // The instruments ref-count pitches: a re-pressed sustained note is held twice.
    const latch = createSustainLatch()
    latch.hold(true)
    latch.noteOff(60)
    latch.noteOff(60)
    expect(latch.hold(false)).toEqual([60, 60])
  })

  it('forget drops one pitch, so a stolen sustained note can be pressed again and held', () => {
    const latch = createSustainLatch()
    latch.hold(true)
    latch.noteOff(60)
    latch.noteOff(64)
    latch.forget(60)
    expect(latch.hold(false)).toEqual([64])
  })

  it('clear forgets withheld note-offs (the instrument released everything itself)', () => {
    const latch = createSustainLatch()
    latch.hold(true)
    latch.noteOff(60)
    latch.clear()
    expect(latch.hold(false)).toEqual([])
  })
})
