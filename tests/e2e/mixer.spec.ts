import { expect, test, type Page } from '@playwright/test'

// The mixer (P1-T6). Its gain math is unit-tested (src/audio/mixer.test.ts); here: the Mix
// controls reach the engine's channel buses and are saved, "you play bass" follows the split,
// and an offline render through the same buses goes silent when every part is muted.
// Browsers are muted.

type Gains = Record<'drums' | 'bass' | 'chords' | 'you', number>
interface DevApi {
  audio: { mixGains(): Gains | null }
  flushSettings(): Promise<void>
  renderGroove(spec: {
    groove: string
    bars: number
    mixer?: unknown
    countIn?: boolean
  }): Promise<{ peak: number; bars: number[]; dropouts: number }>
}
type DevWindow = Window & { __keyflow?: DevApi }

// The Mix is a drawer in Jam, the split a setting in Setup (P2-T12).
async function go(page: Page, view: 'Jam' | 'Setup') {
  const link = page.locator('.topbar').getByRole('link', { name: view, exact: true })
  await link.click()
  await expect(link).toHaveAttribute('aria-current', 'page') // the old view is gone
}
// Opened without a pointer: a click on the page would start sound (attachAudioUnlock).
const openMix = (page: Page) =>
  page
    .locator('details', { has: page.locator('summary', { hasText: 'Mix' }) })
    .evaluate((d) => ((d as HTMLDetailsElement).open = true))
async function setSplit(page: Page, on: boolean) {
  await go(page, 'Setup')
  await page.getByLabel('Split keyboard').setChecked(on)
  await go(page, 'Jam')
  await openMix(page)
}

async function open(page: Page) {
  await page.goto('/#/jam')
  await page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
  await openMix(page)
}

async function startSound(page: Page) {
  await page.getByRole('button', { name: 'Start audio' }).click()
  await expect(page.getByTestId('audio-status')).toHaveAttribute('data-status', 'running')
}

const gains = (page: Page) => page.evaluate(() => (window as DevWindow).__keyflow!.audio.mixGains())
const mix = (page: Page) => page.getByTestId('mix')

test('levels, mutes and "you play bass" reach the engine and survive a reload', async ({
  page,
}) => {
  await open(page)
  await startSound(page)
  expect(await gains(page)).toEqual({ drums: 1, bass: 1, chords: 1, you: 1 })

  await mix(page)
    .getByLabel(/^Drums/)
    .fill('-6')
  await expect(mix(page).getByText('−6 dB')).toBeVisible()
  await mix(page).getByLabel('Mute chords').check()
  await mix(page)
    .getByLabel(/^Your synth/)
    .fill('3')
  await expect.poll(async () => (await gains(page))!.drums).toBeCloseTo(0.501, 2)
  const g = (await gains(page))!
  expect(g.chords).toBe(0)
  expect(g.you).toBeCloseTo(1.413, 2)
  expect(g.bass).toBe(1)

  // "You play bass" mutes the groove bass only while the split is on (on by default).
  await setSplit(page, false)
  await mix(page)
    .getByLabel(/You play bass/)
    .check()
  expect((await gains(page))!.bass).toBe(1)
  await setSplit(page, true)
  await expect.poll(async () => (await gains(page))!.bass).toBe(0)
  await expect(mix(page).getByText('Yours')).toBeVisible()
  await setSplit(page, false)
  await expect.poll(async () => (await gains(page))!.bass).toBe(1)

  await page.evaluate(() => (window as DevWindow).__keyflow!.flushSettings())
  await page.reload()
  await page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
  await openMix(page)
  await expect(mix(page).getByLabel(/^Drums/)).toHaveValue('-6')
  await expect(mix(page).getByLabel('Mute chords')).toBeChecked()
  await expect(mix(page).getByLabel(/You play bass/)).toBeChecked()
  await startSound(page)
  const restored = (await gains(page))!
  expect(restored.drums).toBeCloseTo(0.501, 2)
  expect(restored.chords).toBe(0)
  expect(restored.you).toBeCloseTo(1.413, 2)
})

test('a groove rendered through the mixer: the bass alone sounds, "you play bass" silences it, the count-in stays', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await open(page)
  const flat = { db: 0, muted: false }
  const muted = { db: 0, muted: true }
  const bassOnly = {
    channels: { drums: muted, bass: flat, chords: muted, you: flat },
    youPlayBass: false,
  }
  const render = (mixer: unknown, countIn = false) =>
    page.evaluate((spec) => (window as DevWindow).__keyflow!.renderGroove(spec), {
      groove: 'electro-funk-vamp',
      bars: 2,
      mixer,
      countIn,
    })
  // The render has the split on, so "you play bass" applies there.
  expect((await render(bassOnly)).peak).toBeGreaterThan(0.05)
  const silent = { ...bassOnly, youPlayBass: true }
  expect((await render(silent)).peak).toBeLessThan(0.001)
  // Every part muted, the count-in bar still clicks: it goes past the drums bus.
  const { bars } = await render(silent, true)
  expect(bars[0]).toBeGreaterThan(0.01)
  expect(bars[1]).toBeLessThan(0.001)
})
