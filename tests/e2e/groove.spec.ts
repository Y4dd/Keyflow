import { expect, test, type Page } from '@playwright/test'

// The groove player (P1-T2). Its event list is unit-tested as data (src/grooves/schedule.test.ts);
// here: the transport runs and counts in, the controls reach it while it plays, and no groove
// note is left sounding by Stop, a key change or the end of a pass. Browsers are muted.

interface DevApi {
  groove: { ticks(): number | null; heldCount(): number }
  render(spec: unknown): Promise<{ windows: { rmsDb: number; hf: number }[] }>
}
type DevWindow = Window & { __keyflow?: DevApi }

const BAR = 4 * 192

async function open(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
}

const ticks = (page: Page) => page.evaluate(() => (window as DevWindow).__keyflow!.groove.ticks())
const held = (page: Page) =>
  page.evaluate(() => (window as DevWindow).__keyflow!.groove.heldCount())
const card = (page: Page) => page.getByTestId('groove')

async function startSound(page: Page) {
  await page.getByRole('button', { name: 'Start audio' }).click()
  await expect(page.getByTestId('audio-status')).toHaveAttribute('data-status', 'running')
}

test('plays after a count-in, follows key and tempo changes, and Stop leaves nothing sounding', async ({
  page,
}) => {
  await open(page)
  const play = card(page).getByRole('button', { name: 'Play' })
  await expect(play).toBeDisabled()
  await expect(card(page)).toContainText('Turn sound on to play the groove.')
  await startSound(page)

  await play.click()
  const stop = card(page).getByRole('button', { name: 'Stop' })
  await expect(stop).toHaveAttribute('aria-pressed', 'true')
  // The count-in bar is groove bar −1; the groove proper starts at tick 0.
  const first = await ticks(page)
  expect(first).not.toBeNull()
  expect(first!).toBeLessThan(0)
  expect(first!).toBeGreaterThanOrEqual(-BAR)
  await expect.poll(() => ticks(page), { timeout: 5000 }).toBeGreaterThan(BAR / 2)

  // Bass and chords sound once the groove is going (the vamp's bass starts on beat 1).
  await expect.poll(() => held(page), { timeout: 5000 }).toBeGreaterThan(0)

  // Key and tempo change while it plays; it keeps running.
  await card(page).getByLabel('Key').selectOption({ label: 'F minor' })
  await card(page).getByLabel('Tempo').fill('140')
  await expect(card(page).getByText('140 BPM')).toBeVisible()
  const before = (await ticks(page))!
  await expect.poll(() => ticks(page)).toBeGreaterThan(before + BAR / 4)

  await stop.click()
  await expect(card(page).getByRole('button', { name: 'Play' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  expect(await ticks(page)).toBeNull()
  expect(await held(page)).toBe(0)
  // Nothing scheduled before the stop starts a note afterwards.
  await page.waitForTimeout(300)
  expect(await held(page)).toBe(0)

  // Play right after Stop starts cleanly from the top again.
  await card(page).getByRole('button', { name: 'Play' }).click()
  await card(page).getByRole('button', { name: 'Stop' }).click()
  await card(page).getByRole('button', { name: 'Play' }).click()
  await expect.poll(() => ticks(page), { timeout: 5000 }).toBeGreaterThan(0)
  await card(page).getByRole('button', { name: 'Stop' }).click()
  expect(await held(page)).toBe(0)
})

test('with Loop off it plays its bars once and stops by itself', async ({ page }) => {
  await open(page)
  await startSound(page)
  await card(page).getByLabel('Loop').uncheck()
  await card(page).getByLabel('Count-in').uncheck()
  await card(page).getByLabel('Tempo').fill('140') // 4 bars ≈ 6.9 s
  await card(page).getByRole('button', { name: 'Play' }).click()
  expect((await ticks(page))!).toBeGreaterThanOrEqual(0)
  await expect(card(page).getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 12_000 })
  expect(await ticks(page)).toBeNull()
  expect(await held(page)).toBe(0)
})

// Offline renders: the synced wobble runs at the tempo's 8ths or 16ths. Rendered through the
// same voice with the same start, a synced LFO and a free one at the same rate match window
// for window; another rate doesn't.
test('Wobble sync ties the wobble rate to the tempo', async ({ page }) => {
  await open(page)
  const windows: [number, number][] = Array.from({ length: 12 }, (_, i) => [
    0.2 + i * 0.07,
    0.25 + i * 0.07,
  ])
  const hf = (knobs: Record<string, number>, bpm: number, lfoRestartAt?: number) =>
    page
      .evaluate((spec) => (window as DevWindow).__keyflow!.render(spec), {
        preset: 'wobble-bass',
        knobs,
        bpm,
        lfoRestartAt,
        notes: [{ note: 36, velocity: 1, on: 0.05, off: 1.2 }],
        duration: 1.3,
        master: false,
        windows,
      })
      .then((r) => r.windows.map((w) => w.hf))

  const free4 = await hf({ lfoSync: 0, lfoRate: 4 }, 120)
  const eighthsAt120 = await hf({ lfoSync: 1 }, 120) // 2 a beat at 2 beats/s: 4 Hz
  const sixteenthsAt60 = await hf({ lfoSync: 2 }, 60) // 4 a beat at 1 beat/s: 4 Hz
  const sixteenthsAt120 = await hf({ lfoSync: 2 }, 120) // 8 Hz
  const gap = (a: number[], b: number[]) => Math.max(...a.map((x, i) => Math.abs(x - b[i]!)))
  const spread = Math.max(...free4) - Math.min(...free4)
  expect(spread).toBeGreaterThan(0.01) // the wobble is there to compare
  expect(gap(free4, eighthsAt120)).toBeLessThan(spread / 10)
  expect(gap(free4, sixteenthsAt60)).toBeLessThan(spread / 10)
  expect(gap(free4, sixteenthsAt120)).toBeGreaterThan(spread / 4)

  // A groove start restarts the cycle: half a cycle (0.125 s at 4 Hz) off the free-running
  // phase, and the same phase whichever cycle it restarts on. Windows from 0.7 s are after both.
  const late = (w: number[]) => w.slice(8)
  const restartA = await hf({ lfoSync: 1 }, 120, 0.425)
  const restartB = await hf({ lfoSync: 1 }, 120, 0.675)
  expect(gap(late(restartA), late(restartB))).toBeLessThan(spread / 10)
  expect(gap(late(restartA), late(eighthsAt120))).toBeGreaterThan(spread / 4)
})

// P1-T3: each shipped groove plays from the menu at its own key and tempo, and switching while
// one plays restarts cleanly with nothing left sounding afterwards.
test('every groove in the menu plays at its own key and tempo', async ({ page }) => {
  await open(page)
  await startSound(page)
  await card(page).getByLabel('Count-in').uncheck()
  await card(page).getByRole('button', { name: 'Play' }).click()
  const menu = card(page).getByRole('combobox', { name: 'Groove' })
  for (const [name, key, bpm] of [
    ['Soul groove', 'E♭ major', 84],
    ['Slow jam', 'D♭ major', 70],
    ['Boogie', 'E minor', 116],
    ['Electro-funk vamp', 'D minor', 108],
  ] as const) {
    await expect.poll(() => ticks(page), { timeout: 8000 }).toBeGreaterThan(BAR)
    await menu.selectOption({ label: name })
    await expect.poll(() => ticks(page)).toBeLessThan(BAR / 2)
    await expect(card(page).getByRole('heading')).toContainText(name)
    await expect(card(page).getByLabel('Key').locator('option:checked')).toHaveText(key)
    await expect(card(page).getByText(`${bpm} BPM`)).toBeVisible()
    // Restarted from the top, and its bass and chords sound.
    await expect.poll(() => ticks(page), { timeout: 5000 }).toBeGreaterThan(BAR / 4)
    await expect.poll(() => held(page), { timeout: 5000 }).toBeGreaterThan(0)
  }
  await card(page).getByRole('button', { name: 'Stop' }).click()
  expect(await held(page)).toBe(0)
  await page.waitForTimeout(300)
  expect(await held(page)).toBe(0)
})
