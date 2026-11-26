import { describe, expect, it } from 'vitest'
import { pc } from '../music/harmony.ts'
import { BEATS_PER_BAR, harmonyAt, STEPS_PER_BEAT, transpose, type Hit } from './groove.ts'
import { GROOVES } from './library.ts'
import { barEvents } from './schedule.ts'

// The shipped grooves are data, so these are the invariants the player and the ear rely on.
const KEY_STEPS = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] }

describe.each(GROOVES.map((g) => [g.name, g] as const))('%s', (_, g) => {
  const loopSteps = g.bars * BEATS_PER_BAR * STEPS_PER_BEAT
  const events = (groove = g) =>
    Array.from({ length: groove.bars }, (_, bar) => barEvents(groove, bar)).flat()

  it('fills its bars with the progression', () => {
    expect(g.progression.reduce((sum, c) => sum + c.beats, 0)).toBe(g.bars * BEATS_PER_BAR)
  })

  it('has patterns that loop evenly inside the groove, with hits on their grid', () => {
    for (const pattern of Object.values(g.drums)) {
      expect(loopSteps % pattern.length).toBe(0)
      for (const v of pattern) expect(v).toBeGreaterThanOrEqual(0)
      for (const v of pattern) expect(v).toBeLessThanOrEqual(1)
    }
    const check = (steps: number, hits: readonly Hit[]) => {
      expect(loopSteps % steps).toBe(0)
      for (const h of hits) {
        expect(h.step).toBeGreaterThanOrEqual(0)
        expect(h.step).toBeLessThan(steps)
        expect(h.length).toBeGreaterThanOrEqual(1)
        expect(h.velocity).toBeGreaterThan(0)
        expect(h.velocity).toBeLessThanOrEqual(1)
      }
    }
    check(g.bass.steps, g.bass.notes)
    check(g.chords.steps, g.chords.hits)
  })

  it('never overlaps two bass notes, even across the loop (the bass is mono)', () => {
    const notes = [...g.bass.notes].sort((a, b) => a.step - b.step)
    notes.forEach((n, i) => {
      const next = notes[i + 1]?.step ?? notes[0]!.step + g.bass.steps
      expect(n.step + n.length).toBeLessThanOrEqual(next)
    })
  })

  it('keeps the bass in the key or on the chord', () => {
    for (const e of events()) {
      if (e.kind !== 'on' || e.part !== 'bass') continue
      const h = harmonyAt(g, e.tick)
      const inKey = KEY_STEPS[g.key.mode].includes(pc(e.note - g.key.tonic))
      expect(inKey || h.chordTones.includes(pc(e.note))).toBe(true)
    }
  })

  it('stays in a playable register in all 12 keys', () => {
    for (let k = 0; k < 12; k++) {
      for (const e of events(transpose(g, k))) {
        if (e.kind !== 'on') continue
        const [lo, hi] = e.part === 'bass' ? [24, 60] : [48, 88]
        expect(e.note).toBeGreaterThanOrEqual(lo)
        expect(e.note).toBeLessThanOrEqual(hi)
      }
    }
  })

  it('offers alternatives other than its default solo scale', () => {
    expect(g.altScales).not.toContain(g.soloScale)
    expect(new Set(g.altScales).size).toBe(g.altScales.length)
  })
})

it('gives every groove its own id and name', () => {
  expect(new Set(GROOVES.map((g) => g.id)).size).toBe(GROOVES.length)
  expect(new Set(GROOVES.map((g) => g.name)).size).toBe(GROOVES.length)
})
