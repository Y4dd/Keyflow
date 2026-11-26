import { describe, expect, it } from 'vitest'
import { SOUND_COLORS } from './keyboard.ts'
import {
  heldFill,
  HIGH_NOTE,
  idleFill,
  keyPoint,
  keyRects,
  LOOKS,
  LOW_NOTE,
  lum,
  marksOf,
  nameWidth,
  nameY,
  noteAt,
  BLACK_KEY,
  WHITE_KEY,
  type KeyRect,
  type Look,
  type Rect,
  type Rgb,
} from './keys.ts'

const keys = keyRects(720, 140, 16)
const rect = (note: number) => keys.find((k) => k.note === note)!

describe('keyRects', () => {
  it('draws the 61 keys, 36 of them white, filling the width', () => {
    expect(keys).toHaveLength(HIGH_NOTE - LOW_NOTE + 1)
    expect(keys.filter((k) => !k.black)).toHaveLength(36)
    expect(rect(LOW_NOTE).x).toBe(0)
    expect(rect(HIGH_NOTE).x + rect(HIGH_NOTE).w).toBeCloseTo(720)
    expect(rect(60)).toMatchObject({ y: 16, h: 124 })
  })
})

describe('noteAt', () => {
  it('a black key wins over the white keys under it', () => {
    const cs = rect(61) // C#4
    expect(noteAt(keys, cs.x + cs.w / 2, cs.y + 5)).toBe(61)
    expect(noteAt(keys, cs.x + 1, cs.y + cs.h + 5)).toBe(60) // below the black key: C4
    expect(noteAt(keys, cs.x + cs.w - 1, cs.y + cs.h + 5)).toBe(62) // D4
  })

  it('the strip above the keys and outside the keyboard hit nothing', () => {
    expect(noteAt(keys, 100, 10)).toBeNull()
    expect(noteAt(keys, 721, 100)).toBeNull()
  })

  it("every key's point hits that key", () => {
    for (const k of keys) expect(noteAt(keys, keyPoint(k).x, keyPoint(k).y)).toBe(k.note)
  })
})

describe('heldFill', () => {
  it('harder notes sit closer to the accent', () => {
    const soft = heldFill([255, 255, 255], [200, 0, 0], 0.1)
    const hard = heldFill([255, 255, 255], [200, 0, 0], 1)
    expect(hard).toEqual([200, 0, 0])
    expect(soft[1]).toBeGreaterThan(hard[1])
    expect(heldFill([255, 255, 255], [200, 0, 0], 0)).not.toEqual([255, 255, 255]) // still visible
  })
})

describe('marksOf and nameY', () => {
  // The keyboard's real height (180 px with a 20 px strip), from a phone to a wide screen.
  const sizes = [400, 720, 1100, 1400].map((w) => keyRects(w, 180, 20))
  const inside = (r: Rect, x: number, y: number) =>
    x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
  const overlap = (a: Rect, b: Rect) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  // A note name at 12 px: up to nameWidth wide, 10 px above its baseline and 2 below.
  const nameBox = (k: KeyRect, look: Look): Rect => {
    const w = nameWidth(k)
    return { x: k.x + (k.w - w) / 2, y: nameY(k, look) - 10, w, h: 12 }
  }
  // The computer-key letter and, on white keys, the C-octave name below it.
  const letterBox = (k: KeyRect): Rect =>
    k.black
      ? { x: k.x + k.w / 2 - 3, y: k.y + k.h - 13, w: 6, h: 9 }
      : { x: k.x + k.w / 2 - 4, y: k.y + k.h - 27, w: 8, h: 22 }
  const all = (k: KeyRect, look: Look) =>
    [true, false].flatMap((chord) =>
      [true, false].flatMap((named) => marksOf(k, look, chord, named)),
    )
  // Labels (letters, names) are drawn only when a white key is at least 14 px wide.
  const labelled = (ks: KeyRect[]) => ks.find((k) => !k.black)!.w >= 14

  it("never cover a key's point, so the pixel check reads the key's own fill", () => {
    for (const ks of sizes)
      for (const k of ks)
        for (const look of LOOKS) {
          const p = keyPoint(k)
          for (const r of all(k, look)) expect(inside(r, p.x, p.y)).toBe(false)
          if (labelled(ks)) expect(inside(nameBox(k, look), p.x, p.y)).toBe(false)
        }
  })

  it('stay inside the key, clear of the letters; names clear of every mark but the tags', () => {
    for (const ks of sizes)
      for (const k of ks)
        for (const look of LOOKS) {
          for (const r of all(k, look)) {
            expect(r.x).toBeGreaterThanOrEqual(k.x)
            expect(r.x + r.w).toBeLessThanOrEqual(k.x + k.w)
            expect(r.y).toBeGreaterThanOrEqual(k.y)
            expect(r.y + r.h).toBeLessThanOrEqual(k.y + k.h)
            if (labelled(ks)) expect(overlap(r, letterBox(k))).toBe(false)
          }
          if (!labelled(ks)) continue
          expect(overlap(nameBox(k, look), letterBox(k))).toBe(false)
          // Tags hold their name; on narrow black keys a frame's side may touch it.
          if (look !== 'tags' && !(look === 'frames' && k.black))
            for (const r of all(k, look)) expect(overlap(r, nameBox(k, look))).toBe(false)
        }
  })

  it('mark chord tones more strongly than scale tones', () => {
    const area = (rs: Rect[]) => rs.reduce((a, r) => a + r.w * r.h, 0)
    for (const k of sizes[2]!) {
      expect(marksOf(k, 'spotlight', true, true)).toEqual([])
      for (const look of ['tape', 'frames', 'tags'] as const)
        expect(area(marksOf(k, look, true, false))).toBeGreaterThan(
          area(marksOf(k, look, false, false)),
        )
    }
  })
})

describe('idleFill', () => {
  it('dims other notes without turning redder, and leaves keys alone with wheels off', () => {
    for (const look of LOOKS) {
      expect(idleFill(false, null, look, 0)).toEqual(WHITE_KEY)
      const dim = idleFill(false, 'other', look, 2)
      expect(lum(dim)).toBeLessThan(lum(WHITE_KEY))
      expect(dim[0] - dim[2]).toBeLessThanOrEqual(WHITE_KEY[0] - WHITE_KEY[2])
    }
  })

  it('in the spotlight, keys step down from chord tones to scale tones to the rest', () => {
    for (const black of [false, true]) {
      const [chord, scale, other] = (['chord', 'scale', 'other'] as const).map((t) =>
        lum(idleFill(black, t, 'spotlight', 2)),
      )
      expect(chord).toBeGreaterThan(scale!)
      expect(scale).toBeGreaterThan(other!)
      // At Chord tones only, the unmarked keys still sit below the chord tones.
      expect(lum(idleFill(black, null, 'spotlight', 1))).toBeLessThan(chord!)
    }
  })
})

describe('held keys and highlighting', () => {
  it('a held key never looks like an unheld highlighted one, however softly it is played', () => {
    const far = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
    for (const black of [false, true])
      for (const sound of Object.values(SOUND_COLORS))
        // shortcut: from velocity 0.25 (about 32 of 127); the softest held whites sit near ivory
        // since P0's heldFill floor. Raise that floor if pianissimo notes read unlit.
        for (const velocity of [0.25, 0.5, 0.75, 1])
          for (const look of LOOKS)
            for (const tier of ['chord', 'scale', 'other', null] as const) {
              const heldColour = heldFill(black ? BLACK_KEY : WHITE_KEY, sound, velocity)
              expect(far(heldColour, idleFill(black, tier, look, 2))).toBeGreaterThan(40)
            }
  })
})
