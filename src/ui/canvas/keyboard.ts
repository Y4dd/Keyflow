// Draws the 61-key keyboard: held keys lit by velocity in the colour of the sound playing them, a
// strip naming each zone's sound in its colour, a line at the split point, and jam mode's
// highlighting (P1-T4): a large dot in the zone's sound colour on chord tones, a small kraft dot on
// scale tones, other keys dimmed toward the well (never red), and note names at training wheels 3.
// Colours are the theme's (docs/design/theme.md). Called from an animation frame, never per note.

import { Note } from 'tonal'
import { getPreset } from '../../audio/presets/index.ts'
import type { PresetId } from '../../audio/presets/types.ts'
import { zoneOf, type KeyboardLayout, type ZoneSound } from '../../audio/zones.ts'
import type { HarmonyAt } from '../../music/harmony.ts'
import { tierOf, type Tier, type Wheels } from '../../music/highlight.ts'
import { dotOf, heldFill, HIGH_NOTE, LOW_NOTE, mix, nameY, type KeyRect, type Rgb } from './keys.ts'

/** Height of the zone strip above the keys, CSS px. */
export const ZONE_STRIP = 20

export const WHITE_KEY: Rgb = [239, 230, 214]
export const BLACK_KEY: Rgb = [42, 32, 26]
/** Each sound's colour (--funk, --wobble, --keys in src/index.css). */
const SOUND_COLORS: Record<PresetId, Rgb> = {
  'funk-lead': [255, 123, 46],
  'wobble-bass': [255, 127, 174],
  'ep-keys': [124, 196, 242],
}
const WELL: Rgb = [18, 13, 11] // --well
const KRAFT = '#c8a271'
const BIN = '#1c1512'
const BONE = '#f1e8da'
const LETTER = '#6b5a4c'
const OUTLINE = 'rgba(28, 21, 18, 0.5)'

const css = ([r, g, b]: Rgb) => `rgb(${r}, ${g}, ${b})`

/** An unheld key's fill: notes outside the chord and scale are dimmed toward the well. */
export const idleFill = (black: boolean, tier: Tier | null): Rgb => {
  const base = black ? BLACK_KEY : WHITE_KEY
  return tier === 'other' ? mix(base, WELL, black ? 0.5 : 0.45) : base
}

export interface KeyboardView {
  width: number
  height: number
  keys: readonly KeyRect[]
  /** Held note → velocity (0..1). */
  held: ReadonlyMap<number, number>
  layout: KeyboardLayout
  /** Computer-key letters by note. */
  letters: ReadonlyMap<number, string>
  /** What to highlight: the shown harmony, the level, and note names by pitch class. */
  jam: { harmony: HarmonyAt; wheels: Wheels; names: readonly string[] }
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

  ctx.font = '600 12px system-ui, sans-serif'
  // Letters and octave names only where they fit; on a phone-width keyboard they smear.
  const labels = (keys.find((k) => !k.black)?.w ?? 0) >= 14
  for (const k of keys) {
    const velocity = held.get(k.note)
    const base = k.black ? BLACK_KEY : WHITE_KEY
    const sound = SOUND_COLORS[layout[zoneOf(layout, k.note)].presetId]
    const tier = tierOf(k.note, jam.harmony, jam.wheels)
    const lit = velocity !== undefined
    ctx.fillStyle = css(lit ? heldFill(base, sound, velocity) : idleFill(k.black, tier))
    ctx.fillRect(k.x, k.y, k.w, k.h)
    if (!k.black) {
      ctx.strokeStyle = OUTLINE
      ctx.strokeRect(k.x + 0.5, k.y + 0.5, k.w - 1, k.h - 1)
    }
    const marked = tier === 'chord' || tier === 'scale'
    // A held key's fill covers its dot. The bin ring keeps light dots visible on white keys.
    if (marked && !lit) {
      const dot = dotOf(k, tier === 'chord')
      ctx.beginPath()
      ctx.arc(dot.x, dot.y, dot.r, 0, 2 * Math.PI)
      ctx.fillStyle = tier === 'chord' ? css(sound) : KRAFT
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = BIN
      ctx.stroke()
      ctx.lineWidth = 1
    }
    // Dark text on light fills: white keys (dimmed ones too, which the brown letters fade on),
    // and black keys played harder.
    const dark = k.black ? lit && velocity >= 0.4 : lit || tier === 'other'
    ctx.fillStyle = dark ? BIN : k.black ? BONE : LETTER
    if (!labels) continue
    if (marked && jam.wheels === 3) {
      ctx.save()
      ctx.fillStyle = k.black && !dark ? BONE : BIN
      ctx.fillText(jam.names[k.note % 12]!, k.x + k.w / 2, nameY(k), k.w - 2)
      ctx.restore()
    }
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
