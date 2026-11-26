import { describe, expect, it } from 'vitest'
import type { HarmonyAt } from './harmony.ts'
import { tierOf } from './highlight.ts'

// The vamp's IV7 in D minor (G7: G B D F) over D minor pentatonic (D F G A C).
const g7: HarmonyAt = {
  keyTonic: 2,
  keyMode: 'minor',
  rn: 'IV7',
  chordRoot: 7,
  chordQuality: '7',
  chordTones: [7, 11, 2, 5],
  soloScale: [2, 5, 7, 9, 0],
}
const G = 67,
  B = 71,
  A = 69,
  E = 64

describe('tierOf', () => {
  it('levels 2 and 3 show all three tiers', () => {
    for (const level of [2, 3] as const) {
      expect(tierOf(G, g7, level)).toBe('chord')
      expect(tierOf(A, g7, level)).toBe('scale')
      expect(tierOf(E, g7, level)).toBe('other')
    }
  })

  it('a chord tone outside the solo scale is still a chord tone', () => {
    expect(tierOf(B, g7, 2)).toBe('chord')
  })

  it('level 1 marks chord tones only and dims nothing', () => {
    expect(tierOf(G, g7, 1)).toBe('chord')
    expect(tierOf(A, g7, 1)).toBeNull()
    expect(tierOf(E, g7, 1)).toBeNull()
  })

  it('level 0 marks nothing', () => {
    for (const n of [G, A, B, E]) expect(tierOf(n, g7, 0)).toBeNull()
  })

  it('goes by pitch class in every octave', () => {
    expect(tierOf(G - 24, g7, 2)).toBe('chord')
    expect(tierOf(E + 24, g7, 2)).toBe('other')
  })
})
