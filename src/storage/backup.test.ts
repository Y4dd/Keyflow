import { describe, expect, it } from 'vitest'
import { Rating } from 'ts-fsrs'
import { TAKE_FORMAT, type Take } from '../analysis/take.ts'
import { newItem, review } from '../practice/items.ts'
import {
  DAMAGED_BACKUP,
  NEWER_BACKUP,
  NOT_A_BACKUP,
  parseBackup,
  toBackup,
  type Dump,
} from './backup.ts'

const now = new Date('2026-11-27T10:00:00Z')
const take: Take = {
  format: TAKE_FORMAT,
  createdAt: now.getTime(),
  grooveId: 'electro-funk-vamp',
  tonic: 9,
  bpm: 104,
  scale: 'minor pentatonic',
  countIn: true,
  lengthMs: 2000,
  events: [
    { kind: 'noteOn', note: 60, velocity: 0.5, at: 10 },
    { kind: 'noteOff', note: 60, at: 300 },
  ],
  offsetMs: null,
  offsetLeadMs: null,
  leadMs: 12,
}
const reviewed = review(
  newItem('chord:E:min:root', now, now),
  Rating.Good,
  { ms: 2100, hintLevel: 1, wrongNotes: 2 },
  now,
)
const locked = newItem('geo:F#', now) // unlocked: null
const dump: Dump = {
  settings: { keyLetters: false, look: 'nope' }, // an invalid setting falls back to its default
  takes: [{ ...take, id: 4 }],
  items: [reviewed.item, locked],
  reviewLogs: [{ ...reviewed.log, id: 7 }],
}
// What the file holds once written and read back: Dates become strings.
const file = () => JSON.parse(JSON.stringify(toBackup(dump, 3, now))) as Record<string, unknown>

describe('backup', () => {
  it('an export imports back to the same rows, Dates and all', () => {
    const backup = toBackup(dump, 3, now)
    expect(backup).toMatchObject({ app: 'keyflow', version: 3, exportedAt: now.toISOString() })
    expect(parseBackup(file(), 3)).toEqual({
      settings: { keyLetters: false },
      takes: [take],
      items: [reviewed.item, locked],
      reviewLogs: [reviewed.log],
    })
  })

  it('an export leaves out a stored row that wouldn’t import', () => {
    const backup = toBackup({ ...dump, items: [...dump.items, { id: 'geo:F#', card: {} }] }, 3, now)
    expect(backup.items).toEqual([reviewed.item, locked])
  })

  it('rejects a file from a newer database', () => {
    expect(parseBackup({ ...file(), version: 4 }, 3)).toBe(NEWER_BACKUP)
  })

  const item = () => (file().items as Record<string, unknown>[])[0]!
  const log = () => (file().reviewLogs as Record<string, unknown>[])[0]!
  it.each<[string, () => unknown, string]>([
    ['not an object', () => 'hello', NOT_A_BACKUP],
    ['another app', () => ({ ...file(), app: 'other' }), NOT_A_BACKUP],
    ['no version', () => ({ ...file(), version: '3' }), NOT_A_BACKUP],
    ['no items list', () => ({ ...file(), items: {} }), NOT_A_BACKUP],
    ['settings a list', () => ({ ...file(), settings: [] }), NOT_A_BACKUP],
    ['a bad take', () => ({ ...file(), takes: [{ ...take, scale: 'x' }] }), DAMAGED_BACKUP],
    ['a bad item ID', () => ({ ...file(), items: [{ ...item(), id: 'chord:E' }] }), DAMAGED_BACKUP],
    [
      'a bad due date',
      () => ({
        ...file(),
        items: [{ ...item(), card: { ...(item().card as object), dueAt: 'soon' } }],
      }),
      DAMAGED_BACKUP,
    ],
    [
      'a card state the scheduler rejects',
      () => ({
        ...file(),
        items: [{ ...item(), card: { ...(item().card as object), state: 99 } }],
      }),
      DAMAGED_BACKUP,
    ],
    [
      'negative reps',
      () => ({ ...file(), items: [{ ...item(), card: { ...(item().card as object), reps: -3 } }] }),
      DAMAGED_BACKUP,
    ],
    [
      'a card field missing',
      () => ({ ...file(), items: [{ ...item(), card: { dueAt: now.toISOString() } }] }),
      DAMAGED_BACKUP,
    ],
    [
      'a bad unlock date',
      () => ({ ...file(), items: [{ ...item(), unlocked: 5 }] }),
      DAMAGED_BACKUP,
    ],
    ['a duplicate item', () => ({ ...file(), items: [item(), item()] }), DAMAGED_BACKUP],
    ['a bad rating', () => ({ ...file(), reviewLogs: [{ ...log(), rating: 0 }] }), DAMAGED_BACKUP],
    ['negative ms', () => ({ ...file(), reviewLogs: [{ ...log(), ms: -1 }] }), DAMAGED_BACKUP],
    [
      'a fractional hint',
      () => ({ ...file(), reviewLogs: [{ ...log(), hintLevel: 0.5 }] }),
      DAMAGED_BACKUP,
    ],
    ['no revlog', () => ({ ...file(), reviewLogs: [{ ...log(), revlog: null }] }), DAMAGED_BACKUP],
  ])('rejects %s', (_, raw, message) => expect(parseBackup(raw(), 3)).toBe(message))

  it('takes a log that never got the right answer (ms null)', () => {
    const data = parseBackup({ ...file(), reviewLogs: [{ ...log(), ms: null }] }, 3)
    expect(typeof data !== 'string' && data.reviewLogs[0]!.ms).toBeNull()
  })
})
