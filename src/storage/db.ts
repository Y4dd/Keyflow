// The Dexie database. Schema changes only ever add a version with a migration (CLAUDE.md:
// never break user data). Settings are key → value rows, one per setting, so a new setting is
// just a new row and needs no migration. A setting left at its default has no row (toStored).

import { Dexie, type EntityTable } from 'dexie'

interface SettingRow {
  key: string
  value: unknown
}

const db = new Dexie('keyflow') as Dexie & { settings: EntityTable<SettingRow, 'key'> }
db.version(1).stores({ settings: 'key' })

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
