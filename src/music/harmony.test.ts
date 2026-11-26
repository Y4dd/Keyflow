import { describe, expect, it } from 'vitest'
import { chordOf, degreeSemitones, pc, scalePcs } from './harmony.ts'

describe('pc', () => {
  it('wraps negative and large values into 0..11', () => {
    expect(pc(-1)).toBe(11)
    expect(pc(-13)).toBe(11)
    expect(pc(26)).toBe(2)
  })
})

describe('chordOf', () => {
  it('reads case as the triad: i7 is minor seventh, IV7 is dominant seventh', () => {
    expect(chordOf('i7', 0)).toEqual({ root: 0, quality: 'm7', tones: [0, 3, 7, 10] })
    expect(chordOf('IV7', 0)).toEqual({ root: 5, quality: '7', tones: [5, 9, 0, 3] })
  })

  it('spells the major-key progressions the grooves use', () => {
    expect(chordOf('Imaj7', 7)).toEqual({ root: 7, quality: 'maj7', tones: [7, 11, 2, 6] })
    expect(chordOf('vi7', 0).quality).toBe('m7')
    expect(chordOf('V7', 0).root).toBe(7)
    expect(chordOf('iii7', 0).root).toBe(4)
  })

  it('counts degrees from the major scale in any key, so a minor key writes bIII and bVII', () => {
    expect(chordOf('bIIImaj7', 9).root).toBe(0) // C in A minor
    expect(chordOf('bVII', 9)).toEqual({ root: 7, quality: 'M', tones: [7, 11, 2] })
    expect(chordOf('#iv°', 0)).toEqual({ root: 6, quality: 'dim', tones: [6, 9, 0] })
  })

  it('understands half-diminished and diminished sevenths', () => {
    expect(chordOf('viiø7', 0)).toEqual({ root: 11, quality: 'm7b5', tones: [11, 2, 5, 9] })
    expect(chordOf('vii°7', 0).quality).toBe('dim7')
  })

  it('gives one quality id however the chord is written', () => {
    expect(chordOf('IM7', 0).quality).toBe('maj7')
    expect(chordOf('Ima7', 0).quality).toBe('maj7')
    expect(chordOf('V7#9', 0).quality).toBe('7#9')
  })

  it('wraps the root past B', () => {
    expect(chordOf('V7', 10).root).toBe(5) // F7 in Bb
  })

  it('throws on a numeral it cannot read rather than returning no tones', () => {
    expect(() => chordOf('VIII', 0)).toThrow(/VIII/)
    expect(() => chordOf('Iblah', 0)).toThrow(/Iblah/)
    expect(() => chordOf('', 0)).toThrow()
  })
})

describe('scalePcs', () => {
  it('roots the scale on the tonic', () => {
    expect(scalePcs('minor pentatonic', 9)).toEqual([9, 0, 2, 4, 7])
    expect(scalePcs('minor blues', 0)).toEqual([0, 3, 5, 6, 7, 10])
    expect(scalePcs('dorian', 2)).toEqual([2, 4, 5, 7, 9, 11, 0])
  })
})

describe('degreeSemitones', () => {
  it('counts degrees in the chord’s own scale, so one bass pattern follows the changes', () => {
    // Degree 3 is the chord's third: a minor third over m7, a major third over 7.
    expect(degreeSemitones('m7', 3)).toBe(3)
    expect(degreeSemitones('7', 3)).toBe(4)
    expect(degreeSemitones('7', 7)).toBe(10)
    expect(degreeSemitones('maj7', 7)).toBe(11)
    expect(degreeSemitones('maj9', 7)).toBe(11)
    expect(degreeSemitones('m7b5', 5)).toBe(6)
    expect(degreeSemitones('m7', 1)).toBe(0)
  })

  it('goes up an octave past degree 7', () => {
    expect(degreeSemitones('m7', 8)).toBe(12)
    expect(degreeSemitones('m7', 9)).toBe(14)
    expect(degreeSemitones('m7', 15)).toBe(24)
  })

  it('throws for a degree below 1 or a chord quality with no chord scale', () => {
    expect(() => degreeSemitones('m7', 0)).toThrow(/0/)
    expect(() => degreeSemitones('m7', 1.5)).toThrow()
    expect(() => degreeSemitones('aug', 3)).toThrow(/aug/)
    expect(() => degreeSemitones('sus4', 3)).toThrow(/sus4/)
  })
})
