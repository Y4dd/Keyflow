import { describe, expect, it } from 'vitest'
import { PPQ, type Groove } from './groove.ts'
import { GROOVES } from './library.ts'
import {
  BAR_TICKS,
  barEvents,
  bassNote,
  countInEvents,
  voicingNotes,
  type GrooveEvent,
} from './schedule.ts'

const STEP = PPQ / 4

// C minor, i7 for a bar then IV7 for a bar; a small pattern so one bar's list can be read whole.
const groove: Groove = {
  id: 'test',
  name: 'Test',
  tempo: 100,
  swing: 0,
  key: { tonic: 0, mode: 'minor' },
  bars: 2,
  progression: [
    { rn: 'i7', beats: 4 },
    { rn: 'IV7', beats: 4 },
  ],
  drums: { kick: [1, 0, 0, 0, 0, 0, 0, 0], snare: [0, 0, 0, 0, 0.5, 0, 0, 0] },
  bass: {
    steps: 16,
    register: 36,
    notes: [
      { step: 0, length: 4, velocity: 1, degree: 1 },
      { step: 4, length: 2, velocity: 0.8, degree: 5, octave: -1 },
    ],
  },
  chords: {
    steps: 16,
    voicing: [1, 3, 4],
    register: 55,
    hits: [{ step: 2, length: 2, velocity: 0.7 }],
  },
  soloScale: 'minor pentatonic',
  altScales: [],
}

const brief = (events: GrooveEvent[]) =>
  events.map((e) =>
    e.kind === 'drum'
      ? `${e.tick} ${e.voice} ${e.velocity}`
      : e.kind === 'click'
        ? `${e.tick} click${e.accent ? '!' : ''}`
        : `${e.tick} ${e.part} ${e.kind} ${e.note}${e.kind === 'on' ? ` ${e.velocity}` : ''}`,
  )

describe('barEvents', () => {
  it('gives the expected event list for one bar', () => {
    expect(brief(barEvents(groove, 0))).toEqual([
      '0 kick 1',
      '0 bass on 36 1', // C2, the i7 root
      `${2 * STEP} chords on 63 0.7`, // Eb4 (3rd) at or above G3,
      `${2 * STEP} chords on 70 0.7`, // Bb4 (7th),
      `${2 * STEP} chords on 72 0.7`, // C5 (root above)
      `${4 * STEP} bass off 36`,
      `${4 * STEP} chords off 63`,
      `${4 * STEP} chords off 70`,
      `${4 * STEP} chords off 72`,
      `${4 * STEP} snare 0.5`,
      `${4 * STEP} bass on 31 0.8`, // G1: degree 5 an octave down
      `${6 * STEP} bass off 31`,
      `${8 * STEP} kick 1`, // the 8-step drum pattern loops inside the bar
      `${12 * STEP} snare 0.5`,
    ])
  })

  it('follows the changes: the next bar plays the same pattern over IV7', () => {
    const notes = barEvents(groove, 1).filter((e) => e.kind === 'on')
    expect(notes.map((e) => e.tick - BAR_TICKS)).toEqual([
      0,
      2 * STEP,
      2 * STEP,
      2 * STEP,
      4 * STEP,
    ])
    // F2, then A3 / Eb4 / F4 (3rd, b7, root of F7), then C2.
    expect(notes.map((e) => e.kind === 'on' && e.note)).toEqual([41, 57, 63, 65, 36])
  })

  it('loops: bar 2 of a 2-bar groove is bar 0 again, a loop later', () => {
    const again = barEvents(groove, 2).map((e) => ({ ...e, tick: e.tick - 2 * BAR_TICKS }))
    expect(brief(again)).toEqual(brief(barEvents(groove, 0)))
  })

  it('ends a note crossing the bar line (and the loop end) in the next bar, at its pitch', () => {
    const g: Groove = {
      ...groove,
      bass: { ...groove.bass, notes: [{ step: 14, length: 4, velocity: 1, degree: 1 }] },
    }
    const bass = (bar: number, kind: 'on' | 'off') =>
      barEvents(g, bar).filter((e) => e.kind === kind && e.part === 'bass')
    expect(bass(1, 'on')).toMatchObject([{ id: 'bass:30:0:0', note: 41 }])
    expect(bass(2, 'off')).toEqual([
      { tick: 2 * BAR_TICKS + 2 * STEP, kind: 'off', part: 'bass', id: 'bass:30:0:0', note: 41 },
    ])
    // The very first bar has no off for a note that never started.
    expect(bass(0, 'off')).toEqual([])
  })

  it('handles a pattern longer than a bar', () => {
    const g: Groove = {
      ...groove,
      bass: { steps: 32, register: 36, notes: [{ step: 20, length: 1, velocity: 1, degree: 3 }] },
    }
    expect(barEvents(g, 0).filter((e) => e.kind === 'on' && e.part === 'bass')).toEqual([])
    const [on] = barEvents(g, 1).filter((e) => e.kind === 'on' && e.part === 'bass')
    expect(on).toMatchObject({ tick: BAR_TICKS + 4 * STEP, note: 45 }) // A2, the 3rd of F7
  })

  it('swings the offbeat 16ths, ons and offs alike', () => {
    const g: Groove = {
      ...groove,
      swing: 1,
      drums: {},
      chords: { ...groove.chords, hits: [] },
      bass: { ...groove.bass, notes: [{ step: 1, length: 2, velocity: 1, degree: 1 }] },
    }
    expect(barEvents(g, 0).map((e) => e.tick)).toEqual([64, 160])
  })

  it('puts a release before a new note at the same tick, so a repeated pitch re-attacks', () => {
    const g: Groove = {
      ...groove,
      drums: {},
      chords: { ...groove.chords, hits: [] },
      bass: {
        ...groove.bass,
        notes: [
          { step: 0, length: 2, velocity: 1, degree: 1 },
          { step: 2, length: 2, velocity: 1, degree: 1 },
        ],
      },
    }
    expect(brief(barEvents(g, 0)).slice(0, 4)).toEqual([
      '0 bass on 36 1',
      `${2 * STEP} bass off 36`,
      `${2 * STEP} bass on 36 1`,
      `${4 * STEP} bass off 36`,
    ])
  })

  it('pairs every on with one off by id, over several loops of every shipped groove', () => {
    for (const g of GROOVES) {
      const events = Array.from({ length: g.bars * 3 }, (_, bar) => barEvents(g, bar)).flat()
      const open = new Map<string, number>()
      for (const e of events) {
        if (e.kind === 'on') open.set(e.id, e.note)
        else if (e.kind === 'off') {
          expect(open.get(e.id)).toBe(e.note)
          open.delete(e.id)
        }
      }
      // Only notes still sounding at the very end are left.
      for (const id of open.keys()) {
        const start = Number(id.split(':')[1])
        expect(start).toBeGreaterThanOrEqual(g.bars * 3 * 16 - 16)
      }
      const ticks = events.map((e) => e.tick)
      expect(ticks).toEqual([...ticks].sort((a, b) => a - b))
    }
  })
})

describe('countInEvents', () => {
  it('clicks the four beats of the bar before the groove, the first accented', () => {
    expect(brief(countInEvents())).toEqual([
      `${-4 * PPQ} click!`,
      `${-3 * PPQ} click`,
      `${-2 * PPQ} click`,
      `${-PPQ} click`,
    ])
  })
})

describe('voicingNotes', () => {
  it('stacks the tones above the register', () => {
    expect(voicingNotes(0, [0, 3, 7, 10], [0, 1, 2, 3], 48)).toEqual([48, 51, 55, 58])
    expect(voicingNotes(0, [0, 3, 7, 10], [1, 3, 4], 64)).toEqual([75, 82, 84])
  })

  it('keeps a 9th above the 7th', () => {
    // C9: C E G Bb D; index 4 is the 9th, 14 semitones up.
    expect(voicingNotes(0, [0, 4, 7, 10, 2], [0, 4], 48)).toEqual([48, 62])
  })
})

describe('bassNote', () => {
  it('puts the root at or above the register, then the degree and octave', () => {
    expect(bassNote(5, '7', 1, 0, 36)).toBe(41)
    expect(bassNote(0, 'm7', 3, 0, 36)).toBe(39)
    expect(bassNote(0, 'm7', 8, -1, 36)).toBe(36)
  })
})
