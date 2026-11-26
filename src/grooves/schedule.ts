// The groove as a list of timed events, one bar at a time: what the player (src/audio/tone/
// groove.ts) sends to the drums, bass and chords. Pure, so the schedule is tested as data.
//
// Ticks are groove ticks (0 = the first beat of the groove, PPQ per beat), swung by stepTick.
// Every pattern loops on its own length and the bar index keeps counting up, so loop
// boundaries need no special case: a note that crosses one ends in the next bar's events.

import { degreeSemitones, pc } from '../music/harmony.ts'
import {
  BEATS_PER_BAR,
  harmonyAt,
  PPQ,
  stepTick,
  STEPS_PER_BEAT,
  type DrumVoice,
  type Groove,
  type Hit,
} from './groove.ts'

export const BAR_TICKS = BEATS_PER_BAR * PPQ
const STEP_TICKS = PPQ / STEPS_PER_BEAT
const STEPS_PER_BAR = BEATS_PER_BAR * STEPS_PER_BEAT

export type PitchedPart = 'bass' | 'chords'

export type GrooveEvent =
  | { tick: number; kind: 'drum'; voice: DrumVoice; velocity: number }
  /** A count-in click; the first of the bar is accented. */
  | { tick: number; kind: 'click'; accent: boolean }
  /** `id` pairs an on with its off, so the player can end the pitch it started even if the key changed. */
  | { tick: number; kind: 'on'; part: PitchedPart; id: string; note: number; velocity: number }
  | { tick: number; kind: 'off'; part: PitchedPart; id: string; note: number }

// At one tick, offs go first: the mono bass must release a note before the next one starts,
// or a repeated pitch never re-attacks and a new one glides.
const ORDER: Record<GrooveEvent['kind'], number> = { off: 0, click: 1, drum: 1, on: 2 }

/** MIDI notes of a chord voicing (see Groove.chords.voicing), lowest at or above `register`. */
export function voicingNotes(
  root: number,
  tones: readonly number[],
  voicing: readonly number[],
  register: number,
): number[] {
  // Semitones above the root, rising: a 9th (pitch class 2) sits above the 7th, not below the 3rd.
  const above: number[] = []
  for (const t of tones) {
    let s = pc(t - root)
    while (above.length > 0 && s <= above.at(-1)!) s += 12
    above.push(s)
  }
  const offsets = voicing.map((i) => above[i % above.length]! + 12 * Math.floor(i / above.length))
  const lowest = register + pc(root + offsets[0]! - register)
  return offsets.map((o) => lowest + o - offsets[0]!)
}

/** MIDI note of a bass degree over a chord, its root at or above the register. */
export function bassNote(
  root: number,
  quality: string,
  degree: number,
  octave: number,
  register: number,
): number {
  return register + pc(root - register) + degreeSemitones(quality, degree) + 12 * octave
}

/** The count-in bar's clicks, at negative ticks: the bar before the groove starts. */
export function countInEvents(): GrooveEvent[] {
  return Array.from({ length: BEATS_PER_BAR }, (_, beat) => ({
    tick: (beat - BEATS_PER_BAR) * PPQ,
    kind: 'click' as const,
    accent: beat === 0,
  }))
}

/**
 * Every event whose tick falls in groove bar `bar` (0-based, counting up past the groove's
 * length as it loops), sorted by tick, offs first at a tick.
 */
export function barEvents(groove: Groove, bar: number): GrooveEvent[] {
  const first = bar * STEPS_PER_BAR
  const end = first + STEPS_PER_BAR
  const tick = (step: number) => stepTick(step, groove.swing)
  const inBar = (step: number) => step >= first && step < end
  const events: GrooveEvent[] = []

  for (const [voice, pattern] of Object.entries(groove.drums) as [DrumVoice, number[]][]) {
    if (pattern.length === 0) continue
    for (let s = first; s < end; s++) {
      const velocity = pattern[s % pattern.length]!
      if (velocity > 0) events.push({ tick: tick(s), kind: 'drum', voice, velocity })
    }
  }

  /** Ons starting in this bar and offs ending in it, for a looping pattern of pitched hits. */
  function pitched<H extends Hit>(
    part: PitchedPart,
    steps: number,
    hits: readonly H[],
    notesOf: (hit: H, step: number) => number[],
  ) {
    // Notes that started up to their own length before this bar can end in it.
    const longest = Math.max(0, ...hits.map((h) => h.length))
    const from = Math.max(0, first - longest)
    for (let s = from; s < end; s++) {
      hits.forEach((hit, i) => {
        if (hit.step !== s % steps) return
        const stop = s + hit.length
        if (!inBar(s) && !inBar(stop)) return
        notesOf(hit, s).forEach((note, n) => {
          const id = `${part}:${s}:${i}:${n}`
          if (inBar(s))
            events.push({ tick: tick(s), kind: 'on', part, id, note, velocity: hit.velocity })
          if (inBar(stop)) events.push({ tick: tick(stop), kind: 'off', part, id, note })
        })
      })
    }
  }

  // The harmony is read where the note starts, unswung.
  const chordAt = (step: number) => harmonyAt(groove, step * STEP_TICKS)
  const { bass, chords } = groove
  pitched('bass', bass.steps, bass.notes, (n, s) => {
    const h = chordAt(s)
    return [bassNote(h.chordRoot, h.chordQuality, n.degree, n.octave ?? 0, bass.register)]
  })
  pitched('chords', chords.steps, chords.hits, (_, s) => {
    const h = chordAt(s)
    return voicingNotes(h.chordRoot, h.chordTones, chords.voicing, chords.register)
  })

  return events.sort((a, b) => a.tick - b.tick || ORDER[a.kind] - ORDER[b.kind])
}
