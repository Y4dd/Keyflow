// The progress view's data (P2-T7). Pure: the heatmap of keys × chord and scale types from the
// curriculum and the stored items, and which recent days had practice. src/ui/ProgressPanel.tsx
// draws it.

import { CURRICULUM, UNLOCK, type TrackId } from './curriculum.ts'
import { qualityWord } from './drills.ts'
import type { Item } from './items.ts'

/** The heatmap's columns, chromatic from C, spelled as the curriculum's item IDs spell them. */
export const KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const

/** locked: not open yet; new: open, never reviewed; shaky: below the stable line; cold: at it. */
export type Level = 'locked' | 'new' | 'shaky' | 'cold'

export interface Cell {
  item: string
  level: Level
  /** Stability as a share of the stable line (UNLOCK.stableDays), 0..1. */
  fill: number
}

export interface Row {
  label: string
  /** One per KEYS column; null where the curriculum has no item. */
  cells: (Cell | null)[]
}

export interface Group {
  track: TrackId
  rows: Row[]
}

type Progress = Pick<Item, 'id' | 'card' | 'unlocked'>

/** Where an item stands. The stable line is the curriculum's, so "cold" is what unlocks. */
export function levelOf(item: Progress | undefined): Omit<Cell, 'item'> {
  if (!item?.unlocked) return { level: 'locked', fill: 0 }
  const fill = Math.min(1, item.card.stability / UNLOCK.stableDays)
  if (item.card.reps === 0) return { level: 'new', fill: 0 }
  return { level: item.card.stability >= UNLOCK.stableDays ? 'cold' : 'shaky', fill }
}

const VARIANTS: Record<string, string> = { inv1: '1st inversion', inv2: '2nd inversion' }

const label = (type: 'chord' | 'scale', quality: string, variant: string) => {
  const word = qualityWord(type, quality) ?? quality
  const name = word[0]!.toUpperCase() + word.slice(1)
  return VARIANTS[variant] ? `${name}, ${VARIANTS[variant]}` : name
}

/**
 * The chord and scale items of the curriculum as rows (one per type and inversion, in curriculum
 * order) grouped by track, each cell read from the stored items. Items outside the grid (note
 * names, chords in key, random drills' items the curriculum doesn't have) aren't shown.
 * shortcut: geography and chords in key have no keys × types grid; give them their own view if
 * the heatmap leaves them missed.
 */
export function heatmap(items: readonly Progress[]): Group[] {
  const byId = new Map(items.map((i) => [i.id, i]))
  const groups = new Map<TrackId, Map<string, Row>>()
  for (const unit of CURRICULUM)
    for (const id of unit.items) {
      const [type, key, quality, variant] = id.split(':') as [string, string, string, string]
      const col = (KEYS as readonly string[]).indexOf(key)
      if ((type !== 'chord' && type !== 'scale') || col < 0) continue
      const rows = groups.get(unit.track) ?? new Map<string, Row>()
      groups.set(unit.track, rows)
      const rowKey = `${type}:${quality}:${variant}`
      const row = rows.get(rowKey) ?? {
        label: label(type, quality, variant),
        cells: KEYS.map(() => null),
      }
      rows.set(rowKey, row)
      row.cells[col] = { item: id, ...levelOf(byId.get(id)) }
    }
  return [...groups].map(([track, rows]) => ({ track, rows: [...rows.values()] }))
}

/** Midnight starting the local day `back` days before `now`. */
export function dayStart(now: Date, back = 0): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - back)
  return d
}

/** For each of the last `n` local days, oldest first and today last: was anything practised? */
export function practiceDays(times: readonly Date[], now: Date, n: number): boolean[] {
  const seen = new Set(times.map((t) => t.toDateString()))
  return Array.from({ length: n }, (_, i) => seen.has(dayStart(now, n - 1 - i).toDateString()))
}

/** Days in a row up to today, or up to yesterday while today has nothing yet. */
export function daysRunning(days: readonly boolean[]): number {
  let i = days.length - 1
  if (!days[i]) i--
  let run = 0
  for (; i >= 0 && days[i]; i--) run++
  return run
}
