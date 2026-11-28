// Gentle stats after a take (P1-T8): what you played, never a score, and one thing to try next.
// The roll marks the same per-note flags the numbers count (P2-T11), so they can't disagree.
// Pure: no DOM, no Tone, no React. Pitches stay MIDI numbers; the Takes card names them.
//
// shortcut: the take doesn't store the split or the pedal mode, so left-hand notes count in the
// range and the scale, and a rest with the sustain pedal down still counts as a rest; store both
// in the take if the stats read wrong for split playing.

import { harmonyAt, PPQ, BEATS_PER_BAR, type Groove } from '../grooves/groove.ts'
import { pc, scalePcs } from '../music/harmony.ts'
import { takeNotes, tickAt, type Take, type TakeNote } from './take.ts'

/**
 * How far from beat 1 or 3 a note may start and still count as on it, in ticks: an eighth of a
 * beat either side (62 ms at 120 BPM).
 * shortcut: a guess, not measured on the learner's playing; widen it if notes played on the beat
 * are missed (the P1-T8 manual check).
 */
export const STRONG_BEAT_WINDOW = PPQ / 8

/** The rules' thresholds (starting values, tuned with real takes). */
export const SUGGEST = {
  /** Fewer notes than this and the take is too short to say much. */
  minNotes: 8,
  /** Ask for a bar of space only in a take that spans at least this many beats. */
  spaceAfterBeats: 16,
  /** Notes on 1 and 3 needed before their chord tones are worth a word. */
  minStrongBeatNotes: 4,
  chordToneShare: 0.5,
  /** Semitones: all notes within less than a fifth asks for more range. */
  minRange: 7,
  inScaleShare: 0.7,
}

export interface TakeStats {
  /** Keys pressed. */
  notes: number
  /** MIDI numbers; null with no notes. */
  lowest: number | null
  highest: number | null
  /** Share (0..1) of the notes in the take's scale; null with no notes. */
  inScale: number | null
  /** Notes starting on beat 1 or 3 and how many were chord tones; null without the groove. */
  strongBeats: { notes: number; chordTones: number } | null
  /** The longest time with every key up between two presses, ms; null under two notes. */
  longestRestMs: number | null
  /** Where that rest is, take ms (raw, like the notes' times); null under two notes. */
  longestRest: { start: number; end: number } | null
  /** From the first press to the last, in beats. */
  lengthBeats: number
  /** The pitch classes played. */
  pitchClasses: ReadonlySet<number>
}

/**
 * When a note was heard against the beat: its `at` less the calibration offset, with the two clock
 * mappings lined up (each lead is how much later its mapping puts the same audio time, so the
 * take's events sit `leadMs` early and the offset `offsetLeadMs` large, against the plain pair).
 * The roll draws at this time too, so a note marked on beat 1 sits on beat 1's line.
 */
export const heard = (take: Take, at: number) =>
  take.offsetMs === null ? at : at - take.offsetMs + (take.leadMs ?? 0) - (take.offsetLeadMs ?? 0)

/** One note as the stats count it: the roll marks exactly these flags. */
export interface NoteMark {
  note: TakeNote
  inScale: boolean
  /** Starts on beat 1 or 3 (within STRONG_BEAT_WINDOW, as heard), after the count-in. */
  strong: boolean
  /** A tone of the chord on that beat; false off the strong beats and without the groove. */
  chordTone: boolean
}

/** Every note's flags, in press order. `groove` as for takeStats: null leaves `strong` false. */
export function noteMarks(take: Take, groove: Groove | null): NoteMark[] {
  const scale = scalePcs(take.scale, take.tonic)
  return takeNotes(take).map((note) => {
    const tick = tickAt(take, heard(take, note.start))
    const beat = Math.round(tick / PPQ)
    const strong =
      groove !== null &&
      beat >= 0 &&
      beat % 2 === 0 &&
      Math.abs(tick - beat * PPQ) <= STRONG_BEAT_WINDOW
    return {
      note,
      inScale: scale.includes(pc(note.note)),
      strong,
      // The chord on the beat itself, so a note a hair early on a change meets the new chord.
      chordTone: strong && harmonyAt(groove!, beat * PPQ).chordTones.includes(pc(note.note)),
    }
  })
}

/**
 * The take's stats, counted from `marks` (noteMarks of the same take and groove). `groove` is the
 * take's groove in the take's key, or null when the app no longer has it (then there are no
 * chords to compare with).
 */
export function takeStats(
  take: Take,
  groove: Groove | null,
  marks: readonly NoteMark[] = noteMarks(take, groove),
): TakeStats {
  const notes = marks.map((m) => m.note)
  const pitches = notes.map((n) => n.note)

  let longestRest: TakeStats['longestRest'] = null
  let lastUp = -Infinity
  for (const n of notes) {
    const rest = n.start - lastUp
    if (lastUp > -Infinity && (!longestRest || rest > longestRest.end - longestRest.start))
      longestRest = { start: lastUp, end: Math.max(lastUp, n.start) }
    lastUp = Math.max(lastUp, n.end)
  }

  const beatMs = 60_000 / take.bpm
  return {
    notes: notes.length,
    lowest: pitches.length ? Math.min(...pitches) : null,
    highest: pitches.length ? Math.max(...pitches) : null,
    inScale: notes.length ? marks.filter((m) => m.inScale).length / notes.length : null,
    strongBeats: groove
      ? {
          notes: marks.filter((m) => m.strong).length,
          chordTones: marks.filter((m) => m.chordTone).length,
        }
      : null,
    longestRestMs: longestRest && longestRest.end - longestRest.start,
    longestRest,
    lengthBeats: notes.length ? (notes.at(-1)!.start - notes[0]!.start) / beatMs : 0,
    pitchClasses: new Set(pitches.map(pc)),
  }
}

/** One thing to try next; the Takes card words it. */
export type Suggestion = 'longer' | 'space' | 'blueNote' | 'land' | 'range' | 'scale' | 'repeat'

/** The minor blues scale's blue note: the flat fifth above the tonic. */
export const blueNote = (tonic: number) => pc(tonic + 6)

/** The first rule that applies, in this order; 'repeat' when none does. */
export function suggest(s: TakeStats, take: Take): Suggestion {
  const beatMs = 60_000 / take.bpm
  if (s.notes < SUGGEST.minNotes) return 'longer'
  if (s.lengthBeats >= SUGGEST.spaceAfterBeats && (s.longestRestMs ?? 0) < BEATS_PER_BAR * beatMs)
    return 'space'
  if (take.scale === 'minor blues' && !s.pitchClasses.has(blueNote(take.tonic))) return 'blueNote'
  if (
    s.strongBeats &&
    s.strongBeats.notes >= SUGGEST.minStrongBeatNotes &&
    s.strongBeats.chordTones / s.strongBeats.notes < SUGGEST.chordToneShare
  )
    return 'land'
  if (s.highest! - s.lowest! < SUGGEST.minRange) return 'range'
  if (s.inScale! < SUGGEST.inScaleShare) return 'scale'
  return 'repeat'
}

/**
 * Where the suggestion's evidence sits on the roll, where it has some:
 * - bar (space): the busiest bar, the most presses starting in it as heard (the first on a tie):
 *   the bar with no space in it. Groove ticks of its start, negative in the count-in.
 * - ghost (blueNote): the first whole-tone step between the 4th and the 5th, either way, where
 *   the blue note fits: that pitch, halfway between the two presses (take ms, raw).
 * - notes: the notes on 1 and 3 that aren't chord tones (land), or outside the scale (scale).
 */
export type Evidence =
  | { kind: 'bar'; startTick: number }
  | { kind: 'ghost'; note: number; at: number }
  | { kind: 'notes'; notes: readonly TakeNote[] }

export function evidence(s: Suggestion, take: Take, marks: readonly NoteMark[]): Evidence | null {
  const bar = BEATS_PER_BAR * PPQ
  switch (s) {
    case 'space': {
      const count = new Map<number, number>()
      let best: number | null = null
      for (const m of marks) {
        const b = Math.floor(tickAt(take, heard(take, m.note.start)) / bar)
        count.set(b, (count.get(b) ?? 0) + 1)
        if (best === null || count.get(b)! > count.get(best)!) best = b
      }
      return best === null ? null : { kind: 'bar', startTick: best * bar }
    }
    case 'blueNote': {
      const ends = [pc(take.tonic + 5), pc(take.tonic + 7)]
      for (let i = 1; i < marks.length; i++) {
        const a = marks[i - 1]!.note
        const b = marks[i]!.note
        const step = Math.abs(a.note - b.note) === 2
        if (step && ends.includes(pc(a.note)) && ends.includes(pc(b.note)))
          return { kind: 'ghost', note: Math.min(a.note, b.note) + 1, at: (a.start + b.start) / 2 }
      }
      return null
    }
    case 'land':
      return {
        kind: 'notes',
        notes: marks.filter((m) => m.strong && !m.chordTone).map((m) => m.note),
      }
    case 'scale':
      return { kind: 'notes', notes: marks.filter((m) => !m.inScale).map((m) => m.note) }
    default:
      return null
  }
}
