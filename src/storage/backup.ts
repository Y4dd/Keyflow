// All user data as one JSON file (P2-T8): settings, takes, items and review logs. Pure: db.ts
// reads and replaces the rows. An import is checked whole before anything is written, and one
// bad row rejects the file, so a damaged backup never replaces good data with part of itself.
// Exports go through the same checks (a row that wouldn't import is left out), so the app can
// always import its own export.

import { parseTake, type Take } from '../analysis/take.ts'
import { parseItem, parseReviewLog, type Item, type ReviewLog } from '../practice/items.ts'
import { parseSettings, toStored } from './settings.ts'

export const BACKUP_APP = 'keyflow'

/** The rows a backup holds, ready to write. Takes and logs get new ids on import. */
export interface BackupData {
  /** Setting → value, as stored: only the settings that differ from their defaults. */
  settings: Record<string, unknown>
  takes: Take[]
  items: Item[]
  reviewLogs: ReviewLog[]
}

export interface Backup extends BackupData {
  app: typeof BACKUP_APP
  /** The database version it was exported from. */
  version: number
  exportedAt: string
}

/** Every table's rows, as stored and unchecked. */
export interface Dump {
  settings: Record<string, unknown>
  takes: unknown[]
  items: unknown[]
  reviewLogs: unknown[]
}

export const NOT_A_BACKUP = 'That file isn’t a Keyflow backup, so nothing was imported.'
export const NEWER_BACKUP =
  'That backup comes from a newer Keyflow. Reload the page to update the app, then import it again.'
export const DAMAGED_BACKUP =
  'Part of that backup can’t be read, so nothing was imported and your data is as it was.'

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const settingsOf = (raw: unknown) =>
  Object.fromEntries(
    Object.entries(toStored(parseSettings(raw))).filter(([, v]) => v !== undefined),
  )

const keep = <T>(rows: unknown[], parse: (r: unknown) => T | null): T[] =>
  rows.flatMap((r) => parse(r) ?? [])

export function toBackup(dump: Dump, version: number, now: Date): Backup {
  return {
    app: BACKUP_APP,
    version,
    exportedAt: now.toISOString(),
    settings: settingsOf(dump.settings),
    takes: keep(dump.takes, parseTake),
    items: keep(dump.items, parseItem),
    reviewLogs: keep(dump.reviewLogs, parseReviewLog),
  }
}

/** Every row checked, or a message saying why nothing can be imported. */
function all<T>(rows: unknown[], parse: (r: unknown) => T | null): T[] | null {
  const out = rows.map(parse)
  return out.includes(null) ? null : (out as T[])
}

/**
 * A parsed backup file, checked against the app's database `version`, or the message to show.
 * Settings are read like stored ones: one that's invalid falls back to its default.
 */
export function parseBackup(raw: unknown, version: number): BackupData | string {
  if (!isObj(raw) || raw.app !== BACKUP_APP || !Number.isInteger(raw.version)) return NOT_A_BACKUP
  if ((raw.version as number) > version) return NEWER_BACKUP
  // shortcut: every backup so far is from database version 3 (export came with it), so older
  // ones aren't converted; convert them here once the database changes again.
  const { settings, takes, items, reviewLogs } = raw
  if (!isObj(settings) || !Array.isArray(takes) || !Array.isArray(items)) return NOT_A_BACKUP
  if (!Array.isArray(reviewLogs)) return NOT_A_BACKUP
  const data = {
    takes: all(takes, parseTake),
    items: all(items, parseItem),
    reviewLogs: all(reviewLogs, parseReviewLog),
  }
  if (!data.takes || !data.items || !data.reviewLogs) return DAMAGED_BACKUP
  if (new Set(data.items.map((i) => i.id)).size !== data.items.length) return DAMAGED_BACKUP
  return {
    settings: settingsOf(settings),
    takes: data.takes,
    items: data.items,
    reviewLogs: data.reviewLogs,
  }
}
