// The piano roll for a take (P1-T7): the keys you pressed as bars over the groove's chord
// timeline, a strip of chord symbols along the top. No notation: chord symbols and C-octave
// names only. Notes outside the scale are dimmed toward the well, never red, like jam mode's
// keyboard; chord tones are brightest. Drawn once per change (a take chosen, a resize), never
// per note. Colours are the theme's (src/index.css).
//
// shortcut: the whole take fits the width, so a long take gets thin notes, and there's no
// playhead during replay (the keyboard lights the replayed keys); add scrolling and a playhead
// if takes run long.

import { Note } from 'tonal'
import { tickAt, type Take, type TakeNote } from '../../analysis/take.ts'
import { harmonyAt, PPQ, stepIndexAt, type Groove } from '../../grooves/groove.ts'
import { BAR_TICKS } from '../../grooves/schedule.ts'
import type { ScaleId } from '../../music/harmony.ts'
import { tierOf, type Tier } from '../../music/highlight.ts'
import { chordSymbol } from '../../music/spelling.ts'

/** The chord strip's height and the left gutter for octave names, CSS px. */
export const ROLL_STRIP = 24
export const ROLL_GUTTER = 34

/** Rows the roll shows at least, so a few notes don't fill it. */
const MIN_ROWS = 25

const WELL = '#120d0b'
const BIN = '#1c1512'
const CARD = '#2a201a'
const CARD_RAISED = '#352920'
const RULE = '#3d2f26'
const LINE = '#8a7462'
const BONE = '#f1e8da'
const BONE_MUTED = '#bfb09c'
const NOTE_FILL: Record<Tier, string> = { chord: BONE, scale: BONE_MUTED, other: LINE }
const LABEL_FONT = '600 13px system-ui, sans-serif'
const SMALL_FONT = '600 11px system-ui, sans-serif'

/** The pitches shown, low to high inclusive: the notes played and a little room, MIN_ROWS at least. */
export function pitchRange(notes: readonly TakeNote[]): [number, number] {
  if (notes.length === 0) return [48, 48 + MIN_ROWS - 1]
  let lo = Math.min(...notes.map((n) => n.note)) - 2
  let hi = Math.max(...notes.map((n) => n.note)) + 2
  const short = MIN_ROWS - (hi - lo + 1)
  if (short > 0) {
    lo -= Math.floor(short / 2)
    hi += Math.ceil(short / 2)
  }
  const shift = lo < 0 ? -lo : hi > 127 ? 127 - hi : 0
  return [Math.max(0, lo + shift), Math.min(127, hi + shift)]
}

/** One progression step across [start, end) groove ticks. */
export interface ChordSpan {
  start: number
  end: number
  /** Index into the groove's progression. */
  step: number
}

/** The chords over groove ticks [from, to), from tick 0 (the count-in has no chord of its own). */
export function chordSpans(groove: Groove, from: number, to: number): ChordSpan[] {
  const starts: number[] = []
  let total = 0
  for (const s of groove.progression) {
    starts.push(total)
    total += s.beats * PPQ
  }
  const spans: ChordSpan[] = []
  for (let t = Math.max(0, from); t < to;) {
    const step = stepIndexAt(groove, t)
    const end = Math.min(
      to,
      t - (t % total) + starts[step]! + groove.progression[step]!.beats * PPQ,
    )
    spans.push({ start: t, end, step })
    t = end
  }
  return spans
}

export interface RollView {
  width: number
  height: number
  take: Take
  /** The take's groove in the take's key. */
  groove: Groove
  scale: ScaleId
  notes: readonly TakeNote[]
  /** Note names by pitch class, spelled by the scale and key (noteNames). */
  names: readonly string[]
}

const isBlack = (note: number) => [1, 3, 6, 8, 10].includes(note % 12)

export function drawRoll(ctx: CanvasRenderingContext2D, v: RollView) {
  const { width, height, take } = v
  const [lo, hi] = pitchRange(v.notes)
  const rowH = (height - ROLL_STRIP) / (hi - lo + 1)
  const span = Math.max(take.lengthMs, 1)
  const x = (ms: number) => ROLL_GUTTER + (ms / span) * (width - ROLL_GUTTER)
  const xOfTick = (tick: number) =>
    x(((tick + (take.countIn ? BAR_TICKS : 0)) / PPQ / take.bpm) * 60_000)
  const y = (note: number) => ROLL_STRIP + (hi - note) * rowH

  ctx.fillStyle = WELL
  ctx.fillRect(0, 0, width, height)
  // Rows: lighter for white keys, so the roll reads like the keyboard turned on its side.
  ctx.fillStyle = BIN
  for (let n = lo; n <= hi; n++) if (!isBlack(n)) ctx.fillRect(ROLL_GUTTER, y(n), width, rowH)

  // The chord strip, and a line where each chord starts.
  const endTick = tickAt(take, take.lengthMs)
  ctx.textBaseline = 'middle'
  if (take.countIn) {
    ctx.fillStyle = BONE_MUTED
    ctx.font = SMALL_FONT
    fitText(ctx, 'Count-in', x(0) + 6, ROLL_STRIP / 2, xOfTick(0) - x(0) - 8)
  }
  chordSpans(v.groove, 0, endTick).forEach((c, i) => {
    const left = xOfTick(c.start)
    const right = xOfTick(c.end)
    ctx.fillStyle = i % 2 ? CARD_RAISED : CARD
    ctx.fillRect(left, 0, right - left, ROLL_STRIP)
    ctx.fillStyle = RULE
    ctx.fillRect(Math.round(left), ROLL_STRIP, 1, height - ROLL_STRIP)
    ctx.fillStyle = BONE
    ctx.font = LABEL_FONT
    const symbol = chordSymbol(harmonyAt(v.groove, c.start, v.scale), v.names)
    fitText(ctx, symbol, left + 6, ROLL_STRIP / 2, right - left - 8)
  })

  // C rows named in the gutter, with a hairline under each C.
  ctx.font = SMALL_FONT
  for (let n = lo; n <= hi; n++) {
    if (n % 12 !== 0) continue
    ctx.fillStyle = RULE
    ctx.fillRect(ROLL_GUTTER, Math.round(y(n) + rowH) - 1, width - ROLL_GUTTER, 1)
    ctx.fillStyle = BONE_MUTED
    ctx.fillText(Note.fromMidi(n), 4, y(n) + rowH / 2)
  }

  // Notes: brightness by tier at the chord they start on, softer when played softly.
  for (const n of v.notes) {
    if (n.note < lo || n.note > hi) continue
    const tier = tierOf(n.note, harmonyAt(v.groove, Math.max(0, tickAt(take, n.start)), v.scale), 2)
    ctx.globalAlpha = 0.55 + 0.45 * n.velocity
    ctx.fillStyle = NOTE_FILL[tier ?? 'other']
    const left = x(n.start)
    ctx.beginPath()
    ctx.roundRect(left, y(n.note) + 1, Math.max(3, x(n.end) - left), Math.max(2, rowH - 2), 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

/** Draws text if it fits in `room` px. */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, room: number) {
  if (ctx.measureText(text).width <= room) ctx.fillText(text, x, y)
}
