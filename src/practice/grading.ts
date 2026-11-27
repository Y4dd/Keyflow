// Grading and the hint ladder (P2-T4). Pure: no DOM, no Tone, no React. An attempt
// (drills.ts) becomes an FSRS rating by learning-design.md's table, and a stalled attempt gets
// hints in steps (anchor, method, answer) whose first delay grows with the item's stability.

import { Note } from 'tonal'
import type { Grade } from 'ts-fsrs'
import { pc } from '../music/harmony.ts'
import { SCALE_BPM, type Drill } from './drills.ts'

/** ts-fsrs's Rating values, without loading ts-fsrs at app start. */
export const RATING = { again: 1, hard: 2, good: 3, easy: 4 } as const satisfies Record<
  string,
  Grade
>

/** Hint pacing: the first hint for a new item, its cap, and the gap to each next step. */
export interface Pacing {
  firstMs: number
  maxFirstMs: number
  stepMs: number
}

/** Starting values (learning-design.md), to be tuned with real data. */
export const GRADING = {
  targetMs: { note: 2000, triad: 3000, seventh: 4000 },
  /** A scale's target is this, to find the first note, plus the run at the drill's tempo. */
  scaleReactMs: 2000,
  /** The hint pace profiles, auditioned in P2-T4's manual check; one becomes the default. */
  pacing: {
    quick: { firstMs: 4000, maxFirstMs: 15000, stepMs: 4000 },
    steady: { firstMs: 6000, maxFirstMs: 24000, stepMs: 6000 },
    patient: { firstMs: 10000, maxFirstMs: 40000, stepMs: 8000 },
  } satisfies Record<string, Pacing>,
}

export type PacingId = keyof typeof GRADING.pacing

/** The time a drill should take, and under which (with no wrong notes and no hints) it's Easy. */
export function targetOf(drill: Drill): { ms: number; easyMs: number } {
  const t = GRADING.targetMs
  if (drill.kind === 'scale') {
    // The run itself can't get much faster (gaps are held to the tempo), so only the time to
    // find the first note is halved for Easy.
    const run = ((drill.target.length - 1) * 60000) / (drill.bpm ?? SCALE_BPM)
    return { ms: GRADING.scaleReactMs + run, easyMs: GRADING.scaleReactMs / 2 + run }
  }
  // shortcut: 9ths (5 tones) take the 7th target plus 1 s; give them their own once drilled.
  const ms =
    drill.kind === 'note'
      ? t.note
      : drill.tones.length <= 3
        ? t.triad
        : t.seventh + (drill.tones.length > 4 ? 1000 : 0)
  return { ms, easyMs: ms / 2 }
}

export interface Graded {
  /** The right answer came. */
  done: boolean
  ms: number | null
  /** The highest hint step shown, 0 for none. */
  hintLevel: number
  wrongNotes: number
}

/** learning-design.md, "Grading → FSRS rating". */
export function rate(a: Graded, target: { ms: number; easyMs: number }): Grade {
  if (!a.done || a.ms === null || a.hintLevel >= 3) return RATING.again
  if (a.hintLevel > 0 || a.ms > target.ms) return RATING.hard
  if (a.ms < target.easyMs && a.wrongNotes === 0) return RATING.easy
  return RATING.good
}

/**
 * Milliseconds of stall before each hint step from the drill's first: the first grows with
 * FSRS stability (days), so a well-known item gets time to be recalled unaided.
 */
export function hintDelays(stability: number, pacing: Pacing, steps: number): number[] {
  const first = Math.min(pacing.maxFirstMs, pacing.firstMs * (1 + Math.log2(1 + stability)))
  return Array.from({ length: steps }, (_, i) => (i === 0 ? first : pacing.stepMs))
}

export interface Hint {
  level: 1 | 2 | 3
  say: string
  /** Keys to mark on the canvas keyboard, each with its label. */
  keys: { note: number; label: string }[]
}

const AGAIN = 'then once more on your own.'

/**
 * The hint ladder for a drill (learning-design.md), from its `hintStart`. Find the note has no
 * anchor that isn't the answer, so its key lights only at step 3; chord in key anchors on the
 * key's tonic, since the chord's root would answer the riddle.
 */
export function hintsFor(drill: Drill): Hint[] {
  const name = (note: number) => drill.names[pc(note)]!
  const mark = (note: number, label = name(note)) => ({ note, label })
  let ladder: Hint[]

  if (drill.kind === 'note') {
    // C, the white key left of the two black ones; for C itself, F left of the three.
    const anchor = drill.pc === 0 ? 65 : 60
    const where = drill.pc === 0 ? 'left of the three black keys' : 'left of the two black keys'
    ladder = [
      {
        level: 1,
        say: `Start from ${name(anchor)}, the white key ${where}.`,
        keys: [mark(anchor)],
      },
      {
        level: 2,
        say: `${name(drill.pc)} is ${pc(drill.pc - anchor)} half-steps above ${name(anchor)}.`,
        keys: [mark(anchor)],
      },
      {
        level: 3,
        say: `This is ${name(drill.pc)}. Play it, ${AGAIN}`,
        keys: [mark(drill.answer[0]!)],
      },
    ]
  } else if (drill.kind === 'scale') {
    const first = drill.target[0]!
    const up = [...new Set(drill.target)].sort((a, b) => a - b)
    // step 2 names the steps but marks only the root: marking every key would be step 3
    const steps = up.slice(1).map((n, i) => `+${n - up[i]!}`)
    ladder = [
      { level: 1, say: `Start on ${name(first)}.`, keys: [mark(first)] },
      {
        level: 2,
        say: `Up from ${name(up[0]!)}: ${steps.join(', ')} half-steps.`,
        keys: [mark(up[0]!)],
      },
      { level: 3, say: `These keys, in order: play them, ${AGAIN}`, keys: up.map((n) => mark(n)) },
    ]
  } else {
    // the root in the answer's octave, then the tones stacked up from it with their steps
    const rootNote = drill.answer.find((n) => pc(n) === drill.tones[0])!
    const stacked = [rootNote]
    for (const t of drill.tones.slice(1)) stacked.push(stacked.at(-1)! + pc(t - stacked.at(-1)!))
    const counted = stacked.map((n, i) => mark(n, i === 0 ? 'R' : `+${n - stacked[i - 1]!}`))
    const answer = {
      level: 3,
      say: `This is ${drill.chordName}. Play it, ${AGAIN}`,
      keys: drill.answer.map((n) => mark(n)),
    } as const
    if (drill.kind === 'chordInKey') {
      const [, tonicName, mode] = drill.item.split(':')
      const tonic = rootNote - pc(drill.tones[0]! - Note.chroma(tonicName!)!)
      ladder = [
        {
          level: 1,
          say: `Count up the ${name(tonic)} ${mode} scale from ${name(tonic)}.`,
          keys: [mark(tonic)],
        },
        { level: 2, say: `It’s built on ${name(rootNote)}: ${drill.formula}.`, keys: counted },
        answer,
      ]
    } else {
      ladder = [
        { level: 1, say: `Start from ${name(rootNote)}.`, keys: [mark(rootNote)] },
        { level: 2, say: `From ${name(rootNote)}: ${drill.formula}.`, keys: counted },
        answer,
      ]
    }
  }
  return ladder.filter((h) => h.level >= drill.hintStart)
}
