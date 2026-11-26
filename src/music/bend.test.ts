import { describe, expect, it } from 'vitest'
import { scaleBend, scaleStep } from './bend.ts'
import { pc, scalePcs, type ScaleId } from './harmony.ts'

const SCALES: ScaleId[] = [
  'minor pentatonic',
  'minor blues',
  'dorian',
  'major pentatonic',
  'major',
  'mixolydian',
]
const D_MINOR_PENT = scalePcs('minor pentatonic', 2) // D F G A C

describe('scaleStep', () => {
  it('goes to the next scale tone up, never staying put', () => {
    expect(scaleStep(62, D_MINOR_PENT, 1)).toBe(3) // D → F
    expect(scaleStep(65, D_MINOR_PENT, 1)).toBe(2) // F → G
    expect(scaleStep(69, D_MINOR_PENT, 1)).toBe(3) // A → C
    expect(scaleStep(72, D_MINOR_PENT, 1)).toBe(2) // C → D, across the octave
  })

  it('goes down to the scale tone below', () => {
    expect(scaleStep(62, D_MINOR_PENT, -1)).toBe(2) // D → C
    expect(scaleStep(65, D_MINOR_PENT, -1)).toBe(3) // F → D
  })

  it('from a note outside the scale, reaches the nearest scale tone that way', () => {
    expect(scaleStep(63, D_MINOR_PENT, 1)).toBe(2) // E♭ → F
    expect(scaleStep(63, D_MINOR_PENT, -1)).toBe(1) // E♭ → D
  })

  it('major scale: 1 or 2 semitones, half steps at E–F and B–C', () => {
    const c = scalePcs('major', 0)
    expect([60, 62, 64, 65, 67, 69, 71].map((n) => scaleStep(n, c, 1))).toEqual([
      2, 2, 1, 2, 2, 2, 1,
    ])
  })

  it('every note, every scale, every tonic: lands in the scale and skips no scale tone', () => {
    for (const id of SCALES) {
      for (let tonic = 0; tonic < 12; tonic++) {
        const scale = scalePcs(id, tonic)
        for (let note = 36; note <= 96; note++) {
          for (const dir of [1, -1] as const) {
            const step = scaleStep(note, scale, dir)
            expect(step).toBeGreaterThanOrEqual(1)
            expect(step).toBeLessThanOrEqual(3)
            expect(scale).toContain(pc(note + dir * step))
            for (let s = 1; s < step; s++) expect(scale).not.toContain(pc(note + dir * s))
          }
        }
      }
    }
  })
})

describe('scaleBend', () => {
  it('is a fraction of the step in the bend direction', () => {
    expect(scaleBend(62, 1, D_MINOR_PENT)).toBe(3)
    expect(scaleBend(62, 0.5, D_MINOR_PENT)).toBe(1.5)
    expect(scaleBend(62, -1, D_MINOR_PENT)).toBe(-2)
    expect(scaleBend(62, 0, D_MINOR_PENT)).toBe(0)
  })
})
