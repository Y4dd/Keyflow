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

// Reading items and logs back from a backup file (P2-T8): stored rows aren't checked on load, so
// anything imported is checked here. JSON turns Dates into strings; either form is read.
const asDate = (v: unknown): Date | null => {
  const d = v instanceof Date || typeof v === 'string' ? new Date(v) : null
  return d && !Number.isNaN(d.getTime()) ? d : null
}

// What a card and a revlog look like, so a ts-fsrs field added later is checked without a change.
const EPOCH = new Date('2026-01-01T00:00:00Z') // any date: only the fields' kinds are used
const CARD = scheduler.newCard({ now: EPOCH })
const REVLOG = scheduler.review({ card: CARD, grade: 3, now: EPOCH }).revlog

/**
 * A copy of `raw` with exactly the template's fields, each of the template's kind (a null in the
 * template is a date or null), or null if any field isn't.
 */
function like<T extends object>(template: T, raw: unknown): T | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [key, t] of Object.entries(template)) {
    const v = r[key]
    if (t instanceof Date || t === null) {
      const d = asDate(v)
      if (!d && !(t === null && v === null)) return null
      out[key] = d
    } else if (typeof t === 'number' ? !Number.isFinite(v) : typeof v !== typeof t) return null
    else out[key] = v
  }
  return out as T
}

const isCount = (v: unknown) => Number.isInteger(v) && (v as number) >= 0

/** An item read from untrusted data (a backup file), or null if any part of it is wrong. */
export function parseItem(raw: unknown): Item | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const card = like(CARD, r.card)
  const created = asDate(r.created)
  const unlocked = r.unlocked === null ? null : asDate(r.unlocked)
  if (typeof r.id !== 'string' || !isItemId(r.id) || !card || !created) return null
  if (r.unlocked !== null && !unlocked) return null
  // The scheduler checks the values (a known state, non-negative counts); a card it rejects
  // would fail every later review of the item.
  try {
    scheduler.review({ card, grade: 3, now: card.dueAt })
  } catch {
    return null
  }
  return { id: r.id, card, created, unlocked }
}

/** A logged attempt read from untrusted data, without its database id; null if it's wrong. */
export function parseReviewLog(raw: unknown): ReviewLog | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const at = asDate(r.at)
  const revlog = like(REVLOG, r.revlog)
  const ms = r.ms === null || (Number.isFinite(r.ms) && (r.ms as number) >= 0)
  if (typeof r.item !== 'string' || !isItemId(r.item) || !at || !revlog || !ms) return null
  if (![1, 2, 3, 4].includes(r.rating as number) || !isCount(r.hintLevel)) return null
  if (!isCount(r.wrongNotes)) return null
  return {
    item: r.item,
    at,
    rating: r.rating as Grade,
    ms: r.ms as number | null,
    hintLevel: r.hintLevel as number,
    wrongNotes: r.wrongNotes as number,
    revlog,
  }
}
