import { describe, expect, it } from 'vitest'
import { chord, DEFAULT_SIM_VELOCITY, sequence, toInputEvent } from './script.ts'

describe('chord', () => {
  it('holds the notes when no holdMs is given', () => {
    expect(chord([52, 55, 59])).toEqual([
      { kind: 'noteOn', note: 52, velocity: undefined, at: 0 },
      { kind: 'noteOn', note: 55, velocity: undefined, at: 0 },
      { kind: 'noteOn', note: 59, velocity: undefined, at: 0 },
    ])
  })

  it('releases every note after holdMs, from the start offset', () => {
    const events = chord([60, 64], { at: 100, holdMs: 500, velocity: 0.5 })
    expect(events.filter((e) => e.kind === 'noteOff')).toEqual([
      { kind: 'noteOff', note: 60, at: 600 },
      { kind: 'noteOff', note: 64, at: 600 },
    ])
    expect(events[0]).toEqual({ kind: 'noteOn', note: 60, velocity: 0.5, at: 100 })
  })
})

describe('sequence', () => {
  it('spaces notes by stepMs and defaults the gate to the step', () => {
    expect(sequence([60, 62], { stepMs: 250 })).toEqual([
      { kind: 'noteOn', note: 60, velocity: undefined, at: 0 },
      { kind: 'noteOff', note: 60, at: 250 },
      { kind: 'noteOn', note: 62, velocity: undefined, at: 250 },
      { kind: 'noteOff', note: 62, at: 500 },
    ])
  })

  it('uses gateMs for shorter notes', () => {
    const events = sequence([60], { at: 10, stepMs: 250, gateMs: 100 })
    expect(events[1]).toEqual({ kind: 'noteOff', note: 60, at: 110 })
  })
})

describe('toInputEvent', () => {
  it('stamps source sim and time = start + at, with the default velocity', () => {
    expect(toInputEvent({ kind: 'noteOn', note: 60, at: 5 }, 1000)).toEqual({
      kind: 'noteOn',
      note: 60,
      velocity: DEFAULT_SIM_VELOCITY,
      time: 1005,
      source: 'sim',
    })
    expect(toInputEvent({ kind: 'pedal', down: true }, 7)).toEqual({
      kind: 'pedal',
      down: true,
      time: 7,
      source: 'sim',
    })
  })

  it('rejects bad notes, velocities, offsets and kinds', () => {
    expect(() => toInputEvent({ kind: 'noteOn', note: 128 }, 0)).toThrow(/note/)
    expect(() => toInputEvent({ kind: 'noteOff', note: 1.5 }, 0)).toThrow(/note/)
    expect(() => toInputEvent({ kind: 'noteOn', note: 60, velocity: 0 }, 0)).toThrow(/velocity/)
    expect(() => toInputEvent({ kind: 'noteOn', note: 60, velocity: 2 }, 0)).toThrow(/velocity/)
    expect(() => toInputEvent({ kind: 'noteOn', note: 60, at: -1 }, 0)).toThrow(/at/)
    expect(() => toInputEvent({ kind: 'wobble' } as never, 0)).toThrow(/unknown kind/)
  })
})
