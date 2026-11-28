// The piano roll for a take (P1-T7): the keys you pressed as bars over the groove's chord
// timeline, a strip of chord symbols along the top. No notation: chord symbols and C-octave
// names only. Notes are marked by what the take's stats count (P2-T11, the flags from
// noteMarks): chord tones on beats 1 and 3 brightest, scale tones filled, notes outside the
// scale hollow and dimmed toward the well, never red. Bar lines and beats 1 and 3 sit behind
// the notes, the longest rest is shaded, and the suggestion's evidence is drawn in dashed bone.
// The caller reads state each frame and calls this only when something changed. Colours are
// the theme's (src/index.css).
//
// shortcut: the whole take fits the width, so a long take gets thin notes, and there's no
// playhead during replay (the keyboard lights the replayed keys); add scrolling and a playhead
// if takes run long.

import { Note } from 'tonal'
import { heard, type Evidence, type NoteMark, type TakeStats } from '../../analysis/stats.ts'
import { tickAt, type Take, type TakeNote } from '../../analysis/take.ts'
import { BEATS_PER_BAR, harmonyAt, PPQ, stepIndexAt, type Groove } from '../../grooves/groove.ts'
import { BAR_TICKS } from '../../grooves/schedule.ts'
import type { ScaleId } from '../../music/harmony.ts'
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
const KRAFT = '#c8a271'
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

/**
 * How strong-beat chord tones are marked (P2-T11 taste candidates; the pick stays, the rest go):
 * fill (brightest bone), dot (a dot over the note's head: filled for a chord tone, a ring for
 * another note on 1 or 3), ring (bone outline with a gap), kraft (the tabs' tan).
 */
export const ROLL_LOOKS = ['fill', 'dot', 'ring', 'kraft'] as const
export type RollLook = (typeof ROLL_LOOKS)[number]

/** Which stat is hovered or focused: its notes stay lit, the rest fade. */
export type RollFocus = 'range' | 'inScale' | 'strong' | 'rest' | null

export interface RollView {
  width: number
  height: number
  take: Take
  /** The take's groove in the take's key. */
  groove: Groove
  scale: ScaleId
  /** noteMarks of the take: one per note, the flags the stats count. */
  marks: readonly NoteMark[]
  stats: TakeStats
  evidence: Evidence | null
  focus: RollFocus
  look: RollLook
  /** Note names by pitch class, spelled by the scale and key (noteNames). */
  names: readonly string[]
}

const isBlack = (note: number) => [1, 3, 6, 8, 10].includes(note % 12)

/** Whether a stat counts this note, so it stays lit while that stat is in focus. */
function counted(focus: RollFocus, m: NoteMark, s: TakeStats) {
  switch (focus) {
    case null:
      return true
    case 'range':
      return m.note.note === s.lowest || m.note.note === s.highest
    case 'inScale':
      return m.inScale
    case 'strong':
      return m.strong
    case 'rest':
      return false
  }
}

export function drawRoll(ctx: CanvasRenderingContext2D, v: RollView) {
  const { width, height, take, stats, focus, look } = v
  const notes = v.marks.map((m) => m.note)
  const [lo, hi] = pitchRange(notes)
  const rowH = (height - ROLL_STRIP) / (hi - lo + 1)
  const span = Math.max(take.lengthMs, 1)
  const x = (ms: number) => ROLL_GUTTER + (ms / span) * (width - ROLL_GUTTER)
  // Notes, the rest and the ghost sit where they were heard, so they line up with the beat lines.
  const xHeard = (ms: number) => x(heard(take, ms))
  const xOfTick = (tick: number) =>
    x(((tick + (take.countIn ? BAR_TICKS : 0)) / PPQ / take.bpm) * 60_000)
  const y = (note: number) => ROLL_STRIP + (hi - note) * rowH
  const bodyH = height - ROLL_STRIP

  ctx.fillStyle = WELL
  ctx.fillRect(0, 0, width, height)
  // Rows: lighter for white keys, so the roll reads like the keyboard turned on its side.
  ctx.fillStyle = BIN
  for (let n = lo; n <= hi; n++) if (!isBlack(n)) ctx.fillRect(ROLL_GUTTER, y(n), width, rowH)

  // The longest rest, shaded down the whole roll; brighter while its stat is in focus.
  if (stats.longestRest && stats.longestRestMs! > 0) {
    const left = xHeard(stats.longestRest.start)
    const w = xHeard(stats.longestRest.end) - left
    ctx.fillStyle = focus === 'rest' ? CARD_RAISED : CARD
    ctx.globalAlpha = focus === 'rest' ? 1 : 0.7
    ctx.fillRect(left, ROLL_STRIP, w, bodyH)
    ctx.globalAlpha = 1
    ctx.fillStyle = focus === 'rest' ? BONE_MUTED : RULE
    ctx.fillRect(Math.round(left), ROLL_STRIP, 1, bodyH)
    ctx.fillRect(Math.round(left + w) - 1, ROLL_STRIP, 1, bodyH)
  }

  // Beats 1 and 3 behind the notes, bar lines stronger; none in the count-in, and beat 3 only
  // where the beats are far enough apart to read.
  const endTick = tickAt(take, take.lengthMs)
  const beatPx = xOfTick(PPQ) - xOfTick(0)
  for (let beat = 0; beat * PPQ <= endTick; beat += 2) {
    const bar = beat % BEATS_PER_BAR === 0
    if (!bar && beatPx < 6) continue
    ctx.fillStyle = bar ? LINE : RULE
    ctx.globalAlpha = bar ? 0.8 : 1
    ctx.fillRect(Math.round(xOfTick(beat * PPQ)), ROLL_STRIP, 1, bodyH)
  }
  ctx.globalAlpha = 1

  // The chord strip, and a line where each chord starts.
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

  // The suggestion's evidence, under the notes: the busiest bar bracketed under the strip.
  const ev = v.evidence
  ctx.setLineDash([4, 3])
  ctx.strokeStyle = BONE
  ctx.lineWidth = 1.5
  if (ev?.kind === 'bar') {
    const left = xOfTick(ev.startTick)
    const right = xOfTick(ev.startTick + BAR_TICKS)
    ctx.strokeRect(left + 1, ROLL_STRIP + 1, right - left - 2, bodyH - 2)
  }

  // Notes: shape and brightness by their flags, softer when played softly.
  const box = (n: TakeNote) => {
    const left = xHeard(n.start)
    return [left, y(n.note) + 1, Math.max(3, xHeard(n.end) - left), Math.max(2, rowH - 2)] as const
  }
  ctx.setLineDash([])
  for (const m of v.marks) {
    const n = m.note
    if (n.note < lo || n.note > hi) continue
    const [bx, by, bw, bh] = box(n)
    const lit = counted(focus, m, stats)
    const alpha = (0.55 + 0.45 * n.velocity) * (lit ? 1 : 0.18)
    ctx.globalAlpha = alpha
    ctx.beginPath()
    // Fill and kraft draw a chord tone on 1 or 3 taller too, so it isn't told by colour alone.
    const tall = m.chordTone && (look === 'fill' || look === 'kraft') ? 2 : 0
    ctx.roundRect(bx, by - tall, bw, bh + 2 * tall, 2)
    if (!m.inScale && !m.chordTone) {
      // Outside the scale: a hollow outline, dimmed.
      ctx.strokeStyle = LINE
      ctx.lineWidth = 1.5
      ctx.stroke()
    } else {
      const bright = m.chordTone && look !== 'dot'
      ctx.fillStyle = bright ? (look === 'kraft' ? KRAFT : BONE) : BONE_MUTED
      ctx.fill()
      if (m.chordTone && look === 'ring') {
        ctx.beginPath()
        ctx.roundRect(bx - 2.5, by - 2.5, bw + 5, bh + 5, 3)
        ctx.strokeStyle = BONE
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }
    // Every note on 1 or 3 gets a head mark: a notch, or in the dot look a dot over the head
    // (filled for a chord tone, a ring for another note).
    if (m.strong) {
      ctx.fillStyle = BONE
      if (look === 'dot') {
        const r = Math.max(2, Math.min(4, rowH / 2))
        ctx.beginPath()
        ctx.arc(bx + r, by - r - 1, r, 0, Math.PI * 2)
        if (m.chordTone) ctx.fill()
        else {
          ctx.strokeStyle = BONE
          ctx.lineWidth = 1
          ctx.stroke()
        }
      } else if (!m.chordTone) ctx.fillRect(bx, by - 2, 2, bh + 4)
    }
  }
  ctx.globalAlpha = 1

  // Over the notes: rings round the notes the suggestion counts, and the blue note's ghost.
  ctx.setLineDash([4, 3])
  ctx.strokeStyle = BONE
  ctx.lineWidth = 1.5
  if (ev?.kind === 'notes')
    for (const n of ev.notes) {
      if (n.note < lo || n.note > hi) continue
      const [bx, by, bw, bh] = box(n)
      ctx.beginPath()
      ctx.roundRect(bx - 3, by - 3, bw + 6, bh + 6, 4)
      ctx.stroke()
    }
  if (ev?.kind === 'ghost' && ev.note >= lo && ev.note <= hi) {
    const left = xHeard(ev.at) - 6
    ctx.beginPath()
    ctx.roundRect(left, y(ev.note) + 1, 12, Math.max(2, rowH - 2), 2)
    ctx.stroke()
  }
  ctx.setLineDash([])
}

/** Draws text if it fits in `room` px. */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, room: number) {
  if (ctx.measureText(text).width <= room) ctx.fillText(text, x, y)
}
