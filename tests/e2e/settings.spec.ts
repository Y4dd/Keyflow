import { expect, test, type Page } from '@playwright/test'

// Settings persistence (P0-T9) through the real IndexedDB, in both browsers. Each test gets a
// fresh browser context, so storage starts empty; a reload keeps it.
interface DevApi {
  inject(events: unknown[]): Promise<void>
  flushSettings(): Promise<void>
  audio: { heldByZone(): { main: number; left: number } }
}
type DevWindow = Window & { __keyflow?: DevApi }

async function open(page: Page) {
  await page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
}
const status = (page: Page) => page.getByTestId('audio-status')
const zone = (page: Page, title: 'Main sound' | 'Left sound') =>
  page.getByRole('group', { name: new RegExp(`^${title}`) })
const pedal = (page: Page) => page.getByRole('radiogroup', { name: 'Pedal' })
// Settings live in Setup, the help on the keys in Jam (P2-T12).
async function go(page: Page, view: 'Jam' | 'Setup') {
  const link = page.getByRole('link', { name: view, exact: true })
  await link.click()
  await expect(link).toHaveAttribute('aria-current', 'page') // the old view is gone
}
const help = (page: Page) => page.getByRole('combobox', { name: 'Help on the keys' })

test('settings survive a reload and reach the sound', async ({ page }) => {
  await page.goto('/#/setup')
  await open(page)
  await expect(status(page)).toContainText('Browsers start sound only after a click')
  await page.getByRole('button', { name: 'Start audio' }).click()
  await expect(status(page)).toHaveAttribute('data-status', 'running')

  await page.getByLabel('Split point').selectOption({ label: 'C3' })
  await zone(page, 'Main sound')
    .getByLabel(/EP Keys/)
    .check()
  await zone(page, 'Left sound')
    .getByRole('combobox', { name: /^Octave/ })
    .selectOption('-1')
  await zone(page, 'Main sound')
    .getByLabel(/Brightness/)
    .fill('200')
  await pedal(page).getByLabel(/Bend/).check()
  await page.getByLabel('Bend amount').selectOption('1')
  await page.getByLabel(/Bend time/).fill('250')
  await page.getByLabel('Bend key').selectOption({ label: 'Off' })
  await page.getByLabel(/Invert pedal/).check()
  await page.getByLabel('Show the computer-key letters on the keys').uncheck()
  await page.getByLabel(/Name the chord/).uncheck()
  await go(page, 'Jam')
  await help(page).selectOption({ label: 'Spotlight with names' })
  await go(page, 'Setup')
  await page.evaluate(() => (window as DevWindow).__keyflow!.flushSettings())
  // Only what differs from the defaults is stored: no device or calibration row, and the layout
  // row holds just the changed fields, so later default changes still reach this user.
  const rows = await page.evaluate(
    () =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        const req = indexedDB.open('keyflow')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const all = req.result.transaction('settings').objectStore('settings').getAll()
          all.onsuccess = () => {
            req.result.close()
            const list = all.result as { key: string; value: unknown }[]
            resolve(Object.fromEntries(list.map((r) => [r.key, r.value])))
          }
          all.onerror = () => reject(all.error)
        }
      }),
  )
  expect(Object.keys(rows).sort()).toEqual([
    'audioStarted',
    'bendKey',
    'chordName',
    'expression',
    'invertPedal',
    'keyLetters',
    'knobs',
    'layout',
    'look',
  ])
  expect(rows.layout).toEqual({
    splitNote: 48,
    main: { presetId: 'ep-keys' },
    left: { octave: -1 },
  })

  await page.reload()
  await open(page)
  await expect(page.getByLabel('Split point')).toHaveValue('48')
  await expect(zone(page, 'Main sound').getByLabel(/EP Keys/)).toBeChecked()
  await expect(zone(page, 'Left sound').getByRole('combobox', { name: /^Octave/ })).toHaveValue(
    '-1',
  )
  await expect(zone(page, 'Main sound').locator('output')).toHaveText('20%')
  await expect(pedal(page).getByLabel(/Bend/)).toBeChecked()
  await expect(page.getByLabel('Bend amount')).toHaveValue('1')
  await expect(page.getByLabel(/Bend time/)).toHaveValue('250')
  await expect(page.getByLabel('Bend key')).toHaveValue('')
  await expect(page.getByLabel(/Invert pedal/)).toBeChecked()
  await expect(page.getByLabel('Show the computer-key letters on the keys')).not.toBeChecked()
  await expect(page.getByLabel(/Name the chord/)).not.toBeChecked()
  await expect(page.getByTestId('chord-name')).toBeHidden()
  // Sound ran last time: the page says a click brings it back (it can't start by itself).
  await expect(status(page)).toHaveAttribute('data-status', 'off')
  await expect(status(page)).toContainText('Your sound settings are back')

  // The engine built after the reload uses the restored split (C3): B2 is the left sound's.
  await page.getByRole('button', { name: 'Start audio' }).click()
  await expect(status(page)).toHaveAttribute('data-status', 'running')
  await page.evaluate(() =>
    (window as DevWindow).__keyflow!.inject([
      { kind: 'noteOn', note: 47 },
      { kind: 'noteOn', note: 48 },
    ]),
  )
  await expect
    .poll(() => page.evaluate(() => (window as DevWindow).__keyflow!.audio.heldByZone()))
    .toEqual({ left: 1, main: 1 })
  await go(page, 'Jam') // a click: so only once sound is on
  await expect(help(page).locator('option:checked')).toHaveText('Spotlight with names')
})

test('damaged stored settings fall back to defaults, and the app still works', async ({ page }) => {
  await page.goto('/#/setup')
  await open(page)
  await page.evaluate(() => (window as DevWindow).__keyflow!.flushSettings())
  // Write junk straight into the settings table, as an older or broken version might.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('keyflow')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const tx = req.result.transaction('settings', 'readwrite')
          const store = tx.objectStore('settings')
          store.put({ key: 'layout', value: { splitNote: 'high', main: { presetId: 'gone' } } })
          store.put({ key: 'expression', value: 42 })
          tx.oncomplete = () => {
            req.result.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
  )
  await page.reload()
  await open(page)
  await expect(page.getByLabel('Split point')).toHaveValue('55')
  await expect(zone(page, 'Main sound').getByLabel(/Funk Lead/)).toBeChecked()
  await expect(pedal(page).getByLabel(/Sustain/)).toBeChecked()
})
