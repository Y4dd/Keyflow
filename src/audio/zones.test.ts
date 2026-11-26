import { describe, expect, it } from 'vitest'
import {
  clampOctave,
  clampSplitNote,
  createZoneRouter,
  DEFAULT_LAYOUT,
  zoneOf,
  zonesOf,
  type KeyboardLayout,
} from './zones.ts'

const layout = (patch: Partial<KeyboardLayout> = {}): KeyboardLayout => ({
  ...DEFAULT_LAYOUT,
  ...patch,
})

describe('zonesOf', () => {
  it('defaults to Round Bass below G3 and Funk Lead from G3 up', () => {
    expect(zonesOf(DEFAULT_LAYOUT)).toEqual([
      { id: 'left', lowNote: 0, highNote: 54, presetId: 'round-bass', transpose: 0 },
      { id: 'main', lowNote: 55, highNote: 127, presetId: 'funk-lead', transpose: 0 },
    ])
  })

  it('is one main zone over every note when the split is off', () => {
    const l = layout({ split: false, main: { presetId: 'ep-keys', octave: -1 } })
    expect(zonesOf(l)).toEqual([
      { id: 'main', lowNote: 0, highNote: 127, presetId: 'ep-keys', transpose: -12 },
    ])
  })
})

describe('zoneOf', () => {
  it('gives the split note to the main zone and the key below it to the left', () => {
    expect(zoneOf(DEFAULT_LAYOUT, 55)).toBe('main')
    expect(zoneOf(DEFAULT_LAYOUT, 54)).toBe('left')
  })

  it("doesn't clamp to the 61 keys: a transposed keyboard's notes still route", () => {
    expect(zoneOf(DEFAULT_LAYOUT, 33)).toBe('left')
    expect(zoneOf(DEFAULT_LAYOUT, 100)).toBe('main')
  })

  it('sends everything to the main zone when the split is off', () => {
    expect(zoneOf(layout({ split: false }), 36)).toBe('main')
  })
})

describe('clamps', () => {
  it('keeps octaves in -2..+2 and whole', () => {
    expect([-5, -1.4, 0, 1.6, 9].map(clampOctave)).toEqual([-2, -1, 0, 2, 2])
  })
  it('keeps a note in each zone', () => {
    expect([-3, 0, 60, 127, 200].map(clampSplitNote)).toEqual([1, 1, 60, 127, 127])
  })
})

describe('createZoneRouter', () => {
  it('routes each hand to its zone with its octave shift', () => {
    const r = createZoneRouter()
    const l = layout({ left: { presetId: 'wobble-bass', octave: -1 } })
    expect(r.noteOn(40, l)).toEqual({ zone: 'left', note: 28 })
    expect(r.noteOn(67, l)).toEqual({ zone: 'main', note: 67 })
    expect(r.heldCount('left')).toBe(1)
    expect(r.heldCount('main')).toBe(1)
    expect(r.noteOff(40)).toEqual({ zone: 'left', note: 28 })
    expect(r.noteOff(67)).toEqual({ zone: 'main', note: 67 })
    expect(r.heldCount('left') + r.heldCount('main')).toBe(0)
  })

  it('releases a held note in the zone it started in after the split moves', () => {
    const r = createZoneRouter()
    r.noteOn(50, DEFAULT_LAYOUT) // left
    const moved = layout({ splitNote: 48 }) // 50 now belongs to main
    expect(r.noteOn(52, moved)).toEqual({ zone: 'main', note: 52 })
    expect(r.noteOff(50)).toEqual({ zone: 'left', note: 50 })
    expect(r.noteOff(52)).toEqual({ zone: 'main', note: 52 })
  })

  it('releases the pitch that sounded after the octave changes', () => {
    const r = createZoneRouter()
    r.noteOn(60, DEFAULT_LAYOUT)
    const up = layout({ main: { presetId: 'funk-lead', octave: 1 } })
    // The same key pressed again (a second channel) plays at the new octave...
    expect(r.noteOn(60, up)).toEqual({ zone: 'main', note: 72 })
    // ...and each note-off releases one of them, oldest first.
    expect(r.noteOff(60)).toEqual({ zone: 'main', note: 60 })
    expect(r.noteOff(60)).toEqual({ zone: 'main', note: 72 })
    expect(r.noteOff(60)).toBeNull()
  })

  it('keeps the routes of one key on twice until both note-offs', () => {
    const r = createZoneRouter()
    r.noteOn(45, DEFAULT_LAYOUT)
    r.noteOn(45, DEFAULT_LAYOUT)
    expect(r.heldCount('left')).toBe(2)
    expect(r.noteOff(45)).toEqual({ zone: 'left', note: 45 })
    expect(r.heldCount('left')).toBe(1)
    expect(r.noteOff(45)).toEqual({ zone: 'left', note: 45 })
    expect(r.heldCount('left')).toBe(0)
  })

  it('keeps a held left note routed to the left after the split is turned off', () => {
    const r = createZoneRouter()
    r.noteOn(40, DEFAULT_LAYOUT)
    expect(r.noteOn(41, layout({ split: false }))).toEqual({ zone: 'main', note: 41 })
    expect(r.noteOff(40)).toEqual({ zone: 'left', note: 40 })
  })

  it('ignores a note-off it never routed', () => {
    expect(createZoneRouter().noteOff(60)).toBeNull()
  })

  it("doesn't route a shifted pitch outside MIDI's 0..127", () => {
    const r = createZoneRouter()
    const down = layout({ left: { presetId: 'wobble-bass', octave: -2 } })
    expect(r.noteOn(10, down)).toBeNull()
    expect(r.noteOff(10)).toBeNull()
    const up = layout({ main: { presetId: 'funk-lead', octave: 2 } })
    expect(r.noteOn(120, up)).toBeNull()
    expect(r.noteOn(103, up)).toEqual({ zone: 'main', note: 127 })
  })

  it('forgets one zone when its instrument is released, and the other zone keeps playing', () => {
    const r = createZoneRouter()
    r.noteOn(40, DEFAULT_LAYOUT)
    r.noteOn(60, DEFAULT_LAYOUT)
    r.noteOn(60, layout({ split: false }))
    r.releaseZone('main')
    expect(r.heldCount('main')).toBe(0)
    expect(r.noteOff(60)).toBeNull()
    expect(r.noteOff(40)).toEqual({ zone: 'left', note: 40 })
  })

  it('forgets everything on releaseAll', () => {
    const r = createZoneRouter()
    r.noteOn(40, DEFAULT_LAYOUT)
    r.noteOn(60, DEFAULT_LAYOUT)
    r.releaseAll()
    expect(r.noteOff(40)).toBeNull()
    expect(r.noteOff(60)).toBeNull()
  })
})
