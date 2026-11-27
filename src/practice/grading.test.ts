import { describe, expect, it } from 'vitest'
import { drillOf } from './drills.ts'
import { GRADING, hintDelays, hintsFor, rate, RATING, targetOf, type Graded } from './grading.ts'

const target = { ms: 3000, easyMs: 1500 }
const right = (ms: number, more: Partial<Graded> = {}): Graded => ({
  done: true,
  ms,
  hintLevel: 0,
  wrongNotes: 0,
  ...more,
})

describe('rate', () => {
  it.each([
    ['gave up', { done: false, ms: null, hintLevel: 0, wrongNotes: 0 }, RATING.again],
    [
      'gave up after the ladder',
      { done: false, ms: null, hintLevel: 3, wrongNotes: 4 },
      RATING.again,
    ],
    ['needed the answer (step 3)', right(1000, { hintLevel: 3 }), RATING.again],
    ['needed the anchor', right(1000, { hintLevel: 1 }), RATING.hard],
    ['needed the method', right(1000, { hintLevel: 2 }), RATING.hard],
    ['slower than the target', right(3001), RATING.hard],
    ['at the target', right(3000), RATING.good],
    ['quick, with a wrong note', right(1000, { wrongNotes: 1 }), RATING.good],
    ['at half the target', right(1500), RATING.good],
    ['under half the target, clean', right(1499), RATING.easy],
  ] as const)('%s', (_, attempt, rating) => {
    expect(rate(attempt, target)).toBe(rating)
  })
})

describe('targetOf', () => {
  it('times notes, triads and 7th chords from config', () => {
    expect(targetOf(drillOf('geo:F#')).ms).toBe(GRADING.targetMs.note)
    expect(targetOf(drillOf('chord:E:min:root')).ms).toBe(GRADING.targetMs.triad)
    expect(targetOf(drillOf('chord:E:min:any', { build: true })).ms).toBe(GRADING.targetMs.triad)
    expect(targetOf(drillOf('rn:G:major:V7')).ms).toBe(GRADING.targetMs.seventh)
    expect(targetOf(drillOf('chord:F:m7:inv3'))).toEqual({
      ms: GRADING.targetMs.seventh,
      easyMs: GRADING.targetMs.seventh / 2,
    })
  })

  it('times a scale as the run at its tempo plus the time to start, and Easy is reachable', () => {
    // 6 notes at 120 BPM: 5 gaps of 500 ms
    const t = targetOf(drillOf('scale:A:minPent:asc1', { bpm: 120 }))
    expect(t).toEqual({ ms: GRADING.scaleReactMs + 2500, easyMs: GRADING.scaleReactMs / 2 + 2500 })
    // started half a second after the prompt, played exactly in time
    expect(rate(right(500 + 2500), t)).toBe(RATING.easy)
  })
})

describe('hintDelays', () => {
  const pacing = GRADING.pacing.steady

  it('waits longer for the first hint as stability grows, up to the cap', () => {
    const firsts = [0, 1, 3, 7, 30, 365, 10000].map((s) => hintDelays(s, pacing, 3)[0]!)
    expect(firsts[0]).toBe(pacing.firstMs)
    for (let i = 1; i < firsts.length; i++) expect(firsts[i]).toBeGreaterThanOrEqual(firsts[i - 1]!)
    expect(firsts[3]).toBeGreaterThan(firsts[1]!)
    expect(firsts.at(-1)).toBe(pacing.maxFirstMs)
  })

  it('spaces the later steps evenly', () => {
    expect(hintDelays(0, pacing, 3).slice(1)).toEqual([pacing.stepMs, pacing.stepMs])
    expect(hintDelays(0, pacing, 2)).toHaveLength(2)
  })

  it('is slower in each profile than the one before', () => {
    const { quick, steady, patient } = GRADING.pacing
    for (const s of [0, 7])
      expect(hintDelays(s, quick, 1)[0]).toBeLessThan(hintDelays(s, steady, 1)[0]!)
    expect(hintDelays(0, steady, 1)[0]).toBeLessThan(hintDelays(0, patient, 1)[0]!)
  })
})

describe('hintsFor', () => {
  const keys = (item: string, level: number, opts = {}) =>
    hintsFor(drillOf(item, opts)).find((h) => h.level === level)?.keys

  it('climbs anchor, method, answer', () => {
    const ladder = hintsFor(drillOf('chord:D:min:root'))
    expect(ladder.map((h) => h.level)).toEqual([1, 2, 3])
    expect(ladder[0]!.say).toBe('Start from D.')
    expect(ladder[1]!.say).toBe('From D: root, +3 half-steps, +4 half-steps.')
    expect(ladder[1]!.keys).toEqual([
      { note: 62, label: 'R' },
      { note: 65, label: '+3' },
      { note: 69, label: '+4' },
    ])
    expect(ladder[2]!.keys.map((k) => k.label)).toEqual(['D', 'F', 'A'])
  })

  it('starts Build it at the method', () => {
    expect(hintsFor(drillOf('chord:D:min:any', { build: true })).map((h) => h.level)).toEqual([
      2, 3,
    ])
  })

  it('shows an inversion’s shape at step 3, bass first', () => {
    expect(keys('chord:F:m7:inv1', 3)).toEqual([
      { note: 56, label: 'A♭' },
      { note: 60, label: 'C' },
      { note: 63, label: 'E♭' },
      { note: 65, label: 'F' },
    ])
  })

  it('never lights the answer before step 3 in Find the note', () => {
    for (const n of ['C', 'F#', 'Bb', 'E']) {
      const d = drillOf(`geo:${n}`)
      const early = hintsFor(d).filter((h) => h.level < 3)
      expect(early.flatMap((h) => h.keys.map((k) => k.note % 12))).not.toContain(
        d.kind === 'note' ? d.pc : -1,
      )
    }
    expect(hintsFor(drillOf('geo:F#'))[1]!.say).toBe('F♯ is 6 half-steps above C.')
    expect(hintsFor(drillOf('geo:C'))[1]!.say).toBe('C is 7 half-steps above F.')
  })

  it('anchors chord in key on the tonic, not the chord’s root', () => {
    const ladder = hintsFor(drillOf('rn:G:major:vi'))
    expect(ladder[0]).toEqual({
      level: 1,
      say: 'Count up the G major scale from G.',
      keys: [{ note: 43, label: 'G' }],
    })
    expect(ladder[1]!.say).toBe('It’s built on E: root, +3 half-steps, +4 half-steps.')
    expect(hintsFor(drillOf('rn:A:minor:bVII'))[0]!.say).toBe('Count up the A minor scale from A.')
  })

  it('steps a scale up from its root', () => {
    const ladder = hintsFor(drillOf('scale:A:minPent:desc1'))
    expect(ladder[0]!.say).toBe('Start on A.')
    expect(ladder[1]!.say).toBe('Up from A: +3, +2, +2, +3, +2 half-steps.')
    expect(ladder[2]!.keys.map((k) => k.note)).toEqual([57, 60, 62, 64, 67, 69])
  })
})
