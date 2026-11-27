// Gentle stats after a take (P1-T8): what you played, never a score, and one thing to try next.
// Pure: no DOM, no Tone, no React. Pitches stay MIDI numbers; the Takes card names them.
//
// shortcut: the take doesn't store the split or the pedal mode, so left-hand notes count in the
// range and the scale, and a rest with the sustain pedal down still counts as a rest; store both
// in the take if the stats read wrong for split playing.

import { harmonyAt, PPQ, BEATS_PER_BAR, type Groove } from '../grooves/groove.ts'
import { pc, scalePcs } from '../music/harmony.ts'
import { takeNotes, tickAt, type Take } from './take.ts'

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
  /** From the first press to the last, in beats. */
  lengthBeats: number
  /** The pitch classes played. */
  pitchClasses: ReadonlySet<number>
}

/**
 * When a note was heard against the beat: its `at` less the calibration offset, with the two clock
 * mappings lined up (each lead is how much later its mapping puts the same audio time, so the
 * take's events sit `leadMs` early and the offset `offsetLeadMs` large, against the plain pair).
 */
const heard = (take: Take, at: number) =>
  take.offsetMs === null ? at : at - take.offsetMs + (take.leadMs ?? 0) - (take.offsetLeadMs ?? 0)

/**
 * The take's stats. `groove` is the take's groove in the take's key, or null when the app no
 * longer has it (then there are no chords to compare with).
 */
export function takeStats(take: Take, groove: Groove | null): TakeStats {
  const notes = takeNotes(take)
  const scale = scalePcs(take.scale, take.tonic)
  const pitches = notes.map((n) => n.note)

  let strongBeats: TakeStats['strongBeats'] = null
  if (groove) {
    strongBeats = { notes: 0, chordTones: 0 }
    for (const n of notes) {
      const tick = tickAt(take, heard(take, n.start))
      const beat = Math.round(tick / PPQ)
      if (beat < 0 || beat % 2 !== 0 || Math.abs(tick - beat * PPQ) > STRONG_BEAT_WINDOW) continue
      strongBeats.notes++
      // The chord on the beat itself, so a note a hair early on a change meets the new chord.
      if (harmonyAt(groove, beat * PPQ).chordTones.includes(pc(n.note))) strongBeats.chordTones++
    }
  }

  let longestRestMs: number | null = null
  let lastUp = -Infinity
  for (const n of notes) {
    if (lastUp > -Infinity) longestRestMs = Math.max(longestRestMs ?? 0, n.start - lastUp)
    lastUp = Math.max(lastUp, n.end)
  }

  const beatMs = 60_000 / take.bpm
  return {
    notes: notes.length,
    lowest: pitches.length ? Math.min(...pitches) : null,
    highest: pitches.length ? Math.max(...pitches) : null,
    inScale: notes.length
      ? pitches.filter((p) => scale.includes(pc(p))).length / notes.length
      : null,
    strongBeats,
    longestRestMs,
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
