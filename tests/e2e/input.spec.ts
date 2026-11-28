import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// The e2e build has dev tools on (see playwright.config.ts), so window.__keyflow exists.
interface DevApi {
  inject(events: unknown[]): Promise<void>
  replay(fixture: unknown): Promise<void>
  stop(): void
  pianoKey(note: number): { x: number; y: number; lit: boolean } | null
}
type DevWindow = Window & { __keyflow?: DevApi }

async function open(page: Page) {
  await page.goto('/#/setup')
  await page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
  return page.getByRole('group', { name: 'On-screen piano' })
}

// The canvas keyboard has no element per key; the dev API says where a key is and if it's lit.
const pianoKey = (page: Page, note: number) =>
  page.evaluate((n) => (window as DevWindow).__keyflow!.pianoKey(n), note)
const lit = async (page: Page, note: number) => (await pianoKey(page, note))?.lit

async function keyPoint(page: Page, note: number) {
  await page.getByRole('group', { name: 'On-screen piano' }).scrollIntoViewIfNeeded()
  const point = await pianoKey(page, note)
  if (!point) throw new Error(`key ${note} not drawn`)
  return point
}

test('the keyboard draws the 61 keys, C2 to C7', async ({ page }) => {
  await open(page)
  expect(await pianoKey(page, 36)).not.toBeNull()
  expect(await pianoKey(page, 96)).not.toBeNull()
  expect(await pianoKey(page, 35)).toBeNull()
  expect(await pianoKey(page, 97)).toBeNull()
})

test('an injected chord lights the on-screen keys and shows as held', async ({ page }) => {
  await open(page)
  await page.evaluate(() =>
    (window as DevWindow).__keyflow!.inject([
      { kind: 'noteOn', note: 60 },
      { kind: 'noteOn', note: 64 },
      { kind: 'noteOn', note: 67 },
    ]),
  )
  for (const note of [60, 64, 67]) {
    await expect.poll(() => lit(page, note)).toBe(true)
  }
  await expect.poll(() => lit(page, 62)).toBe(false)
  await expect(page.getByTestId('held-notes')).toHaveText('C4 (60) E4 (64) G4 (67)')

  await page.evaluate(() => (window as DevWindow).__keyflow!.stop())
  for (const note of [60, 64, 67]) {
    await expect.poll(() => lit(page, note)).toBe(false)
  }
  await expect(page.getByTestId('held-notes')).toHaveText('none')
})

test('a timed chord releases on its own', async ({ page }) => {
  await open(page)
  await page.evaluate(() =>
    (window as DevWindow).__keyflow!.inject([
      { kind: 'noteOn', note: 52 },
      { kind: 'noteOn', note: 55 },
      { kind: 'noteOn', note: 59 },
      { kind: 'noteOff', note: 52, at: 300 },
      { kind: 'noteOff', note: 55, at: 300 },
      { kind: 'noteOff', note: 59, at: 300 },
    ]),
  )
  await expect.poll(() => lit(page, 55)).toBe(false)
  await expect(page.getByTestId('held-notes')).toHaveText('none')
})

test('a fixture replays through the MIDI parser', async ({ page }) => {
  await open(page)
  const fixture: unknown = JSON.parse(
    readFileSync('tests/fixtures/synthetic-chord-and-pedal.json', 'utf8'),
  )
  await page.evaluate((f) => (window as DevWindow).__keyflow!.replay(f), fixture)
  await expect(page.getByTestId('pedal')).toHaveText('up') // was "not used yet"
  await expect(page.getByTestId('held-notes')).toHaveText('none')
})

test('computer keys play notes, and Z/X shift the octave', async ({ page }) => {
  await open(page)
  await page.keyboard.down('KeyA')
  await expect.poll(() => lit(page, 60)).toBe(true)
  await expect(page.getByTestId('held-notes')).toHaveText('C4 (60)')
  await page.keyboard.up('KeyA')
  await expect(page.getByTestId('held-notes')).toHaveText('none')

  await expect(page.getByTestId('computer-range')).toHaveText('C4 to F5')
  await page.keyboard.press('KeyX')
  await expect(page.getByTestId('computer-range')).toHaveText('C5 to F6')
  await page.keyboard.down('KeyW')
  await expect(page.getByTestId('held-notes')).toHaveText('C#5 (73)')
  await page.keyboard.up('KeyW')
})

test('pressing an on-screen key plays it until release', async ({ page }) => {
  await open(page)
  const d4 = await keyPoint(page, 62)
  await page.mouse.move(d4.x, d4.y)
  await page.mouse.down()
  await expect.poll(() => lit(page, 62)).toBe(true)
  await expect(page.getByTestId('held-notes')).toHaveText('D4 (62)')
  await page.mouse.up()
  await expect.poll(() => lit(page, 62)).toBe(false)
  await expect(page.getByTestId('held-notes')).toHaveText('none')
})

test.describe('touch', () => {
  test.use({ hasTouch: true })

  test('tapping an on-screen key plays and releases it', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Playwright emulates touch only in Chromium')
    await open(page)
    // The inspector loads lazily; its log reads this once it's listening.
    const log = page.getByTestId('event-log')
    await expect(log).toHaveText('No events yet.')
    const e4 = await keyPoint(page, 64)
    await page.touchscreen.tap(e4.x, e4.y)
    // A tap is too quick to catch the lit key, so check the inspector's event log.
    await expect(log).toContainText(/onscreen\s+noteOn\s+64/)
    await expect(log).toContainText(/onscreen\s+noteOff\s+64/)
    await expect.poll(() => lit(page, 64)).toBe(false)
  })
})

// P2-T9: the readout names what is held, in the first groove's key (D minor).
test('the readout names a chord, an inversion, a note and a pedal-held chord', async ({ page }) => {
  await open(page)
  const inject = (events: unknown[]) =>
    page.evaluate((e) => (window as DevWindow).__keyflow!.inject(e), events)
  const on = (...notes: number[]) => notes.map((note) => ({ kind: 'noteOn', note }))
  const off = (...notes: number[]) => notes.map((note) => ({ kind: 'noteOff', note }))
  const label = page.getByTestId('chord-name')

  await inject(on(62, 65, 69))
  await expect(label).toHaveText('Dm · i')
  await inject([...off(62, 65, 69), ...on(65, 69, 74)])
  await expect(label).toHaveText('Dm/F · i')
  await inject([...off(65, 69, 74), ...on(62)])
  await expect(label).toHaveText('D')
  await inject(off(62))
  await expect(label).toHaveText('–')

  await inject([{ kind: 'pedal', down: true }, ...on(67, 70, 74), ...off(67, 70, 74)])
  await expect(label).toHaveText('Gm · iv')
  await inject([{ kind: 'pedal', down: false }])
  await expect(label).toHaveText('–')
})

test('one setting hides the chord name', async ({ page }) => {
  await open(page)
  await expect(page.getByTestId('chord-name')).toBeVisible()
  await page.getByLabel(/Name the chord/).uncheck()
  await expect(page.getByTestId('chord-name')).toBeHidden()
})
