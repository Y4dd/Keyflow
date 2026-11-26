// Key geometry for the canvas keyboard: where each of the 61 keys is drawn and which key a point
// hits. Pure (no DOM), so it's unit-tested; src/ui/canvas/keyboard.ts draws with it.

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
 * A point inside a key that no other key, label, dot or note name covers: for clicks and pixel
 * checks. On white keys it's off the centre column, where the dots and names sit.
 */
export function keyPoint(k: KeyRect): { x: number; y: number } {
  return k.black
    ? { x: k.x + k.w / 2, y: k.y + k.h * 0.35 }
    : { x: k.x + k.w * 0.2, y: k.y + k.h * 0.72 }
}

/**
 * Where a key's highlight dot sits (centred, near the bottom, above the key letters) and its
 * radius: large for a chord tone, small for a scale tone, capped by the key's width.
 */
export function dotOf(k: KeyRect, chord: boolean): { x: number; y: number; r: number } {
  const r = k.black
    ? Math.min(chord ? 6 : 3, k.w * (chord ? 0.3 : 0.15))
    : Math.min(chord ? 7 : 3.5, k.w * (chord ? 0.22 : 0.11))
  return { x: k.x + k.w / 2, y: k.y + k.h - (k.black ? 22 : 36), r }
}

/** Baseline of a key's note name (training wheels 3), centred above its dot. */
export const nameY = (k: KeyRect): number => k.y + k.h - (k.black ? 34 : 50)

export type Rgb = readonly [number, number, number]

/** `a` moved toward `b` by `t` (0..1). */
export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const m = (i: number) => Math.round(a[i]! + (b[i]! - a[i]!) * t)
  return [m(0), m(1), m(2)]
}

/** A held key's colour: harder notes (velocity 0..1) sit closer to the accent. */
export const heldFill = (base: Rgb, accent: Rgb, velocity: number): Rgb =>
  mix(base, accent, 0.3 + 0.7 * Math.min(1, Math.max(0, velocity)))
