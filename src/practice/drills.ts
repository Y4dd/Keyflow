// Drill types (P2-T3). Pure: no DOM, no Tone, no React. A drill comes from an item ID
// (docs/learning-design.md, "Skill items") and says what to prompt and what counts as correct;
// an attempt watches input until the answer is right. Ratings, target times and the hint ladder
// are in grading.ts (P2-T4): an attempt only reports how long it took and its wrong notes.
//
// Prompts use note names, chord symbols and Roman numerals only, never notation.

import { Chord, ChordType, Interval, Note, Scale } from 'tonal'
import {
  checkChord,
  checkScale,
  detectChord,
  type ChordMode,
  type PlayedNote,
} from '../analysis/recognize.ts'
import type { InputEvent } from '../input/types.ts'
import { chordOf, pc } from '../music/harmony.ts'

// ---- Vocabulary (learning-design.md ids → tonal) ----

const CHORDS = {
  maj: { tonal: 'M', word: 'Major' },
  min: { tonal: 'm', word: 'Minor' },
  dim: { tonal: 'dim', word: 'Diminished' },
  aug: { tonal: 'aug', word: 'Augmented' },
  sus2: { tonal: 'sus2', word: 'Sus2' },
  sus4: { tonal: 'sus4', word: 'Sus4' },
  maj7: { tonal: 'maj7', word: 'Major 7th' },
  m7: { tonal: 'm7', word: 'Minor 7th' },
  '7': { tonal: '7', word: 'Dominant 7th' },
  m7b5: { tonal: 'm7b5', word: 'Half-diminished' },
  maj9: { tonal: 'maj9', word: 'Major 9th' },
  m9: { tonal: 'm9', word: 'Minor 9th' },
  '9': { tonal: '9', word: 'Dominant 9th' },
} as const

const SCALES = {
  major: { tonal: 'major', word: 'major' },
  minor: { tonal: 'minor', word: 'minor' },
  minPent: { tonal: 'minor pentatonic', word: 'minor pentatonic' },
  majPent: { tonal: 'major pentatonic', word: 'major pentatonic' },
  blues: { tonal: 'minor blues', word: 'blues' },
  dorian: { tonal: 'dorian', word: 'Dorian' },
  mixolydian: { tonal: 'mixolydian', word: 'Mixolydian' },
} as const

export const CHORD_QUALITIES = Object.keys(CHORDS) as (keyof typeof CHORDS)[]
export const SCALE_QUALITIES = Object.keys(SCALES) as (keyof typeof SCALES)[]

const INVERSIONS: Record<string, number | null> = { any: null, root: 0, inv1: 1, inv2: 2, inv3: 3 }
const INVERSION_WORDS = ['root position', '1st inversion', '2nd inversion', '3rd inversion']
const RUNS = { asc1: 'up one octave', desc1: 'down one octave', updown1: 'up and down one octave' }

// ---- Drills ----

interface Base {
  /** The item ID this drill came from. */
  item: string
  prompt: string
  /** A second line under the prompt (the formula, for "Build it"), or null. */
  detail: string | null
  /** The hint ladder's first step (learning-design.md): 2, the method, for "Build it". */
  hintStart: 1 | 2
  /** Name of each pitch class (index 0..11) in this drill's spelling, for feedback. */
  names: string[]
}

export type Drill =
  | (Base & { kind: 'note'; pc: number; answer: number[] })
  | (Base & {
      kind: 'chord' | 'build' | 'chordInKey'
      /** Pitch classes, root first. */
      tones: number[]
      mode: ChordMode
      /** "E minor", "Fm7": the chord itself (for chord in key, the answer to the riddle). */
      chordName: string
      /** One right answer as MIDI notes, bass first (for showing the shape, P2-T4). */
      answer: number[]
      /** "root, +3 half-steps, +4 half-steps": the steps between the tones, root first. */
      formula: string
    })
  | (Base & {
      kind: 'scale'
      /** The run as MIDI notes, in order; any starting octave counts. */
      target: number[]
      bpm: number | null
    })

export interface DrillOptions {
  /** A chord item as "Build it": the prompt asks for the formula, shown with it. */
  build?: boolean
  /** A scale item in time at this tempo. */
  bpm?: number
}

const pretty = (n: string) => n[0] + n.slice(1).replaceAll('b', '♭').replaceAll('#', '♯')
const semis = (intervals: string[]) => intervals.map((i) => Interval.semitones(i)!)
const formulaOf = (tones: number[]) =>
  ['root', ...tones.slice(1).map((t, i) => `+${pc(t - tones[i]!)} half-steps`)].join(', ')

/** Pitch-class names: these spelled notes first, then flats if any is flat, else sharps. */
function namesFrom(spelled: string[]): string[] {
  const flat = spelled.some((n) => n.slice(1).includes('b'))
  const names = Array.from({ length: 12 }, (_, p) =>
    Note.pitchClass(flat ? Note.fromMidi(p) : Note.fromMidiSharps(p)),
  )
  for (const n of spelled) names[Note.chroma(n)!] = /bb|##/.test(n) ? Note.simplify(n) : n
  return names.map(pretty)
}

/** "E minor", "B♭ major", "Fm7", "Bm7♭5" from a root name and tonal's chord type id. */
function chordLabel(root: string, tonal: string): string {
  const words: Record<string, string> = {
    M: 'major',
    m: 'minor',
    dim: 'diminished',
    aug: 'augmented',
  }
  return words[tonal] ? `${root} ${words[tonal]}` : root + pretty(` ${tonal}`).slice(1)
}

/** The tones stacked upward from a bass note in E3..D♯4 (MIDI 52..63). */
function stack(tones: number[], inversion: number): number[] {
  const order = [...tones.slice(inversion), ...tones.slice(0, inversion)]
  const notes = [52 + pc(order[0]! - 4)]
  for (const t of order.slice(1)) notes.push(notes.at(-1)! + 1 + pc(t - notes.at(-1)! - 1))
  return notes
}

function root(name: string | undefined, item: string): { name: string; pc: number } {
  if (!name || !/^[A-G][#b]?$/.test(name)) throw new Error(`Bad note in item "${item}"`)
  return { name, pc: Note.chroma(name)! }
}

/**
 * The drill for an item ID: `geo:F#` (find the note), `chord:E:min:inv1` (play the chord, or
 * build it with `build`), `scale:A:minPent:asc1` (play the scale, in time with `bpm`) and
 * `rn:G:major:vi` (chord in key: the numeral's chord in that key). Throws on anything else.
 */
export function drillOf(item: string, opts: DrillOptions = {}): Drill {
  const [type, ...seg] = item.split(':')
  const bad = () => new Error(`Unknown item "${item}"`)

  if (type === 'geo' && seg.length === 1) {
    const r = root(seg[0], item)
    const shown = pretty(r.name)
    return {
      kind: 'note',
      item,
      prompt: shown,
      detail: null,
      hintStart: 1,
      names: namesFrom([r.name]),
      pc: r.pc,
      answer: [60 + r.pc],
    }
  }

  if (type === 'chord' && seg.length === 3) {
    const r = root(seg[0], item)
    // own keys only, so "toString" or "constructor" can't pass as a quality
    if (!Object.hasOwn(CHORDS, seg[1]!) || !Object.hasOwn(INVERSIONS, seg[2]!)) throw bad()
    const q = CHORDS[seg[1] as keyof typeof CHORDS]
    const inversion = INVERSIONS[seg[2]!]!
    const steps = semis(ChordType.get(q.tonal).intervals)
    const tones = steps.map((s) => pc(r.pc + s))
    if (inversion !== null && inversion >= tones.length) throw bad()
    const name = chordLabel(pretty(r.name), q.tonal)
    const formula = formulaOf(tones)
    return {
      kind: opts.build ? 'build' : 'chord',
      item,
      prompt: opts.build
        ? `Build ${name} from its formula`
        : inversion === null
          ? name
          : `${name}, ${INVERSION_WORDS[inversion]}`,
      detail: opts.build ? `${q.word}: ${formula}` : null,
      hintStart: opts.build ? 2 : 1,
      names: namesFrom(Chord.getChord(q.tonal, r.name).notes),
      tones,
      mode: inversion === null ? { kind: 'pcs' } : { kind: 'inversion', inversion },
      chordName: name,
      answer: stack(tones, inversion ?? 0),
      formula,
    }
  }

  if (type === 'scale' && seg.length === 3) {
    const r = root(seg[0], item)
    if (!Object.hasOwn(SCALES, seg[1]!) || !Object.hasOwn(RUNS, seg[2]!)) throw bad()
    const s = SCALES[seg[1] as keyof typeof SCALES]
    const run = RUNS[seg[2] as keyof typeof RUNS]
    // the root in A3..G♯4 (MIDI 57..68), then one octave of the scale above it
    const low = 57 + pc(r.pc - 9)
    const up = [...semis(Scale.get(s.tonal).intervals), 12].map((x) => low + x)
    const target =
      seg[2] === 'asc1'
        ? up
        : seg[2] === 'desc1'
          ? up.reverse()
          : [...up, ...up.slice(0, -1).reverse()]
    return {
      kind: 'scale',
      item,
      prompt: `${pretty(r.name)} ${s.word}, ${run}${opts.bpm ? `, at ${opts.bpm} BPM` : ''}`,
      detail: null,
      hintStart: 1,
      names: namesFrom(Scale.get(`${r.name} ${s.tonal}`).notes),
      target,
      bpm: opts.bpm ?? null,
    }
  }

  if (type === 'rn' && seg.length === 3 && (seg[1] === 'major' || seg[1] === 'minor')) {
    const key = root(seg[0], item)
    const chord = chordOf(seg[2]!, key.pc) // throws on an unknown numeral
    const names = namesFrom(Scale.get(`${key.name} ${seg[1]}`).notes)
    const keyShown = pretty(key.name) + (seg[1] === 'minor' ? ' minor' : '')
    return {
      kind: 'chordInKey',
      item,
      prompt: `The ${seg[2]!.replace(/^b/, '♭').replace(/^#/, '♯')} chord in ${keyShown}`,
      detail: null,
      hintStart: 1,
      names,
      tones: chord.tones,
      mode: { kind: 'pcs' },
      chordName: chordLabel(names[chord.root]!, chord.quality),
      answer: stack(chord.tones, 0),
      formula: formulaOf(chord.tones),
    }
  }

  throw bad()
}

// ---- Attempts ----

export interface AttemptState {
  /** The answer was right. Input after that is ignored. */
  done: boolean
  /** Milliseconds from the prompt being shown to the right answer, once done. */
  ms: number | null
  /** Notes that weren't part of the answer (a scale's slips count one each). */
  wrongNotes: number
  /** One line about the last try ("You played G6."), or null. */
  say: string | null
}

export interface Attempt {
  /** Feed every input event with the notes sounding after it (src/analysis/recognize.ts). */
  apply(e: InputEvent, held: readonly number[]): void
  state(): AttemptState
}

/**
 * Watches one drill being answered. A chord is judged from the first key going down after the
 * prompt (then on releases and the pedal too, so lifting a wrong note can answer), so a chord
 * still held from the last answer can't answer this one. A scale run that slips or is out of
 * time starts again (from the slipped note when it's the root).
 */
export function createAttempt(drill: Drill, shownAt: number): Attempt {
  const s: AttemptState = { done: false, ms: null, wrongNotes: 0, say: null }
  const name = (note: number) => drill.names[pc(note)]!
  let played: PlayedNote[] = []
  let touched = false
  const finish = (time: number) => {
    s.done = true
    s.ms = time - shownAt
    s.say = null
  }

  return {
    apply(e, held) {
      if (s.done) return
      if (e.kind !== 'noteOn') {
        // only a chord can become right without a key going down
        const chord = drill.kind !== 'note' && drill.kind !== 'scale'
        if (chord && touched && checkChord(held, drill.tones, drill.mode).ok) finish(e.time)
        return
      }
      touched = true
      if (drill.kind === 'note') {
        if (pc(e.note) === drill.pc) return finish(e.time)
        s.wrongNotes++
        s.say = `That’s ${name(e.note)}. Find ${name(drill.pc)}.`
      } else if (drill.kind === 'scale') {
        played.push({ note: e.note, time: e.time })
        const c = checkScale(played, drill.target, drill.bpm ? { bpm: drill.bpm } : {})
        const first = name(drill.target[0]!)
        if (c.ok) return finish(e.time)
        if (c.status === 'wrong') {
          s.wrongNotes++
          s.say = `Note ${c.matched + 1} should be ${name(c.expected!)}. Start again from ${first}.`
          played = pc(e.note) === pc(drill.target[0]!) ? [played.at(-1)!] : []
        } else if (c.status === 'done') {
          s.say =
            c.timing!.bpm === drill.bpm
              ? 'Right notes. Keep the gaps even.'
              : `Right notes at ${c.timing!.bpm} BPM. Again at ${drill.bpm} BPM.`
          played = []
        }
      } else {
        if (!drill.tones.includes(pc(e.note))) s.wrongNotes++
        const c = checkChord(held, drill.tones, drill.mode)
        if (c.ok) return finish(e.time)
        if (new Set(held.map(pc)).size < drill.tones.length) return
        const bass = drill.mode.kind === 'inversion' ? drill.tones[drill.mode.inversion]! : 0
        const heard = detectChord(held, drill.names)[0]
        s.say =
          !c.missing.length && !c.extra.length
            ? `Right notes. Put ${name(bass)} at the bottom.`
            : heard
              ? `You played ${pretty(heard.replace(/^([A-G][#b]?)M(?=\/|$)/, '$1'))}.`
              : 'Not that one yet.'
      }
    },
    state: () => ({ ...s }),
  }
}

// ---- Picking a drill ----

export type DrillKind = Drill['kind']

const ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const NOTES = [...ROOTS, 'C#', 'Gb']
const TRIADS = ['maj', 'min', 'dim', 'aug', 'sus2', 'sus4']
const SEVENTHS = ['maj7', 'm7', '7', 'm7b5']
const NUMERALS = {
  major: ['ii', 'iii', 'IV', 'V', 'vi', 'ii7', 'V7', 'IVmaj7'],
  minor: ['iv', 'v', 'bIII', 'bVI', 'bVII', 'iv7', 'bVImaj7'],
}
/** Starting tempo for scale drills (learning-design.md: accuracy first, slow). */
export const SCALE_BPM = 70

/**
 * A random drill of a kind, never the item just played (interleaving).
 * shortcut: uniform over a fixed vocabulary, no 9ths and no curriculum; the session builder
 * (P2-T6) replaces this with due and unlocked items.
 */
export function pickDrill(kind: DrillKind, previous: string | null, random = Math.random): Drill {
  const one = <T>(xs: readonly T[]) => xs[Math.floor(random() * xs.length)]!
  for (;;) {
    let d: Drill
    if (kind === 'note') d = drillOf(`geo:${one(NOTES)}`)
    else if (kind === 'scale')
      d = drillOf(`scale:${one(ROOTS)}:${one(SCALE_QUALITIES)}:${one(Object.keys(RUNS))}`, {
        bpm: SCALE_BPM,
      })
    else if (kind === 'chordInKey') {
      const mode = one(['major', 'minor'] as const)
      d = drillOf(`rn:${one(ROOTS)}:${mode}:${one(NUMERALS[mode])}`)
    } else {
      const quality = one([...TRIADS, ...SEVENTHS])
      const variants = [
        'any',
        'any',
        'root',
        'inv1',
        'inv2',
        ...(SEVENTHS.includes(quality) ? ['inv3'] : []),
      ]
      d = drillOf(`chord:${one(ROOTS)}:${quality}:${kind === 'build' ? 'any' : one(variants)}`, {
        build: kind === 'build',
      })
    }
    if (d.item !== previous) return d
  }
}
