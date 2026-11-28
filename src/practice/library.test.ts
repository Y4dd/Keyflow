import { Chord, Note, Scale } from 'tonal'
import { describe, expect, it } from 'vitest'
import { CURRICULUM } from './curriculum.ts'
import { CHORDS, drillOf, SCALES } from './drills.ts'
import { LIBRARY, libraryEntry, ROOTS, type Pick } from './library.ts'

const chroma = (n: string) => Note.chroma(n)!
const curriculum = new Set(CURRICULUM.flatMap((u) => u.items))
const every: Pick[] = LIBRARY.flatMap((g) =>
  g.qualities.flatMap((quality) =>
    ROOTS.map((root) => ({ root, type: g.type, quality, inversion: 0 })),
  ),
)

describe('LIBRARY', () => {
  it('is the curriculum’s triads, 7ths and soloing scales', () => {
    expect(LIBRARY.map((g) => g.qualities)).toEqual([
      ['min', 'maj', 'dim', 'sus2', 'sus4'],
      ['m7', '7', 'maj7'],
      ['minPent', 'blues', 'dorian', 'majPent', 'mixolydian'],
    ])
  })

  it('shows each root position as the curriculum’s own item', () => {
    for (const p of every) expect(curriculum.has(libraryEntry(p).item), p.quality).toBe(true)
  })
})

describe('libraryEntry, chords', () => {
  it('marks the notes tonal gives, bass first for each inversion', () => {
    for (const root of ['C', 'Eb', 'F#', 'A', 'Bb'])
      for (const quality of ['maj', 'min', 'dim', 'sus4', 'm7', '7', 'maj7']) {
        const tonal = Chord.getChord(CHORDS[quality as keyof typeof CHORDS].tonal, root).notes
        for (let inversion = 0; inversion < tonal.length; inversion++) {
          const e = libraryEntry({ root, type: 'chord', quality, inversion })
          const notes = e.tones.map((t) => t.note)
          expect(notes.map((n) => n % 12).sort()).toEqual(tonal.map(chroma).sort())
          expect(notes[0]! % 12).toBe(chroma(tonal[inversion]!))
          expect(notes).toEqual([...notes].sort((a, b) => a - b))
          expect(e.inversions).toBe(tonal.length)
        }
      }
  })

  it('labels degrees and names, and titles the inversion', () => {
    const e = libraryEntry({ root: 'Eb', type: 'chord', quality: 'min', inversion: 1 })
    expect(e.title).toBe('E♭ minor, 1st inversion')
    expect(e.tones.map((t) => `${t.name} ${t.degree}`)).toEqual(['G♭ ♭3', 'B♭ 5', 'E♭ R'])
    expect(e.formula).toBe('Minor: root, +3 half-steps, +4 half-steps')
    expect(e.item).toBe('chord:Eb:min:inv1')
    const d = libraryEntry({ root: 'G', type: 'chord', quality: '7', inversion: 0 })
    expect(d.title).toBe('G7')
    expect(d.tones.map((t) => t.degree)).toEqual(['R', '3', '5', '♭7'])
  })

  it('opens the drill of the item shown', () => {
    const e = libraryEntry({ root: 'D', type: 'chord', quality: 'm7', inversion: 2 })
    const d = drillOf(e.item)
    expect(d.kind === 'chord' && d.answer).toEqual(e.tones.map((t) => t.note))
  })

  it('hears the chord as a block, then broken', () => {
    const e = libraryEntry({ root: 'C', type: 'chord', quality: 'maj', inversion: 0 })
    const ons = e.hear.filter((x) => x.kind === 'noteOn')
    const notes = e.tones.map((t) => t.note)
    expect(ons.map((x) => x.kind === 'noteOn' && x.note)).toEqual([...notes, ...notes])
    expect(ons.slice(0, 3).every((x) => (x.at ?? 0) === 0)).toBe(true)
    expect(e.hear.filter((x) => x.kind === 'noteOff')).toHaveLength(6) // nothing left held
  })
})

describe('libraryEntry, scales', () => {
  it('marks one octave of tonal’s scale, root to root', () => {
    for (const root of ROOTS)
      for (const quality of LIBRARY[2]!.qualities) {
        const tonal = Scale.get(`${root} ${SCALES[quality as keyof typeof SCALES].tonal}`).notes
        const e = libraryEntry({ root, type: 'scale', quality, inversion: 0 })
        const notes = e.tones.map((t) => t.note)
        expect(notes.slice(0, -1).map((n) => n % 12)).toEqual(tonal.map(chroma))
        expect(notes.at(-1)).toBe(notes[0]! + 12)
      }
  })

  it('labels degrees, gives the steps, and hears it up and down', () => {
    const e = libraryEntry({ root: 'A', type: 'scale', quality: 'blues', inversion: 0 })
    expect(e.title).toBe('A blues')
    expect(e.tones.map((t) => `${t.name} ${t.degree}`)).toEqual([
      'A R',
      'C ♭3',
      'D 4',
      'E♭ ♭5',
      'E 5',
      'G ♭7',
      'A R',
    ])
    expect(e.formula).toBe(
      'Blues: root, +3 half-steps, +2 half-steps, +1 half-steps, +1 half-steps, +3 half-steps, +2 half-steps',
    )
    const ons = e.hear.flatMap((x) => (x.kind === 'noteOn' ? [x.note] : []))
    const up = e.tones.map((t) => t.note)
    expect(ons).toEqual([...up, ...up.slice(0, -1).reverse()])
  })
})

describe('the key’s diatonic chords', () => {
  it('spells the major key’s triads and picks them by the curriculum’s roots', () => {
    const { key } = libraryEntry({ root: 'Db', type: 'chord', quality: 'maj', inversion: 0 })
    expect(key.name).toBe('D♭ major')
    expect(key.chords.map((c) => `${c.numeral} ${c.symbol}`)).toEqual([
      'I D♭',
      'ii E♭m',
      'iii Fm',
      'IV G♭',
      'V A♭',
      'vi B♭m',
      'vii° C°',
    ])
    expect(key.chords[3]!.pick).toEqual({ root: 'Gb', type: 'chord', quality: 'maj', inversion: 0 })
    // shown as G♭, drilled as the curriculum's F♯ item
    const gb = libraryEntry(key.chords[3]!.pick)
    expect(gb.title).toBe('G♭ major')
    expect(gb.item).toBe('chord:F#:maj:root')
    const cb = libraryEntry({ root: 'Cb', type: 'chord', quality: 'maj', inversion: 0 })
    expect([cb.title, cb.item, cb.key.name]).toEqual(['C♭ major', 'chord:B:maj:root', 'C♭ major'])
  })

  it('uses the minor key for a minor chord or scale', () => {
    const { key } = libraryEntry({ root: 'D', type: 'scale', quality: 'dorian', inversion: 0 })
    expect(key.name).toBe('D minor')
    expect(key.chords.map((c) => `${c.numeral} ${c.symbol}`)).toEqual([
      'i Dm',
      'ii° E°',
      '♭III F',
      'iv Gm',
      'v Am',
      '♭VI B♭',
      '♭VII C',
    ])
  })
})
