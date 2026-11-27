// Exporting and importing all user data (P2-T8); the file format and its checks are in
// src/storage/backup.ts, loaded on demand since it brings in the FSRS scheduler. An import
// replaces everything and reloads the page, so every store starts again from the new data.
//
// shortcut: another open Keyflow tab keeps its own settings in memory and can write them back
// over an import; ask the user to close other tabs (or sync them) if that's ever reported.

import type { BackupData } from '../storage/backup.ts'
import { DB_VERSION, dumpAll, replaceAll } from '../storage/db.ts'
import { flushSettings } from './settings.ts'

/** All user data as a JSON file. */
export async function exportBackup(): Promise<Blob> {
  await flushSettings()
  const { toBackup } = await import('../storage/backup.ts')
  const backup = toBackup(await dumpAll(), DB_VERSION, new Date())
  return new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
}

/** A backup file's data, checked, or the message saying why it can't be imported. */
export async function readBackup(file: File): Promise<BackupData | string> {
  const { parseBackup, NOT_A_BACKUP } = await import('../storage/backup.ts')
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    return NOT_A_BACKUP
  }
  return parseBackup(raw, DB_VERSION)
}

/** Replaces all user data with a checked backup, then reloads the page. */
export async function importBackup(data: BackupData): Promise<void> {
  // Writes a pending settings change now, so the old value can't be written after the import.
  // shortcut: a setting changed in the moment between the import and the reload is still
  // written back over it; stop the settings writer first if that's ever seen.
  await flushSettings()
  await replaceAll(data)
  location.reload()
}
