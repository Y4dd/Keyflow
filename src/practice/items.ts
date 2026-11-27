// Skill items and their FSRS cards (P2-T1). Pure: the database calls are in src/storage/db.ts.
// An item is one schedulable thing (learning-design.md, "Skill items"); its card is ts-fsrs 6's
// DefaultScheduler card (FSRS-7, no fuzz), kept as the scheduler returns it, Dates included.

import { DefaultScheduler, type Grade } from 'ts-fsrs'

const scheduler = await DefaultScheduler()

export type Card = ReturnType<typeof scheduler.newCard>
export type Revlog = ReturnType<typeof scheduler.review>['revlog']

export interface Item {
  /** `<type>:<segments…>`, see isItemId. */
  id: string
  card: Card
  created: Date
  /** When the curriculum (P2-T5) unlocked it; null while locked. */
  unlocked: Date | null
}

/** What one attempt at an item measured (src/practice/drills.ts reports it). */
export interface AttemptResult {
  /** Milliseconds to the right answer; null if it never came (gave up, skipped). */
  ms: number | null
  /** The highest hint step shown, 0 for none (the hint ladder is P2-T4's). */
  hintLevel: number
  wrongNotes: number
}

/** One logged attempt. `id` is the database's. */
export interface ReviewLog extends AttemptResult {
  id?: number
  item: string
  at: Date
  rating: Grade
  /** ts-fsrs's own log, kept for a later optimizer or rollback. */
  revlog: Revlog
}

// segment counts per item type, from learning-design.md's examples
const SEGMENTS: Record<string, number> = {
  geo: 1,
  chord: 3,
  scale: 3,
  rn: 3,
  prog: 2,
  ear: 2,
  lick: 2,
}

/**
 * Whether an ID has a known type and that type's number of non-empty segments.
 * shortcut: checks the shape, not the vocabulary (drillOf does that for drilled types); check
 * roots and qualities here if a bad ID ever reaches storage.
 */
export function isItemId(id: string): boolean {
  const [type, ...rest] = id.split(':')
  return SEGMENTS[type!] === rest.length && rest.every((s) => s !== '')
}

export function newItem(id: string, now: Date, unlocked: Date | null = null): Item {
  if (!isItemId(id)) throw new Error(`Not an item ID: ${id}`)
  return { id, card: scheduler.newCard({ now }), created: now, unlocked }
}

/** Schedules the next review from a rating; the item passed in isn't changed. */
export function review(
  item: Item,
  rating: Grade,
  attempt: AttemptResult,
  now: Date,
): { item: Item; log: ReviewLog } {
  const { card, revlog } = scheduler.review({ card: item.card, grade: rating, now })
  return {
    item: { ...item, card },
    log: { item: item.id, at: now, rating, ...attempt, revlog },
  }
}
