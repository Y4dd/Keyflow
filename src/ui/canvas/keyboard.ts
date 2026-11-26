// Draws the 61-key keyboard: held keys lit by velocity in the colour of the sound playing them, a
// strip naming each zone's sound in its colour, a line at the split point, and jam mode's
// highlighting in the chosen look (keys.ts: idleFill and marksOf): Tags (a dark tag on each chord
// tone holding its name) or Spotlight (brightness alone), other keys dimmed toward the well
// (never red), and note names at training wheels 3. Colours are the theme's
// (docs/design/theme.md). Called from an animation frame, never per note.

import { Note } from 'tonal'
import { getPreset } from '../../audio/presets/index.ts'
import type { PresetId } from '../../audio/presets/types.ts'
import { zoneOf, type KeyboardLayout, type ZoneSound } from '../../audio/zones.ts'
import type { HarmonyAt } from '../../music/harmony.ts'
import { tierOf, type Wheels } from '../../music/highlight.ts'
import {
  BLACK_KEY,
  heldFill,
  HIGH_NOTE,
  idleFill,
  LOW_NOTE,
  KRAFT as KRAFT_RGB,
  lum,
  marksOf,
  nameWidth,
  nameY,
  WHITE_KEY,
  type KeyRect,
  type Look,
  type Rgb,
} from './keys.ts'

/** Height of the zone strip above the keys, CSS px. */
export const ZONE_STRIP = 20

/** Each sound's colour (--funk, --wobble, --keys and the rest in src/index.css). */
export const SOUND_COLORS: Record<PresetId, Rgb> = {
  'funk-lead': [255, 123, 46],
  'wobble-bass': [255, 127, 174],
  'ep-keys': [124, 196, 242],
  'round-bass': [162, 139, 255],
  'warm-tines': [63, 207, 192],
}
const BIN = '#1c1512'
const BONE = '#f1e8da'
const LETTER = '#6b5a4c'
const OUTLINE = 'rgba(28, 21, 18, 0.5)'
const LABEL_FONT = '600 12px system-ui, sans-serif'

const css = ([r, g, b]: Rgb) => `rgb(${r}, ${g}, ${b})`
const KRAFT = css(KRAFT_RGB)

export interface KeyboardView {
  width: number
  height: number
  keys: readonly KeyRect[]
  /** Held note → velocity (0..1). */
  held: ReadonlyMap<number, number>
  layout: KeyboardLayout
  /** Computer-key letters by note; empty when they're hidden. */
  letters: ReadonlyMap<number, string>
  /** What to highlight: the shown harmony, the level, note names by pitch class, and the look. */
  jam: { harmony: HarmonyAt; wheels: Wheels; names: readonly string[]; look: Look }
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

/** A mark's colour: dark tags on white keys, light ones on black keys; scale dashes softer. */
const markColor = (black: boolean, chord: boolean): string =>
  chord ? (black ? BONE : BIN) : black ? KRAFT : LETTER

export function drawKeyboard(ctx: CanvasRenderingContext2D, view: KeyboardView) {
  const { width, height, keys, held, layout, letters, jam } = view
  ctx.clearRect(0, 0, width, height)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  // Zone strip: the left sound below the split point, the main sound from it up.
  const x = layout.split ? splitX(view) : 0
  ctx.font = '700 11px system-ui, sans-serif'
  const zone = (from: number, to: number, sound: ZoneSound) => {
    if (to - from < 1) return
    ctx.fillStyle = css(SOUND_COLORS[sound.presetId])
    ctx.fillRect(from, 0, to - from, ZONE_STRIP - 2)
    ctx.fillStyle = BIN
    const label = zoneLabel(sound).toUpperCase()
    ctx.fillText(label, (from + to) / 2, ZONE_STRIP - 5, Math.max(0, to - from - 4))
  }
  if (layout.split) zone(0, x, layout.left)
  zone(x, width, layout.main)

  // Letters and octave names only where they fit; on a phone-width keyboard they smear.
  const labels = (keys.find((k) => !k.black)?.w ?? 0) >= 14
  const named = jam.wheels === 3
  ctx.font = LABEL_FONT // set again only after a note name
  for (const k of keys) {
    const velocity = held.get(k.note)
    const sound = SOUND_COLORS[layout[zoneOf(layout, k.note)].presetId]
    const tier = tierOf(k.note, jam.harmony, jam.wheels)
    const lit = velocity !== undefined
    const fill = lit
      ? heldFill(k.black ? BLACK_KEY : WHITE_KEY, sound, velocity)
      : idleFill(k.black, tier, jam.look, jam.wheels)
    ctx.fillStyle = css(fill)
    ctx.fillRect(k.x, k.y, k.w, k.h)
    if (!k.black) {
      ctx.strokeStyle = OUTLINE
      ctx.strokeRect(k.x + 0.5, k.y + 0.5, k.w - 1, k.h - 1)
    }
    const chord = tier === 'chord'
    const marked = chord || tier === 'scale'
    // A held key's fill covers its marks.
    if (marked && !lit) {
      ctx.fillStyle = markColor(k.black, chord)
      for (const r of marksOf(k, jam.look, chord, named)) {
        ctx.beginPath()
        ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 2)
        ctx.fill()
      }
    }
    if (!labels) continue
    const light = lum(fill) >= 120 // dark text on light fills
    if (marked && named) {
      // Chord tones' names bold. Inside a tag, the name takes the tag's opposite colour.
      const inTag = jam.look === 'tags' && chord && !lit
      ctx.font =
        chord && !k.black
          ? '700 13px system-ui, sans-serif'
          : `${chord ? 700 : 600} 12px system-ui, sans-serif`
      ctx.fillStyle = inTag ? (k.black ? BIN : BONE) : light ? BIN : BONE
      ctx.fillText(jam.names[k.note % 12]!, k.x + k.w / 2, nameY(k, jam.look), nameWidth(k))
      ctx.font = LABEL_FONT
    }
    // The brown letter on idle ivory; bin on other light fills (dimmed and lit keys).
    ctx.fillStyle = !light ? BONE : !lit && lum(fill) > 200 ? LETTER : BIN
    const letter = letters.get(k.note)
    if (letter) ctx.fillText(letter, k.x + k.w / 2, k.y + k.h - (k.black ? 4 : 18))
    if (!k.black && k.note % 12 === 0)
      ctx.fillText(Note.fromMidiSharps(k.note), k.x + k.w / 2, k.y + k.h - 5)
  }

  if (layout.split && x > 0 && x < width) {
    ctx.fillStyle = BIN // dark, so it shows on the light keys
    ctx.fillRect(x - 1, 0, 2, height)
  }
}
