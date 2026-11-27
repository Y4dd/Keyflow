import { expect, test, type Page } from '@playwright/test'

// Items (P2-T1): a rated attempt schedules the item's FSRS card, and the card and its log are
// in IndexedDB after a reload; the upgrade to database version 3 keeps settings and takes. The
// scheduling itself is unit-tested (src/practice/items.test.ts).

interface StoredItem {
  id: string
  card: { reps: number; dueAt: Date; stability: number }
  created: Date
  unlocked: Date | null
}
interface DevApi {
  items: {
    record(id: string, rating: number, attempt: object, now?: number): Promise<StoredItem>
    get(id: string): Promise<StoredItem | undefined>
    logs(id: string): Promise<Record<string, unknown>[]>
  }
}
type DevWindow = Window & { __keyflow?: DevApi }

async function open(page: Page) {
  await page.goto('/#/jam')
  await page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
}

const NOW = Date.parse('2026-11-27T10:00:00Z')
const GOOD = 3 // ts-fsrs Rating.Good

test('a rated attempt schedules the item and survives a reload', async ({ page }) => {
  await open(page)
  const recorded = await page.evaluate(
    ([now, good]) =>
      (window as DevWindow).__keyflow!.items.record(
        'chord:E:min:root',
        good,
        { ms: 2100, hintLevel: 1, wrongNotes: 2 },
        now,
      ),
    [NOW, GOOD] as const,
  )
  expect(recorded.card.reps).toBe(1)
  expect(recorded.card.dueAt.getTime()).toBeGreaterThan(NOW)

  await page.reload()
  await page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
  const { item, logs } = await page.evaluate(async () => {
    const api = (window as DevWindow).__keyflow!.items
    return { item: await api.get('chord:E:min:root'), logs: await api.logs('chord:E:min:root') }
  })
  expect(item).toEqual(recorded)
  expect(item!.created.getTime()).toBe(NOW)
  expect(item!.unlocked!.getTime()).toBe(NOW)
  expect(logs).toHaveLength(1)
  expect(logs[0]).toMatchObject({
    item: 'chord:E:min:root',
    rating: GOOD,
    ms: 2100,
    hintLevel: 1,
    wrongNotes: 2,
  })

  // a second attempt reschedules from the stored card
  const again = await page.evaluate(
    ([now, good]) =>
      (window as DevWindow).__keyflow!.items.record(
        'chord:E:min:root',
        good,
        { ms: 1500, hintLevel: 0, wrongNotes: 0 },
        now,
      ),
    [recorded.card.dueAt.getTime() + 86_400_000, GOOD] as const,
  )
  expect(again.card.reps).toBe(2)
  expect(again.card.stability).toBeGreaterThan(recorded.card.stability)
})

test('the database upgrade to version 3 keeps settings and takes', async ({ page }) => {
  await open(page)
  // Replace the database with a version 2 one (Dexie's version 2 is IndexedDB version 20), as
  // a visit before P2-T1 left it, holding one setting and one take.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const del = indexedDB.deleteDatabase('keyflow') // Dexie closes on versionchange
        del.onerror = () => reject(del.error)
        del.onsuccess = () => {
          const req = indexedDB.open('keyflow', 20)
          req.onupgradeneeded = () => {
            req.result.createObjectStore('settings', { keyPath: 'key' })
            req.result.createObjectStore('takes', { keyPath: 'id', autoIncrement: true })
          }
          req.onerror = () => reject(req.error)
          req.onsuccess = () => {
            const tx = req.result.transaction(['settings', 'takes'], 'readwrite')
            tx.objectStore('settings').put({ key: 'keyLetters', value: false })
            tx.objectStore('takes').put({ events: [], lengthMs: 1000 })
            tx.oncomplete = () => {
              req.result.close()
              resolve()
            }
            tx.onerror = () => reject(tx.error)
          }
        }
      }),
  )
  await page.reload()
  await page.getByRole('link', { name: 'Setup', exact: true }).click()
  await expect(page.getByLabel('Show the computer-key letters on the keys')).not.toBeChecked()
  await page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
  expect(
    await page.evaluate(() => (window as DevWindow).__keyflow!.items.get('geo:F#')),
  ).toBeUndefined()
  const stored = await page.evaluate(
    () =>
      new Promise<{ version: number; stores: string[]; takes: number }>((resolve, reject) => {
        const req = indexedDB.open('keyflow')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const db = req.result
          const count = db.transaction('takes').objectStore('takes').count()
          count.onsuccess = () => {
            resolve({
              version: db.version,
              stores: [...db.objectStoreNames],
              takes: count.result,
            })
            db.close()
          }
          count.onerror = () => reject(count.error)
        }
      }),
  )
  expect(stored).toEqual({
    version: 30,
    stores: ['items', 'reviewLogs', 'settings', 'takes'],
    takes: 1,
  })
})
