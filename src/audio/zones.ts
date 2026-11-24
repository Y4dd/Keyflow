// The split keyboard: which sound a key plays, and at what pitch. Pure: no Tone, no DOM.
//
// Like the YPT-380's own split: a main sound covers the whole keyboard, or only the keys from
// the split point up when the split is on; a left sound plays the keys below it. Each has its
// own preset and octave shift.
//
// The rule that keeps notes from sticking: a note-off follows the route its note-on took,
// never the current layout. Moving the split or changing an octave while keys are held
// doesn't change where their note-offs go.

import type { PresetId } from './presets/types.ts'

export type ZoneId = 'main' | 'left'

export interface ZoneSound {
  presetId: PresetId
  /** Octave shift, in octaves. */
  octave: number
}

/** Plain data: settings persistence (P0-T9) stores it as is. */
export interface KeyboardLayout {
  split: boolean
  /** The lowest key of the main sound when split; keys below it play the left sound. */
  splitNote: number
  main: ZoneSound
  left: ZoneSound
}

/** A resolved zone: the keys it covers and how it plays them. */
export interface Zone {
  id: ZoneId
  lowNote: number
  highNote: number
  presetId: PresetId
  /** Semitones. */
  transpose: number
}

export const ZONE_IDS: readonly ZoneId[] = ['main', 'left']

export const MIN_OCTAVE = -2
export const MAX_OCTAVE = 2

/** G3 (C4 = middle C = 60): the left hand gets C2 to F#3 on the 61 keys, the right G3 to C7. */
export const DEFAULT_SPLIT_NOTE = 55

export const DEFAULT_LAYOUT: KeyboardLayout = {
  split: true,
  splitNote: DEFAULT_SPLIT_NOTE,
  main: { presetId: 'funk-lead', octave: 0 },
  left: { presetId: 'wobble-bass', octave: 0 },
}

/** The zones a layout plays, low to high. Together they cover every MIDI note. */
export function zonesOf(layout: KeyboardLayout): Zone[] {
  const zone = (id: ZoneId, lowNote: number, highNote: number): Zone => ({
    id,
    lowNote,
    highNote,
    presetId: layout[id].presetId,
    transpose: layout[id].octave * 12,
  })
  if (!layout.split) return [zone('main', 0, 127)]
  return [zone('left', 0, layout.splitNote - 1), zone('main', layout.splitNote, 127)]
}

/** The zone that plays a key. */
export function zoneOf(layout: KeyboardLayout, note: number): ZoneId {
  return layout.split && note < layout.splitNote ? 'left' : 'main'
}

export const clampOctave = (octave: number) =>
  Math.min(MAX_OCTAVE, Math.max(MIN_OCTAVE, Math.round(octave)))

/** Each zone keeps at least one MIDI note. */
export const clampSplitNote = (note: number) => Math.min(127, Math.max(1, Math.round(note)))

export interface Route {
  zone: ZoneId
  /** The pitch the zone's instrument plays (the key plus the zone's octave shift). */
  note: number
}

export interface ZoneRouter {
  /** Routes a note-on by the current layout; null when the shifted pitch leaves 0..127. */
  noteOn(note: number, layout: KeyboardLayout): Route | null
  /** The route of the oldest unreleased note-on of this key, or null if none. */
  noteOff(note: number): Route | null
  /** Forgets one zone's routes (its instrument was released or replaced). */
  releaseZone(zone: ZoneId): void
  releaseAll(): void
  /** Unreleased note-ons per zone, for tests and dev tools. */
  heldCount(zone: ZoneId): number
}

export function createZoneRouter(): ZoneRouter {
  // Per key, the routes of its unreleased note-ons, oldest first. A key can be on twice: the
  // YPT-380 sometimes sends a note on two channels, and MIDI and the computer keys can overlap.
  const routes = new Map<number, Route[]>()

  return {
    noteOn(note, layout) {
      const zone = zoneOf(layout, note)
      const pitch = note + layout[zone].octave * 12
      if (pitch < 0 || pitch > 127) return null
      const route = { zone, note: pitch }
      const list = routes.get(note)
      if (list) list.push(route)
      else routes.set(note, [route])
      return route
    },

    noteOff(note) {
      const list = routes.get(note)
      if (!list) return null
      const route = list.shift()!
      if (list.length === 0) routes.delete(note)
      return route
    },

    releaseZone(zone) {
      for (const [note, list] of routes) {
        const kept = list.filter((r) => r.zone !== zone)
        if (kept.length === 0) routes.delete(note)
        else routes.set(note, kept)
      }
    },

    releaseAll: () => routes.clear(),

    heldCount(zone) {
      let n = 0
      for (const list of routes.values()) for (const r of list) if (r.zone === zone) n++
      return n
    },
  }
}
