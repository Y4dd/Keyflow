// Chords and scales as pitch classes, from Roman numerals relative to a key. Pure: no DOM,
// no Tone. Everything is an offset from the tonic, so transposing is only a tonic change and
// nothing here spells note names (that happens at the display boundary).

import { ChordType, Interval, RomanNumeral, Scale } from 'tonal'

export type KeyMode = 'major' | 'minor'

export interface Key {
  /** Pitch class, C = 0. */
  tonic: number
  mode: KeyMode
}

/** The solo scales a groove can offer (tonal's scale names), each rooted on the key tonic. */
export const SCALE_IDS = [
  'minor pentatonic',
  'minor blues',
  'dorian',
  'major pentatonic',
  'major',
  'mixolydian',
] as const
export type ScaleId = (typeof SCALE_IDS)[number]

/** What's sounding at a moment in a groove (later, a song). Display strings come from tonal. */
export interface HarmonyAt {
  keyTonic: number
  keyMode: KeyMode
  /** The progression's Roman numeral for this chord, e.g. "IV7". */
  rn: string
  /** Pitch class. */
  chordRoot: number
  /** tonal's chord type id, e.g. "m7", "7", "maj7", "m7b5". */
  chordQuality: string
  /** Pitch classes, root first. */
  chordTones: number[]
  /** Pitch classes of the chosen solo scale, tonic first. */
  soloScale: number[]
}

export interface Chord {
  root: number
  quality: string
  tones: number[]
}

/** Pitch class of any semitone count, negatives included. */
export const pc = (n: number): number => ((n % 12) + 12) % 12

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]

/** Suffixes tonal's numeral parser leaves as written; everything else gets an "m" when lowercase. */
const LOWER_QUALITY: Record<string, string> = { ø7: 'm7b5', '°': 'dim', '°7': 'dim7' }
const UPPER_QUALITY: Record<string, string> = { '': 'M', '+': 'aug' }

const semis = (intervals: string[]) => intervals.map((i) => Interval.semitones(i) ?? NaN)

/**
 * The chord a Roman numeral names in a key. Degrees count from the major scale in every mode
 * (tonal's convention), so in a minor key the third, sixth and seventh are written bIII, bVI,
 * bVII. Case gives the triad: "i7" is a minor seventh, "IV7" a dominant seventh.
 */
export function chordOf(rn: string, tonic: number): Chord {
  const n = RomanNumeral.get(rn)
  const written = n.empty
    ? ''
    : n.major
      ? (UPPER_QUALITY[n.chordType] ?? n.chordType)
      : (LOWER_QUALITY[n.chordType] ?? `m${n.chordType}`)
  const type = ChordType.get(written)
  if (n.empty || type.empty) throw new Error(`Unknown Roman numeral "${rn}"`)
  const root = pc(tonic + MAJOR_STEPS[n.step]! + n.alt)
  // tonal's first alias is its canonical id, so "IM7" and "Imaj7" both give "maj7".
  return { root, quality: type.aliases[0]!, tones: semis(type.intervals).map((s) => pc(root + s)) }
}

/** A scale's pitch classes on a tonic, tonic first. */
export const scalePcs = (id: ScaleId, tonic: number): number[] =>
  semis(Scale.get(id).intervals).map((s) => pc(tonic + s))

/**
 * The scale a chord quality implies for its bass line (chord-scale theory).
 * shortcut: only these qualities (no sus, dim7 or aug, whose degree 3 isn't a third in a
 * 7-note scale), add one when a groove uses a new quality.
 */
const CHORD_SCALE: Record<string, string> = {
  M: 'major',
  maj7: 'major',
  '6': 'major',
  '7': 'mixolydian',
  '9': 'mixolydian',
  '13': 'mixolydian',
  '7#9': 'mixolydian',
  m: 'dorian',
  m7: 'dorian',
  m6: 'dorian',
  m9: 'dorian',
  m11: 'dorian',
  m7b5: 'locrian',
}

/**
 * Semitones above the chord root for a 1-based degree of the chord's own scale (Dorian for m7,
 * Mixolydian for 7, ...), so degree 3 is always the chord's third and one bass pattern follows
 * the changes. Degrees past 7 go up an octave; go lower with the note's octave, not degree 0.
 */
export function degreeSemitones(quality: string, degree: number): number {
  const scale = CHORD_SCALE[quality]
  if (!scale) throw new Error(`No chord scale for "${quality}"`)
  if (!Number.isInteger(degree) || degree < 1) throw new Error(`Bad scale degree ${degree}`)
  const steps = semis(Scale.get(scale).intervals)
  const i = degree - 1
  return 12 * Math.floor(i / steps.length) + steps[i % steps.length]!
}
