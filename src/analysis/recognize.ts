// Chord and scale recognition from input (P2-T2). Pure: no DOM, no Tone, no React. Drills (P2-T3)
// feed it input events and a target and get back what matched, what was missing and what was
// extra, so the hint ladder and grading (P2-T4) can say something specific.
//
// Pitches are MIDI numbers; a chord's tones are pitch classes, root first (`Chord.tones` in
// src/music/harmony.ts). Note names appear only in `detectChord`, which is for display.

import { Chord, Note } from 'tonal'
import type { PedalMode } from '../audio/expression.ts'
import type { InputEvent } from '../input/types.ts'
import { pc } from '../music/harmony.ts'

// ---- Held notes ----

export interface HeldNotes {
  /** Feed every input event; only note and pedal events matter. */
  apply(e: InputEvent): void
  /** MIDI numbers sounding now, lowest first: keys down, plus released ones the pedal holds. */
  notes(): number[]
  reset(): void
}

/**
 * The notes sounding now. The sustain pedal counts only while `pedalMode()` says 'sustain'
 * (in Bend and Glide-hold modes it does something else), read at each `notes()` call so a mode
 * change takes effect at once. The pedal is down if any MIDI channel's is (handled by the parser).
 */
export function createHeldNotes(pedalMode: () => PedalMode): HeldNotes {
  const down = new Set<number>()
  const sustained = new Set<number>()
  let pedal = false
  return {
    apply(e) {
      if (e.kind === 'noteOn') {
        down.add(e.note)
        sustained.delete(e.note)
      } else if (e.kind === 'noteOff') {
        down.delete(e.note)
        if (pedal) sustained.add(e.note)
      } else if (e.kind === 'pedal') {
        pedal = e.down
        if (!pedal) sustained.clear()
      }
    },
    notes() {
      const all = pedalMode() === 'sustain' && pedal ? [...down, ...sustained] : [...down]
      return all.sort((a, b) => a - b)
    },
    reset() {
      down.clear()
      sustained.clear()
      pedal = false
    },
  }
}

// ---- Chords ----

/** How strictly a chord must be played. */
export type ChordMode =
  /** Same pitch classes, any octave, any order, doublings allowed (the default). */
  | { kind: 'pcs' }
  /** As 'pcs', and the lowest note is the chord's `inversion`th tone (0 root, 1 third, ...). */
  | { kind: 'inversion'; inversion: number }
  /** Exactly these MIDI notes, no more or fewer. */
  | { kind: 'register'; notes: number[] }

export interface ChordCheck {
  ok: boolean
  /** Target pitch classes not being played. */
  missing: number[]
  /** Played pitch classes that aren't in the target. */
  extra: number[]
  /** False in 'inversion' mode when the right pitch classes sit on the wrong bass note. */
  bassOk: boolean
}

const sorted = (s: Iterable<number>) => [...s].sort((a, b) => a - b)

/** Checks held MIDI notes against a chord's pitch classes (root first). Nothing held: not ok. */
export function checkChord(
  held: readonly number[],
  tones: readonly number[],
  mode: ChordMode = { kind: 'pcs' },
): ChordCheck {
  const played = new Set(held.map(pc))
  const target = new Set(tones)
  const missing = sorted([...target].filter((p) => !played.has(p)))
  const extra = sorted([...played].filter((p) => !target.has(p)))
  const sameSet = held.length > 0 && !missing.length && !extra.length
  if (mode.kind === 'register') {
    const want = sorted(mode.notes)
    const have = sorted(new Set(held))
    const exact = have.length === want.length && have.every((n, i) => n === want[i])
    return { ok: exact, missing, extra, bassOk: exact }
  }
  const bassOk =
    mode.kind === 'pcs' || (held.length > 0 && pc(Math.min(...held)) === tones[mode.inversion])
  return { ok: sameSet && bassOk, missing, extra, bassOk }
}

/**
 * What the held notes spell, for "you played G6": tonal's candidates, best first, bass first
 * ("Em7/G" after "G6" for G B D E). Names come from `names` (12 pitch-class names, index = pitch
 * class, as `noteNames` in src/music/spelling.ts gives) or sharps. Empty when nothing matches.
 * shortcut: assumes a perfect fifth isn't dropped, so a rootless shell may name nothing.
 */
export function detectChord(held: readonly number[], names?: readonly string[]): string[] {
  const seen = new Set<number>()
  const spelled: string[] = []
  for (const n of sorted(held)) {
    if (seen.has(pc(n))) continue
    seen.add(pc(n))
    spelled.push(
      names
        ? names[pc(n)]!.replaceAll('♭', 'b').replaceAll('♯', '#')
        : Note.pitchClass(Note.fromMidiSharps(n)),
    )
  }
  return spelled.length < 2 ? [] : Chord.detect(spelled)
}

// ---- Scales ----

/** A note as played: MIDI number and performance time in ms. */
export interface PlayedNote {
  note: number
  time: number
}

export interface ScaleOptions {
  /**
   * 'any' (default): the same shape from any starting octave, the first note being the root's
   * pitch class. 'exact': the target's own MIDI numbers.
   */
  register?: 'any' | 'exact'
  /** Check the notes are in time at this tempo. */
  bpm?: number
  /** Beats between notes when `bpm` is set: 1 for quarters (default), 0.5 for eighths. */
  noteBeats?: number
}

/** Starting values; the gap between two notes may be this fraction off the target gap. */
export const SCALE_TIMING = { tolerance: 0.35 }

export interface ScaleCheck {
  /** 'partial' while the run is still right and unfinished, 'wrong' at the first slip, else 'done'. */
  status: 'partial' | 'wrong' | 'done'
  /** How many leading notes were right. */
  matched: number
  /** The note that was expected where it went wrong (a MIDI number, or a pitch class in 'any'
   *  register before the first note lands); null otherwise. */
  expected: number | null
  /** With a tempo set: the run's measured tempo and whether every gap was in time. */
  timing: { bpm: number; inTime: boolean } | null
  /** Done, and in time when a tempo is set. */
  ok: boolean
}

const median = (xs: number[]) => {
  const s = sorted(xs)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

/**
 * Checks the notes played, in order, against an ordered target (MIDI numbers). Call it again as
 * notes arrive: it judges the first target.length notes and ignores any after.
 */
export function checkScale(
  played: readonly PlayedNote[],
  target: readonly number[],
  opts: ScaleOptions = {},
): ScaleCheck {
  const exact = opts.register === 'exact'
  const base = played[0] ? played[0].note - target[0]! : 0
  let matched = 0
  let expected: number | null = null
  for (let i = 0; i < Math.min(played.length, target.length); i++) {
    const want = exact ? target[i]! : target[i]! + base
    // 'any' register: the first note must still be the root's pitch class (shape, not octave).
    const ok = exact || i > 0 ? played[i]!.note === want : pc(played[i]!.note) === pc(target[0]!)
    if (!ok) {
      expected = !exact && i === 0 ? pc(target[0]!) : want
      break
    }
    matched++
  }
  const done = matched === target.length
  const status = expected !== null ? 'wrong' : done ? 'done' : 'partial'

  let timing: ScaleCheck['timing'] = null
  if (opts.bpm && matched > 1) {
    const gap = (60000 / opts.bpm) * (opts.noteBeats ?? 1)
    const gaps = played.slice(1, matched).map((p, i) => p.time - played[i]!.time)
    timing = {
      bpm: Math.round((60000 * (opts.noteBeats ?? 1)) / median(gaps)),
      inTime: gaps.every((g) => Math.abs(g - gap) <= gap * SCALE_TIMING.tolerance),
    }
  }
  return {
    status,
    matched,
    expected,
    timing,
    ok: done && (!opts.bpm || (timing?.inTime ?? false)),
  }
}
