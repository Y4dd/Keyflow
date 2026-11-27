// The Dexie database. Schema changes only ever add a version with a migration (CLAUDE.md:
// never break user data). Settings are key → value rows, one per setting, so a new setting is
// just a new row and needs no migration. A setting left at its default has no row (toStored).
// Version 2 (P1-T7) adds the `takes` table and changes nothing else, so it needs no upgrade
// function: Dexie keeps version 1's settings as they are.

import { Dexie, type EntityTable } from 'dexie'
import { parseTake, type Take } from '../analysis/take.ts'

interface SettingRow {
  key: string
  value: unknown
}

/** A saved take with its key. */
export type StoredTake = Take & { id: number }

const db = new Dexie('keyflow') as Dexie & {
  settings: EntityTable<SettingRow, 'key'>
  takes: EntityTable<StoredTake, 'id'>
}
db.version(1).stores({ settings: 'key' })
db.version(2).stores({ settings: 'key', takes: '++id' })

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
