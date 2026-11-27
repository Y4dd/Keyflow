// The Dexie database. Schema changes only ever add a version with a migration (CLAUDE.md:
// never break user data). Settings are key → value rows, one per setting, so a new setting is
// just a new row and needs no migration. A setting left at its default has no row (toStored).
// Version 2 (P1-T7) adds the `takes` table and changes nothing else, so it needs no upgrade
// function: Dexie keeps version 1's settings as they are.
// Version 3 (P2-T1) adds `items` (one FSRS card per skill item, indexed by when it's due) and
// `reviewLogs` (every attempt, by item and time), the only Phase 2 schema change, and likewise
// keeps the settings and takes as they are.

import { Dexie, liveQuery, type EntityTable } from 'dexie'
import type { Grade } from 'ts-fsrs'
import { parseTake, type Take } from '../analysis/take.ts'
import type { Item, ReviewLog } from '../practice/items.ts'
import type { BackupData, Dump } from './backup.ts'

interface SettingRow {
  key: string
  value: unknown
}

/** A saved take with its key. */
export type StoredTake = Take & { id: number }

const db = new Dexie('keyflow') as Dexie & {
  settings: EntityTable<SettingRow, 'key'>
  takes: EntityTable<StoredTake, 'id'>
  items: EntityTable<Item, 'id'>
  reviewLogs: EntityTable<ReviewLog, 'id'>
}
db.version(1).stores({ settings: 'key' })
db.version(2).stores({ settings: 'key', takes: '++id' })
db.version(3).stores({
  settings: 'key',
  takes: '++id',
  items: 'id, card.dueAt',
  reviewLogs: '++id, item, at',
})

/** Every stored setting as one object, unchecked: pass it to parseSettings. */
export async function loadSettings(): Promise<Record<string, unknown>> {
  const rows = await db.settings.toArray()
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

/** Writes the changed settings' rows and deletes the ones back at their default, together. */
export async function saveSettings(put: SettingRow[], remove: string[]): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    await db.settings.bulkPut(put)
    await db.settings.bulkDelete(remove)
  })
}

/** Saves a take; resolves to its id. */
export async function saveTake(take: Take): Promise<number> {
  return db.takes.add(take as StoredTake)
}

/**
 * The newest takes first, checked by parseTake (one that can't be read is left out).
 * shortcut: the latest `limit` only, and no delete; add both once a long list gets in the way.
 */
export async function loadTakes(limit: number): Promise<StoredTake[]> {
  const rows = await db.takes.reverse().limit(limit).toArray()
  return rows.flatMap((row) => {
    const take = parseTake(row)
    return take ? [{ ...take, id: row.id }] : []
  })
}

/**
 * Every item, as stored.
 * shortcut: rows aren't checked (only this app writes them, and the scheduler rejects a bad
 * card on review); check them here like parseTake if anything else ever writes items.
 */
export async function loadItems(): Promise<Item[]> {
  return db.items.toArray()
}

export async function loadItem(id: string): Promise<Item | undefined> {
  return db.items.get(id)
}

/** Adds or replaces items (new or newly unlocked ones). */
export async function putItems(items: Item[]): Promise<void> {
  await db.items.bulkPut(items)
}

/**
 * Reads an item, reviews it with `next` (synchronous, so the transaction stays open) and saves
 * the item and the attempt's log, all in one transaction, so two overlapping reviews of one item
 * can't lose one. Resolves to the saved item.
 */
export async function saveReview(
  id: string,
  next: (stored: Item | undefined) => { item: Item; log: ReviewLog },
): Promise<Item> {
  return db.transaction('rw', db.items, db.reviewLogs, async () => {
    const { item, log } = next(await db.items.get(id))
    await db.items.put(item)
    await db.reviewLogs.add(log)
    return item
  })
}

/** An item's logged attempts, oldest first. */
export async function loadReviewLogs(item: string): Promise<ReviewLog[]> {
  return db.reviewLogs.where('item').equals(item).sortBy('at')
}

/**
 * Calls `onChange` with every item and the time of each attempt since `since`, now and after
 * any write to either table (Dexie's liveQuery), until the returned function is called.
 */
export function watchProgress(
  since: Date,
  onChange: (p: { items: Item[]; times: Date[] }) => void,
): () => void {
  const sub = liveQuery(async () => ({
    items: await db.items.toArray(),
    times: (await db.reviewLogs.where('at').aboveOrEqual(since).keys()) as Date[],
  })).subscribe({ next: onChange, error: () => {} }) // a failed read leaves the view as it was
  return () => sub.unsubscribe()
}

/** The ratings of the latest `n` attempts at any item, oldest first (P2-T6's success rate). */
export async function loadRecentRatings(n: number): Promise<Grade[]> {
  const logs = await db.reviewLogs.orderBy('at').reverse().limit(n).toArray()
  return logs.reverse().map((l) => l.rating)
}

/** The database version this app declares, which a backup file is checked against (P2-T8). */
export const DB_VERSION = db.verno

/** Every row of every table, as stored (backup.ts checks them). Takes are all of them. */
export async function dumpAll(): Promise<Dump> {
  return db.transaction('r', [db.settings, db.takes, db.items, db.reviewLogs], async () => ({
    settings: await loadSettings(),
    takes: await db.takes.toArray(),
    items: await db.items.toArray(),
    reviewLogs: await db.reviewLogs.toArray(),
  }))
}

/**
 * Replaces all user data with a checked backup, in one transaction: if any write fails, the
 * transaction aborts and the data is left as it was.
 */
export async function replaceAll(data: BackupData): Promise<void> {
  const tables = [db.settings, db.takes, db.items, db.reviewLogs]
  await db.transaction('rw', tables, async () => {
    for (const table of tables) await table.clear()
    await db.settings.bulkAdd(Object.entries(data.settings).map(([key, value]) => ({ key, value })))
    await db.takes.bulkAdd(data.takes as StoredTake[])
    await db.items.bulkAdd(data.items)
    await db.reviewLogs.bulkAdd(data.reviewLogs)
  })
}
