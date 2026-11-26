// Key geometry for the canvas keyboard: where each of the 61 keys is drawn and which key a point
// hits, and how jam mode's highlighting fills and marks it. Pure (no DOM), so it's unit-tested;
// src/ui/canvas/keyboard.ts draws with it.

import type { Tier, Wheels } from '../../music/highlight.ts'

/** The YPT-380's 61 keys: C2 to C7 (C4 = middle C = 60). Notes outside aren't drawn. */
export const LOW_NOTE = 36
export const HIGH_NOTE = 96

const BLACK_PCS = new Set([1, 3, 6, 8, 10])
export const isBlack = (note: number) => BLACK_PCS.has(note % 12)

const BLACK_WIDTH = 0.62 // of a white key
const BLACK_HEIGHT = 0.6 // of the keys' height

export interface KeyRect {
  note: number
  black: boolean
  x: number
  y: number
  w: number
  h: number
}

/** Whites first, so blacks paint on top. Keys fill `width` and run from `top` to `height`. */
export function keyRects(width: number, height: number, top: number): KeyRect[] {
  const whites: KeyRect[] = []
  const blacks: KeyRect[] = []
  let count = 0
  for (let n = LOW_NOTE; n <= HIGH_NOTE; n++) if (!isBlack(n)) count++
  const w = width / count
  const h = height - top
  let i = 0
  for (let n = LOW_NOTE; n <= HIGH_NOTE; n++) {
    if (isBlack(n)) {
      // Centered on the line between its two white neighbours.
      const bw = w * BLACK_WIDTH
      blacks.push({ note: n, black: true, x: i * w - bw / 2, y: top, w: bw, h: h * BLACK_HEIGHT })
    } else {
      whites.push({ note: n, black: false, x: i * w, y: top, w, h })
      i++
    }
  }
  return [...whites, ...blacks]
}

const inside = (k: KeyRect, x: number, y: number) =>
  x >= k.x && x < k.x + k.w && y >= k.y && y < k.y + k.h

/** The key at a point; blacks win where they overlap whites. */
export function noteAt(keys: readonly KeyRect[], x: number, y: number): number | null {
  for (let i = keys.length - 1; i >= 0; i--) if (inside(keys[i], x, y)) return keys[i].note
  return null
}

/**
 * A point inside a key that no other key, label, tag or note name covers: for clicks and pixel
 * checks. On white keys it's just under the black keys, above the tags and names.
 */
export function keyPoint(k: KeyRect): { x: number; y: number } {
  return k.black
    ? { x: k.x + k.w / 2, y: k.y + k.h * 0.35 }
    : { x: k.x + k.w * 0.2, y: k.y + k.h * 0.64 }
}

/**
 * Jam mode's highlighting looks (P1-T4b, the user kept both): Spotlight marks by brightness
 * alone, Tags puts a high-contrast tag on each chord tone that holds its name.
 */
export const LOOKS = ['tags', 'spotlight'] as const
export type Look = (typeof LOOKS)[number]

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** A pill, or a dash, centred on the key at height `cy`. */
const centred = (k: KeyRect, cy: number, w: number, h: number): Rect[] =>
  w > 0 ? [{ x: k.x + (k.w - w) / 2, y: cy - h / 2, w, h }] : []

/** Where a key's tag sits: centred, above the key letters. */
const tagY = (k: KeyRect) => k.y + k.h - (k.black ? 26 : 40)

/**
 * The marks an unheld chord or scale tone carries, as round-ended rectangles: in Tags, a pill on
 * a chord tone (large, holding the name, when `named`: training wheels 3) and a short dash on a
 * scale tone when names are off; Spotlight has none. They stay clear of the key letters at the
 * bottom and of `keyPoint` (unit-tested).
 */
export function marksOf(k: KeyRect, look: Look, chord: boolean, named: boolean): Rect[] {
  if (look === 'spotlight') return []
  const cy = tagY(k)
  if (chord && named)
    return centred(k, cy, k.black ? k.w - 2 : Math.min(k.w - 4, 32), k.black ? 16 : 20)
  if (chord) return centred(k, cy, Math.min(k.w - (k.black ? 4 : 6), k.black ? 14 : 20), 9)
  return named ? [] : centred(k, cy, Math.min(k.w - (k.black ? 6 : 8), k.black ? 10 : 12), 4)
}

/** Baseline of a key's note name (training wheels 3): inside its tag, else above the letters. */
export const nameY = (k: KeyRect, look: Look): number =>
  look === 'tags' ? tagY(k) + (k.black ? 4 : 5) : k.y + k.h - (k.black ? 24 : 32)

/** The most a note name may be squeezed to, so it stays inside the key. */
export const nameWidth = (k: KeyRect): number => Math.min(18, k.w - (k.black ? 2 : 6))

export type Rgb = readonly [number, number, number]

/** `a` moved toward `b` by `t` (0..1). */
export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const m = (i: number) => Math.round(a[i]! + (b[i]! - a[i]!) * t)
  return [m(0), m(1), m(2)]
}

/** Perceived brightness, 0..255: picks dark or light text on a fill. */
export const lum = ([r, g, b]: Rgb): number => 0.299 * r + 0.587 * g + 0.114 * b

export const WHITE_KEY: Rgb = [239, 230, 214]
export const BLACK_KEY: Rgb = [42, 32, 26]
const WELL: Rgb = [18, 13, 11] // --well
export const KRAFT: Rgb = [200, 162, 113] // --kraft
/** Spotlight's chord tones on white keys: a step brighter than the idle ivory. */
const LIT_WHITE: Rgb = [255, 251, 243]

/**
 * An unheld key's fill. Notes outside the chord and scale are dimmed toward the well, never red.
 * Spotlight marks by brightness alone, in three clear steps: chord tones lit (black ones turn
 * kraft), scale tones mid, the rest dark; at Chord tones (wheels 1) every other key sits in
 * between.
 */
export function idleFill(black: boolean, tier: Tier | null, look: Look, wheels: Wheels): Rgb {
  const base = black ? BLACK_KEY : WHITE_KEY
  if (wheels === 0) return base
  if (look === 'tags') return tier === 'other' ? mix(base, WELL, black ? 0.5 : 0.55) : base
  if (tier === 'chord') return black ? mix(base, KRAFT, 0.9) : LIT_WHITE
  if (tier === 'scale') return black ? mix(base, KRAFT, 0.4) : mix(base, WELL, 0.4)
  if (tier === 'other') return black ? mix(base, WELL, 0.5) : mix(base, WELL, 0.7)
  return black ? base : mix(base, WELL, 0.5)
}

/** A held key's colour: harder notes (velocity 0..1) sit closer to the accent. */
export const heldFill = (base: Rgb, accent: Rgb, velocity: number): Rgb =>
  mix(base, accent, 0.3 + 0.7 * Math.min(1, Math.max(0, velocity)))
