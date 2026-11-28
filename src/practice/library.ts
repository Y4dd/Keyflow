// The chord and scale library (P2-T10): what the Learn view shows for a root and a chord or
// scale. Pure: no DOM, no Tone, no React. The vocabulary is the curriculum's, the notes come
// from the drills (so "Drill this" opens exactly the item shown), and the degrees from tonal.

import { ChordType, Interval, Note, Scale } from 'tonal'
import { chord, sequence, type SimEvent } from '../input/sim/script.ts'
import { chordOf, pc, type KeyMode } from '../music/harmony.ts'
import { pretty } from '../music/spelling.ts'
import { CURRICULUM } from './curriculum.ts'
import { CHORDS, drillOf, formulaOf, SCALES } from './drills.ts'

/** The curriculum's root spellings, so a library item is the curriculum's own item ID. */
export const ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

export type LibraryType = 'chord' | 'scale'

/** The curriculum's chord and scale qualities, in the order they unlock, grouped by track. */
export const LIBRARY = (
  [
    ['Triads', 'triads', 'chord'],
    ['7th chords', 'sevenths', 'chord'],
    ['Scales', 'scales', 'scale'],
  ] as const
).map(([group, track, type]) => ({
  group,
  type: type as LibraryType,
  qualities: [
    ...new Set(
      CURRICULUM.filter((u) => u.track === track).flatMap((u) =>
        u.items.map((i) => i.split(':')[2]!),
      ),
    ),
  ],
}))

export interface Pick {
  /** Any spelling ("Gb", "Cb"); the item ID uses the curriculum's (ROOTS) for its pitch class. */
  root: string
  type: LibraryType
  quality: string
  /** 0 = root position; ignored for scales. */
  inversion: number
}

export interface Tone {
  note: number
  name: string
  /** "R", "♭3", "5", "♭7". */
  degree: string
}

export interface Diatonic {
  /** "♭VII", "ii°". */
  numeral: string
  /** "Gm", "B♭", "A°", spelled in the key. */
  symbol: string
  /** What clicking it shows: the chord in root position, with the curriculum's root spelling. */
  pick: Pick
}

export interface Entry {
  /** The item "Drill this" opens. */
  item: string
  /** "E♭ minor, 1st inversion", "A minor pentatonic". */
  title: string
  /** "Minor: root, +3 half-steps, +4 half-steps", the words Build it uses. */
  formula: string
  /** The notes on the keys, low to high. */
  tones: Tone[]
  /** How many inversions the chord has (its tone count); 0 for a scale. */
  inversions: number
  /** The key this lives in ("E♭ minor") and its diatonic triads by Roman numeral. */
  key: { name: string; chords: Diatonic[] }
  /** Hear it: a chord block then broken, a scale up and down; times from HEAR_BPM. */
  hear: SimEvent[]
}

/** Hear it's tempo: an eighth note per step. */
export const HEAR_BPM = 100
const STEP = 60000 / HEAR_BPM / 2

const MINOR = new Set(['min', 'm7', 'minPent', 'blues', 'dorian'])
const NUMERALS: Record<KeyMode, string[]> = {
  major: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
  minor: ['i', 'ii°', 'bIII', 'iv', 'v', 'bVI', 'bVII'],
}
const QUALITY: Record<string, { id: string; suffix: string }> = {
  M: { id: 'maj', suffix: '' },
  m: { id: 'min', suffix: 'm' },
  dim: { id: 'dim', suffix: '°' },
}

/** "R", "♭3", "♯5" from a tonal interval ("1P", "3m", "5A"). */
function degreeOf(interval: string): string {
  const { num, alt } = Interval.get(interval)
  if (num === 1 || num === 8) return 'R'
  return (alt < 0 ? '♭'.repeat(-alt) : '♯'.repeat(alt)) + num
}

const plain = (name: string) => name.replace('♭', 'b').replace('♯', '#')
/** The curriculum's spelling of a root's pitch class. */
export const idRoot = (root: string) => ROOTS[Note.chroma(root)!]!

function keyOf(root: string, mode: KeyMode): Entry['key'] {
  return {
    name: pretty(root) + (mode === 'minor' ? ' minor' : ' major'),
    chords: NUMERALS[mode].map((numeral) => {
      const d = drillOf(`rn:${root}:${mode}:${numeral}`)
      const c = chordOf(numeral, Note.chroma(root)!)
      const q = QUALITY[c.quality]!
      return {
        numeral: numeral.replace(/^b/, '♭'),
        symbol: d.names[c.root]! + q.suffix,
        // the key's spelling, so the chip shows what it said (C♭ in E♭ minor, not B)
        pick: { root: plain(d.names[c.root]!), type: 'chord', quality: q.id, inversion: 0 },
      }
    }),
  }
}

export function libraryEntry({ root, type, quality, inversion }: Pick): Entry {
  const key = keyOf(root, MINOR.has(quality) ? 'minor' : 'major')
  if (type === 'scale') {
    const s = SCALES[quality as keyof typeof SCALES]
    const d = drillOf(`scale:${root}:${quality}:updown1`)
    if (d.kind !== 'scale') throw new Error('unreachable')
    const intervals = Scale.get(s.tonal).intervals
    const up = d.target.slice(0, intervals.length + 1)
    return {
      item: `scale:${idRoot(root)}:${quality}:asc1`,
      title: `${pretty(root)} ${s.word}`,
      // the top root closes the octave, so the last step is the one back up to it
      formula: `${s.word[0]!.toUpperCase() + s.word.slice(1)}: ${formulaOf(up.map(pc))}`,
      tones: up.map((note, i) => ({
        note,
        name: d.names[pc(note)]!,
        degree: degreeOf(intervals[i] ?? '8P'),
      })),
      inversions: 0,
      key,
      hear: sequence(d.target, { stepMs: STEP, gateMs: STEP * 0.9 }),
    }
  }
  const q = CHORDS[quality as keyof typeof CHORDS]
  const intervals = ChordType.get(q.tonal).intervals
  const seventh = intervals.length > 3
  const variant = inversion === 0 ? (seventh ? 'any' : 'root') : `inv${inversion}`
  const item = `chord:${idRoot(root)}:${quality}:${variant}`
  const d = drillOf(`chord:${root}:${quality}:${variant}`)
  if (d.kind !== 'chord') throw new Error('unreachable')
  return {
    item,
    title: inversion === 0 ? d.chordName : d.prompt,
    formula: `${q.word}: ${d.formula}`,
    tones: d.answer.map((note) => ({
      note,
      name: d.names[pc(note)]!,
      degree: degreeOf(intervals[d.tones.indexOf(pc(note))]!),
    })),
    inversions: intervals.length,
    key,
    hear: [
      ...chord(d.answer, { holdMs: STEP * 4 }),
      ...sequence(d.answer, { at: STEP * 5, stepMs: STEP, gateMs: STEP * 0.9 }),
    ],
  }
}
