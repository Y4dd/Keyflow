import { describe, expect, it } from 'vitest'
import { ELECTRO_FUNK_VAMP } from '../grooves/library.ts'
import { evidence, noteMarks, suggest, takeStats, type TakeStats } from './stats.ts'
import { TAKE_FORMAT, type Take, type TakeEvent } from './take.ts'

// D minor, i7 (D F A C) for two bars then IV7 (G B D F); at 120 BPM a beat is 500 ms.
const VAMP = ELECTRO_FUNK_VAMP
const BEAT = 500

function take(events: TakeEvent[], extra: Partial<Take> = {}): Take {
  return {
    format: TAKE_FORMAT,
    createdAt: 1,
    grooveId: VAMP.id,
    tonic: 2,
    bpm: 120,
    scale: 'minor pentatonic',
    countIn: false,
    lengthMs: 20_000,
    events,
    offsetMs: null,
    offsetLeadMs: null,
    leadMs: null,
    ...extra,
  }
}

/** Presses `note` at `start` ms for `length` ms. */
const press = (note: number, start: number, length = 200): TakeEvent[] => [
  { kind: 'noteOn', note, velocity: 0.5, at: start },
  { kind: 'noteOff', note, at: start + length },
]
const played = (...notes: TakeEvent[][]) => notes.flat().sort((a, b) => a.at - b.at)

describe('takeStats', () => {
  it('counts notes, range and notes in the scale', () => {
    // D4 F4 A4 in the scale, E♭4 (63) and B4 (71) not.
    const s = takeStats(
      take(played(press(62, 0), press(65, 250), press(69, 500), press(63, 750), press(71, 1000))),
      VAMP,
    )
    expect(s.notes).toBe(5)
    expect([s.lowest, s.highest]).toEqual([62, 71])
    expect(s.inScale).toBeCloseTo(3 / 5)
  })

  it('leaves everything empty for a take with no notes', () => {
    const s = takeStats(take([{ kind: 'pedal', down: true, at: 0 }]), VAMP)
    expect(s).toMatchObject({
      notes: 0,
      lowest: null,
      highest: null,
      inScale: null,
      longestRestMs: null,
    })
    expect(s.strongBeats).toEqual({ notes: 0, chordTones: 0 })
  })

  it('counts chord tones among the notes on beats 1 and 3, by the chord on that beat', () => {
    const s = takeStats(
      take(
        played(
          press(62, 0), // beat 1, D: chord tone of i7
          press(64, 2 * BEAT + 40), // beat 3 a little late, E: not in i7
          press(69, 1 * BEAT), // beat 2: not a strong beat
          press(71, 8 * BEAT - 30), // just before bar 3's beat 1, B: a tone of IV7, not i7
          press(60, 4 * BEAT + BEAT / 2), // an offbeat: not counted
        ),
      ),
      VAMP,
    )
    expect(s.strongBeats).toEqual({ notes: 3, chordTones: 2 })
  })

  it('lines notes up with the beat using the calibration offset and both clock leads', () => {
    // Heard at at - offset + lead - offsetLead: 990 - 80 + 50 + 40 = 1000, on beat 3. A wrong
    // sign on any term moves it 80 ms or more, outside the ±62.5 ms window at 120 BPM.
    const cal = { offsetMs: 80, leadMs: 50, offsetLeadMs: -40 }
    const at = (c: Partial<Take>) =>
      takeStats(take(played(press(62, 990)), c), VAMP).strongBeats?.notes
    expect(at(cal)).toBe(1)
    expect(at({ ...cal, offsetMs: -80 })).toBe(0)
    expect(at({ ...cal, leadMs: -50 })).toBe(0)
    expect(at({ ...cal, offsetLeadMs: 40 })).toBe(0)
  })

  it('skips the count-in, which has no chord', () => {
    const s = takeStats(take(played(press(62, 0), press(62, 4 * BEAT)), { countIn: true }), VAMP)
    expect(s.strongBeats?.notes).toBe(1)
  })

  it('has no strong-beat count without the groove', () => {
    expect(takeStats(take(played(press(62, 0))), null).strongBeats).toBeNull()
  })

  it('finds the longest rest between presses, with every key up', () => {
    const s = takeStats(
      take(
        played(
          press(62, 0, 1000), // held over the next press
          press(65, 500, 100),
          press(69, 1500, 100), // 500 ms after D lets go
          press(72, 3600, 100), // 2000 ms after
        ),
      ),
      VAMP,
    )
    expect(s.longestRestMs).toBe(2000)
    expect(s.longestRest).toEqual({ start: 1600, end: 3600 })
    expect(takeStats(take(played(press(62, 0))), VAMP).longestRestMs).toBeNull()
  })

  it('notes which pitch classes were played', () => {
    const s = takeStats(take(played(press(62, 0), press(74, 500), press(68, 1000))), VAMP)
    expect([...s.pitchClasses].sort((a, b) => a - b)).toEqual([2, 8])
  })
})

const stats = (over: Partial<TakeStats>): TakeStats => ({
  notes: 20,
  lowest: 60,
  highest: 76,
  inScale: 0.9,
  strongBeats: { notes: 8, chordTones: 6 },
  longestRestMs: 4 * BEAT,
  longestRest: { start: 0, end: 4 * BEAT },
  lengthBeats: 32,
  pitchClasses: new Set([2, 5, 7, 8, 9, 0]),
  ...over,
})

describe('suggest', () => {
  const t = take([])
  it('asks for a longer take when there are few notes', () => {
    expect(suggest(stats({ notes: 5 }), t)).toBe('longer')
  })

  it('asks for space when no rest reached a bar in a take of some length', () => {
    expect(suggest(stats({ longestRestMs: 4 * BEAT - 1 }), t)).toBe('space')
    // A short take isn't asked for a bar of space.
    expect(suggest(stats({ longestRestMs: 2 * BEAT, lengthBeats: 12 }), t)).not.toBe('space')
  })

  it('points to the blue note in a blues scale when it went unplayed', () => {
    const blues = take([], { scale: 'minor blues' })
    expect(suggest(stats({ pitchClasses: new Set([2, 5, 7, 9, 0]) }), blues)).toBe('blueNote')
    expect(suggest(stats({}), blues)).not.toBe('blueNote')
    expect(suggest(stats({ pitchClasses: new Set([2]) }), t)).not.toBe('blueNote')
  })

  it('asks for chord tones on 1 and 3 when fewer than half landed there', () => {
    expect(suggest(stats({ strongBeats: { notes: 8, chordTones: 3 } }), t)).toBe('land')
    // Too few notes on strong beats to say, or no groove to tell.
    expect(suggest(stats({ strongBeats: { notes: 3, chordTones: 0 } }), t)).not.toBe('land')
    expect(suggest(stats({ strongBeats: null }), t)).not.toBe('land')
  })

  it('asks for more range when every note sat within a fifth', () => {
    expect(suggest(stats({ lowest: 60, highest: 66 }), t)).toBe('range')
  })

  it('asks for a pass inside the scale when many notes were outside it', () => {
    expect(suggest(stats({ inScale: 0.6 }), t)).toBe('scale')
  })

  it('has a suggestion for a take that trips no rule', () => {
    expect(suggest(stats({}), t)).toBe('repeat')
  })

  it('takes the first rule that applies', () => {
    expect(suggest(stats({ longestRestMs: 0, inScale: 0.1, lowest: 60, highest: 61 }), t)).toBe(
      'space',
    )
  })
})

describe('noteMarks', () => {
  // Beat 1 D (chord tone, in scale); beat 3 E (not a chord tone, out of the scale); beat 2 A (in
  // the scale, not strong); bar 3 beat 1 B (a tone of IV7 but outside D minor pentatonic).
  const t = take(
    played(
      press(62, 0),
      press(64, 2 * BEAT),
      press(69, BEAT),
      press(71, 8 * BEAT),
      press(60, 9 * BEAT + 250),
    ),
  )

  it('flags each note as the stats count it, overlaps included', () => {
    const flags = noteMarks(t, VAMP).map(({ note, inScale, strong, chordTone }) => [
      note.note,
      inScale,
      strong,
      chordTone,
    ])
    expect(flags).toEqual([
      [62, true, true, true],
      [69, true, false, false],
      [64, false, true, false],
      [71, false, true, true],
      [60, true, false, false],
    ])
  })

  it('adds up to exactly the stats', () => {
    const marks = noteMarks(t, VAMP)
    const s = takeStats(t, VAMP, marks)
    expect(s.notes).toBe(marks.length)
    expect(s.inScale! * s.notes).toBeCloseTo(marks.filter((m) => m.inScale).length)
    expect(s.strongBeats).toEqual({
      notes: marks.filter((m) => m.strong).length,
      chordTones: marks.filter((m) => m.chordTone).length,
    })
    expect(s).toEqual(takeStats(t, VAMP))
  })

  it('marks nothing strong without the groove', () => {
    expect(noteMarks(t, null).some((m) => m.strong || m.chordTone)).toBe(false)
  })
})

describe('evidence', () => {
  it('points space at the busiest bar', () => {
    // One press in bar 1, three in bar 2.
    const t = take(
      played(press(62, 0), press(65, 4 * BEAT), press(67, 5 * BEAT), press(69, 6 * BEAT)),
    )
    expect(evidence('space', t, noteMarks(t, VAMP))).toEqual({ kind: 'bar', startTick: 4 * 192 })
  })

  it('puts the blue note between the first step from the 4th to the 5th', () => {
    // D minor: G4 (67) then A4 (69) leaves room for A♭4 (68).
    const t = take(played(press(62, 0), press(67, 1000), press(69, 1500), press(67, 2000)))
    expect(evidence('blueNote', t, noteMarks(t, VAMP))).toEqual({
      kind: 'ghost',
      note: 68,
      at: 1250,
    })
    // An octave apart is no step.
    const far = take(played(press(67, 0), press(81, 500)))
    expect(evidence('blueNote', far, noteMarks(far, VAMP))).toBeNull()
  })

  it('points land and scale at the notes they count', () => {
    const t = take(played(press(62, 0), press(64, 2 * BEAT), press(63, BEAT)))
    const marks = noteMarks(t, VAMP)
    expect(evidence('land', t, marks)).toEqual({ kind: 'notes', notes: [marks[2]!.note] })
    expect(evidence('scale', t, marks)).toEqual({
      kind: 'notes',
      notes: [marks[1]!.note, marks[2]!.note],
    })
    expect(evidence('repeat', t, marks)).toBeNull()
  })
})
