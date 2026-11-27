import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

// Data export and import (P2-T8): export → wipe → import brings back every table, and a file
// that can't be imported leaves the data as it was. The checks on each row are unit-tested
// (src/storage/backup.test.ts).

interface Dump {
  settings: Record<string, unknown>
  takes: Record<string, unknown>[]
  items: Record<string, unknown>[]
  reviewLogs: Record<string, unknown>[]
}
interface DevApi {
  dump(): Promise<Dump>
  flushSettings(): Promise<void>
  items: {
    record(id: string, rating: number, attempt: object, now?: number): Promise<{ id: string }>
  }
}
type DevWindow = Window & { __keyflow?: DevApi }

const ready = (page: Page) =>
  page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
// audioStarted is left out: the app saves it whenever sound starts, which an Export click does,
// at a moment that varies (later than the export under load in Firefox).
const dump = async (page: Page): Promise<Dump> => {
  const d = await page.evaluate(() => (window as DevWindow).__keyflow!.dump())
  const { audioStarted: _, ...settings } = d.settings
  return { ...d, settings }
}
// Takes and logs get new ids on import.
const withoutIds = (d: Dump) => ({
  ...d,
  takes: d.takes.map((t) => ({ ...t, id: undefined })),
  reviewLogs: d.reviewLogs.map((l) => ({ ...l, id: undefined })),
})

const NOW = Date.parse('2026-11-27T10:00:00Z')

async function seed(page: Page) {
  await page.getByLabel('Show the computer-key letters on the keys').uncheck()
  await page.evaluate(async (now) => {
    const api = (window as DevWindow).__keyflow!
    await api.flushSettings()
    await api.items.record('chord:E:min:root', 3, { ms: 2100, hintLevel: 1, wrongNotes: 2 }, now)
    await api.items.record('geo:F#', 1, { ms: null, hintLevel: 3, wrongNotes: 4 }, now)
    // a take, written straight to the store as a recording would save it
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('keyflow')
      req.onerror = () => reject(req.error)
      req.onsuccess = () => {
        const tx = req.result.transaction('takes', 'readwrite')
        tx.objectStore('takes').add({
          format: 1,
          createdAt: now,
          grooveId: 'electro-funk-vamp',
          tonic: 9,
          bpm: 104,
          scale: 'minor pentatonic',
          countIn: true,
          lengthMs: 2000,
          events: [
            { kind: 'noteOn', note: 64, velocity: 0.6, at: 100 },
            { kind: 'noteOff', note: 64, at: 400 },
          ],
          offsetMs: null,
          offsetLeadMs: null,
          leadMs: null,
        })
        tx.oncomplete = () => {
          req.result.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }
    })
  }, NOW)
}

async function exportFile(page: Page): Promise<string> {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^keyflow-backup-\d{4}-\d{2}-\d{2}\.json$/)
  return readFile((await file.path())!, 'utf8')
}

async function importFile(page: Page, json: string) {
  await page
    .getByLabel('Backup file to import')
    .setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(json) })
}

test('export, wipe and import bring every table back', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await seed(page)
  const json = await exportFile(page)
  expect(JSON.parse(json)).toMatchObject({ app: 'keyflow', version: 3 })
  // after the export: its click starts sound, and the export saves that setting first
  const before = await dump(page)
  expect(before.items).toHaveLength(2)
  expect(before.reviewLogs).toHaveLength(2)
  expect(before.takes).toHaveLength(1)
  expect(before.settings).toMatchObject({ keyLetters: false })

  // wipe: a fresh database, as in a new browser
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const del = indexedDB.deleteDatabase('keyflow') // Dexie closes on versionchange
        del.onsuccess = () => resolve()
        del.onerror = () => reject(del.error)
      }),
  )
  await page.reload()
  await ready(page)
  await expect(page.getByLabel('Show the computer-key letters on the keys')).toBeChecked()
  expect(await dump(page)).toEqual({ settings: {}, takes: [], items: [], reviewLogs: [] })

  page.once('dialog', (d) => void d.accept())
  const reloaded = page.waitForEvent('load')
  await importFile(page, json)
  await reloaded
  await ready(page)
  await expect(page.getByLabel('Show the computer-key letters on the keys')).not.toBeChecked()
  expect(withoutIds(await dump(page))).toEqual(withoutIds(before))
  await expect(page.getByTestId('takes')).toContainText('1 take')

  // an imported card still schedules
  await page.evaluate(
    (now) =>
      (window as DevWindow).__keyflow!.items.record(
        'chord:E:min:root',
        3,
        { ms: 1500, hintLevel: 0, wrongNotes: 0 },
        now,
      ),
    NOW + 5 * 86_400_000,
  )
})

test('a file that can’t be imported leaves the data as it was', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await seed(page)
  const good = JSON.parse(await exportFile(page)) as Record<string, unknown>
  const before = await dump(page)
  const status = page.getByTestId('data').getByRole('status')

  await importFile(page, 'not json')
  await expect(status).toContainText('isn’t a Keyflow backup')
  await importFile(page, JSON.stringify({ ...good, version: 99 }))
  await expect(status).toContainText('newer Keyflow')
  const damaged = { ...good, takes: [], items: [...(good.items as object[]), { id: 'geo:F#' }] }
  await importFile(page, JSON.stringify(damaged))
  await expect(status).toContainText('nothing was imported')

  // declining the confirmation imports nothing either
  page.once('dialog', (d) => void d.dismiss())
  await importFile(page, JSON.stringify({ ...good, takes: [] }))
  await expect(status).toHaveCount(0)
  expect(await dump(page)).toEqual(before)
})
