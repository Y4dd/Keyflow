// Draws the 61-key keyboard: held keys lit by velocity, a strip naming each zone's sound, and
// a line at the split point. Called from an animation frame, never per note.

import { Note } from 'tonal'
import { getPreset } from '../../audio/presets/index.ts'
import type { KeyboardLayout, ZoneSound } from '../../audio/zones.ts'
import { heldFill, HIGH_NOTE, LOW_NOTE, type KeyRect, type Rgb } from './keys.ts'

/** Height of the zone strip above the keys, CSS px. */
export const ZONE_STRIP = 16

export const WHITE_KEY: Rgb = [251, 250, 247]
export const BLACK_KEY: Rgb = [36, 32, 46]
const ACCENT: Rgb = [217, 72, 31] // --accent (light theme); the keys are light in both themes
const ZONE_COLORS = { left: '#5b4bb7', main: '#1f7a64' } as const
const OUTLINE = 'rgba(22, 19, 31, 0.3)'

const css = ([r, g, b]: Rgb) => `rgb(${r}, ${g}, ${b})`

export interface KeyboardView {
  width: number
  height: number
  keys: readonly KeyRect[]
  /** Held note → velocity (0..1). */
  held: ReadonlyMap<number, number>
  layout: KeyboardLayout
  /** Computer-key letters by note. */
  letters: ReadonlyMap<number, string>
}

function zoneLabel({ presetId, octave }: ZoneSound) {
  const name = getPreset(presetId).name
  return octave === 0 ? name : `${name} ${octave > 0 ? '+' : '−'}${Math.abs(octave)} oct`
}

/**
 * The x where the split falls: the left edge of the main sound's lowest key, or for a black key
 * its centre (the line between the white keys either side, so the white below stays left).
 */
function splitX(view: KeyboardView): number {
  const { splitNote } = view.layout
  if (splitNote <= LOW_NOTE) return 0
  if (splitNote > HIGH_NOTE) return view.width
  const k = view.keys.find((key) => key.note === splitNote)
  return k ? (k.black ? k.x + k.w / 2 : k.x) : 0
}

export function drawKeyboard(ctx: CanvasRenderingContext2D, view: KeyboardView) {
  const { width, height, keys, held, layout, letters } = view
  ctx.clearRect(0, 0, width, height)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  // Zone strip: the left sound below the split point, the main sound from it up.
  const x = layout.split ? splitX(view) : 0
  ctx.font = '600 10px system-ui, sans-serif'
  const zone = (from: number, to: number, color: string, label: string) => {
    if (to - from < 1) return
    ctx.fillStyle = color
    ctx.fillRect(from, 0, to - from, ZONE_STRIP - 2)
    ctx.fillStyle = '#fff'
    ctx.fillText(label, (from + to) / 2, ZONE_STRIP - 5, Math.max(0, to - from - 4))
  }
  if (layout.split) zone(0, x, ZONE_COLORS.left, zoneLabel(layout.left))
  zone(x, width, ZONE_COLORS.main, zoneLabel(layout.main))

  ctx.font = '10px system-ui, sans-serif'
  for (const k of keys) {
    const velocity = held.get(k.note)
    const base = k.black ? BLACK_KEY : WHITE_KEY
    ctx.fillStyle = css(velocity === undefined ? base : heldFill(base, ACCENT, velocity))
    ctx.fillRect(k.x, k.y, k.w, k.h)
    if (!k.black) {
      ctx.strokeStyle = OUTLINE
      ctx.strokeRect(k.x + 0.5, k.y + 0.5, k.w - 1, k.h - 1)
    }
    const lit = velocity !== undefined
    ctx.fillStyle = k.black || lit ? '#fff' : '#5d586b'
    const letter = letters.get(k.note)
    if (letter) ctx.fillText(letter, k.x + k.w / 2, k.y + k.h - (k.black ? 4 : 18))
    if (!k.black && k.note % 12 === 0)
      ctx.fillText(Note.fromMidiSharps(k.note), k.x + k.w / 2, k.y + k.h - 5)
  }

  if (layout.split && x > 0 && x < width) {
    ctx.fillStyle = ZONE_COLORS.left
    ctx.fillRect(x - 1, 0, 2, height)
  }
}
