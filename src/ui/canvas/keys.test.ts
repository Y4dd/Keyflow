import { describe, expect, it } from 'vitest'
import { heldFill, HIGH_NOTE, keyPoint, keyRects, LOW_NOTE, noteAt } from './keys.ts'

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
