import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// The e2e build has dev tools on (see playwright.config.ts), so window.__keyflow exists.
interface DevApi {
  inject(events: unknown[]): Promise<void>
  replay(fixture: unknown): Promise<void>
  stop(): void
}
type DevWindow = Window & { __keyflow?: DevApi }

async function open(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
  return page.getByRole('group', { name: 'On-screen piano' })
}

const key = (piano: ReturnType<Page['getByRole']>, note: number) =>
  piano.locator(`[data-note="${note}"]`)

test('an injected chord lights the on-screen keys and shows as held', async ({ page }) => {
  const piano = await open(page)
  await page.evaluate(() =>
    (window as DevWindow).__keyflow!.inject([
      { kind: 'noteOn', note: 60 },
      { kind: 'noteOn', note: 64 },
      { kind: 'noteOn', note: 67 },
    ]),
  )
  for (const note of [60, 64, 67]) {
    await expect(key(piano, note)).toHaveAttribute('data-held', 'true')
  }
  await expect(key(piano, 62)).toHaveAttribute('data-held', 'false')
  await expect(page.getByTestId('held-notes')).toHaveText('C4 (60) E4 (64) G4 (67)')

  await page.evaluate(() => (window as DevWindow).__keyflow!.stop())
  for (const note of [60, 64, 67]) {
    await expect(key(piano, note)).toHaveAttribute('data-held', 'false')
  }
  await expect(page.getByTestId('held-notes')).toHaveText('none')
})

test('a timed chord releases on its own', async ({ page }) => {
  const piano = await open(page)
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
  await expect(key(piano, 55)).toHaveAttribute('data-held', 'false')
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
  const piano = await open(page)
  await page.keyboard.down('KeyA')
  await expect(key(piano, 60)).toHaveAttribute('data-held', 'true')
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
  const piano = await open(page)
  await key(piano, 62).scrollIntoViewIfNeeded()
  const box = await key(piano, 62).boundingBox()
  if (!box) throw new Error('D4 key not rendered')
  // Low on the key, below the black keys.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.85)
  await page.mouse.down()
  await expect(key(piano, 62)).toHaveAttribute('data-held', 'true')
  await expect(page.getByTestId('held-notes')).toHaveText('D4 (62)')
  await page.mouse.up()
  await expect(key(piano, 62)).toHaveAttribute('data-held', 'false')
  await expect(page.getByTestId('held-notes')).toHaveText('none')
})

test.describe('touch', () => {
  test.use({ hasTouch: true })

  test('tapping an on-screen key plays and releases it', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Playwright emulates touch only in Chromium')
    const piano = await open(page)
    // The inspector loads lazily; its log reads this once it's listening.
    const log = page.getByTestId('event-log')
    await expect(log).toHaveText('No events yet.')
    await key(piano, 64).scrollIntoViewIfNeeded()
    const box = await key(piano, 64).boundingBox()
    if (!box) throw new Error('E4 key not rendered')
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.85)
    // A tap is too quick to catch the lit key, so check the inspector's event log.
    await expect(log).toContainText(/onscreen\s+noteOn\s+64/)
    await expect(log).toContainText(/onscreen\s+noteOff\s+64/)
    await expect(key(piano, 64)).toHaveAttribute('data-held', 'false')
  })
})
