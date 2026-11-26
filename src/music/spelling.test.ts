import { Note } from 'tonal'
import { describe, expect, it } from 'vitest'
import { keyName, noteNames } from './spelling.ts'

const minor = (tonic: number) => ({ tonic, mode: 'minor' as const })
const major = (tonic: number) => ({ tonic, mode: 'major' as const })

describe('keyName', () => {
  it('names each key as its key signature spells it', () => {
    expect(keyName(major(1))).toBe('D♭')
    expect(keyName(minor(1))).toBe('C♯')
    expect(keyName(minor(8))).toBe('G♯')
    expect(keyName(major(6))).toBe('F♯')
  })
})

describe('noteNames', () => {
  it('spells notes by the chosen scale first: E minor blues has B♭, not A♯', () => {
    const names = noteNames(minor(4), 'minor blues')
    expect([4, 7, 9, 10, 11, 2].map((p) => names[p])).toEqual(['E', 'G', 'A', 'B♭', 'B', 'D'])
    // Outside the scale, by the key: E minor has F♯.
    expect(names[6]).toBe('F♯')
  })

  it("spells a chord tone outside the scale by the key: the vamp's IV7 third is B", () => {
    expect(noteNames(minor(2), 'minor pentatonic')[11]).toBe('B')
    expect(noteNames(minor(2), 'minor pentatonic')[10]).toBe('B♭')
  })

  it('uses flats in flat keys and sharps in sharp keys outside the key', () => {
    expect(noteNames(major(3), 'major pentatonic')[1]).toBe('D♭')
    expect(noteNames(major(9), 'major pentatonic')[3]).toBe('D♯')
  })

  it('never shows a double accidental (E♭ minor blues has A, not B𝄫)', () => {
    expect(noteNames(minor(3), 'minor blues')[9]).toBe('A')
  })

  it('names all 12 pitch classes once each, in every key, mode and scale', () => {
    const scales = [
      'minor pentatonic',
      'minor blues',
      'dorian',
      'major pentatonic',
      'major',
      'mixolydian',
    ] as const
    for (const mode of ['major', 'minor'] as const)
      for (let tonic = 0; tonic < 12; tonic++)
        for (const scale of scales) {
          const names = noteNames({ tonic, mode }, scale)
          expect(names).toHaveLength(12)
          expect(names.every((n) => /^[A-G][♭♯]?$/.test(n))).toBe(true)
          const ascii = names.map((n) => n.replace('♭', 'b').replace('♯', '#'))
          expect(ascii.map((n) => Note.chroma(n))).toEqual([...Array(12).keys()])
        }
  })
})
