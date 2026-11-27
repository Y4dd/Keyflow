import { expect, test, type Page } from '@playwright/test'

// The latency tap test (P0-T8), tapped through the sim source. Browsers are muted in e2e.
interface DevApi {
  inject(events: unknown[]): Promise<void>
  calibrationClicks(): { perf: number[]; context: number[] } | null
  flushSettings(): Promise<void>
}
type DevWindow = Window & { __keyflow?: DevApi }

async function start(page: Page) {
  await page.goto('/#/setup')
  await page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
  await page.getByRole('button', { name: 'Start audio' }).click()
  await expect(page.getByTestId('audio-status')).toHaveAttribute('data-status', 'running')
}

const NEAR_40_MS = /\+(3[7-9]|4[0-3]) ms/

const timing = (page: Page) => page.getByRole('region', { name: 'Timing' })

test('taps a known offset from the clicks and gets it back as the calibration', async ({
  page,
}) => {
  test.setTimeout(40_000)
  await start(page)
  await expect(timing(page).getByTestId('calibration-latency')).toContainText('Output latency')
  await timing(page).getByRole('button', { name: 'Calibrate' }).click()

  const clicks = await page.evaluate(() => (window as DevWindow).__keyflow!.calibrationClicks())
  expect(clicks?.perf).toHaveLength(16)
  // Scheduled on the audio clock, evenly, 600 ms apart (100 BPM).
  for (let i = 1; i < 16; i++) {
    expect(clicks!.context[i] - clicks!.context[i - 1]).toBeCloseTo(0.6, 6)
  }

  // The clock mapping is sane in this browser: the first click is in the near future.
  const result = await page.evaluate((offsets) => {
    const api = (window as DevWindow).__keyflow!
    const { perf } = api.calibrationClicks()!
    const now = performance.now()
    const lead = perf[0] - now
    // Taps 40 ms late on every beat after the count-in, one way off, one missed, and a stray
    // tap during the count-in.
    const events = perf.flatMap((click, i) => {
      const offset = i === 2 ? 250 : i < 4 || i === 9 ? null : i === 6 ? 200 : offsets
      if (offset === null) return []
      const at = click + offset - now
      return [
        { kind: 'noteOn', note: 60, at },
        { kind: 'noteOff', note: 60, at: at + 50 },
      ]
    })
    void api.inject(events)
    return lead
  }, 40)
  expect(result).toBeGreaterThan(0)
  expect(result).toBeLessThan(2000)

  const out = timing(page).getByTestId('calibration-result')
  await expect(out).toHaveAttribute('data-verdict', 'ok', { timeout: 15_000 })
  // The sim stamps taps from its own start, read after `now`, so a loaded runner adds a few ms
  // to the 40 ms: ±3 ms still catches a real calibration bug (a wrong sign or a missing 2x).
  await expect(out).toContainText(NEAR_40_MS)
  await expect(out).toContainText('10 of 12 beats')
  await expect(timing(page).getByRole('button', { name: 'Calibrate' })).toBeEnabled()

  // Saved with the settings (P0-T9): a reload keeps the offset.
  await page.evaluate(() => (window as DevWindow).__keyflow!.flushSettings())
  await page.reload()
  await expect(timing(page).getByTestId('calibration-saved')).toContainText(NEAR_40_MS)
})

test('stopping a run leaves no result and allows a new one', async ({ page }) => {
  await start(page)
  await timing(page).getByRole('button', { name: 'Calibrate' }).click()
  await timing(page).getByRole('button', { name: 'Stop' }).click()
  expect(await page.evaluate(() => (window as DevWindow).__keyflow!.calibrationClicks())).toBeNull()
  await expect(timing(page).getByTestId('calibration-result')).toHaveCount(0)
  await expect(timing(page).getByRole('button', { name: 'Calibrate' })).toBeEnabled()
})
