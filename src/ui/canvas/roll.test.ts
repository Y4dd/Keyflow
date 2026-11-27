import { describe, expect, it } from 'vitest'
import { PPQ } from '../../grooves/groove.ts'
import { GROOVES } from '../../grooves/library.ts'
import { chordSpans, pitchRange } from './roll.ts'

const note = (n: number) => ({ note: n, velocity: 1, start: 0, end: 1 })

describe('pitchRange', () => {
  it('pads the notes played and shows 25 rows at least', () => {
    expect(pitchRange([])).toEqual([48, 72])
    expect(pitchRange([note(60), note(62)])).toEqual([49, 73])
    expect(pitchRange([note(40), note(90)])).toEqual([38, 92])
  })

  it('stays inside MIDI 0–127', () => {
    expect(pitchRange([note(126)])).toEqual([103, 127])
    expect(pitchRange([note(1)])).toEqual([0, 24])
  })
})

describe('chordSpans', () => {
  const groove = GROOVES[0]! // the vamp: i7 then IV7, two bars each
  const chord = 8 * PPQ

  it('splits the ticks at each chord change, looping the progression, from tick 0', () => {
    expect(groove.progression.map((s) => s.beats)).toEqual([8, 8])
    expect(chordSpans(groove, -chord, 2.5 * chord)).toEqual([
      { start: 0, end: chord, step: 0 },
      { start: chord, end: 2 * chord, step: 1 },
      { start: 2 * chord, end: 2.5 * chord, step: 0 },
    ])
  })

  it('starts mid-chord where asked', () => {
    expect(chordSpans(groove, 1.5 * chord, 2 * chord)).toEqual([
      { start: 1.5 * chord, end: 2 * chord, step: 1 },
    ])
  })
})
