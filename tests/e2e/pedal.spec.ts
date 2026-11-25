import { expect, test, type Page } from '@playwright/test'

// Pedal modes and bend substitutes (P0-T7), through the sim source and the real controls.
// Dev tools are on in the e2e build (see playwright.config.ts). Browsers are muted there.
type SimEvent = { kind: 'noteOn' | 'noteOff'; note: number } | { kind: 'pedal'; down: boolean }
interface Targets {
  sustain: boolean
  glideHold: boolean
  bend: number
}
interface RenderResult {
  pitches: (number | null)[]
}
interface DevApi {
  inject(events: SimEvent[]): Promise<void>
  stop(): void
  audio: { heldByZone(): { main: number; left: number }; expression(): Targets | null }
  render(spec: unknown): Promise<RenderResult>
}
type DevWindow = Window & { __keyflow?: DevApi }

async function start(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
  await page.getByRole('button', { name: 'Start audio' }).click()
  await expect(page.getByTestId('audio-status')).toHaveAttribute('data-status', 'running')
}

const inject = (page: Page, events: SimEvent[]) =>
  page.evaluate((e) => (window as DevWindow).__keyflow!.inject(e), events)
const heldByZone = (page: Page) =>
  page.evaluate(() => (window as DevWindow).__keyflow!.audio.heldByZone())
const targets = (page: Page) =>
  page.evaluate(() => (window as DevWindow).__keyflow!.audio.expression())
const pedal = (page: Page) => page.getByRole('radiogroup', { name: 'Pedal' })

test('sustain holds both sounds until the pedal lifts', async ({ page }) => {
  await start(page)
  await expect(pedal(page).getByLabel(/Sustain/)).toBeChecked()
  await inject(page, [
    { kind: 'pedal', down: true },
    { kind: 'noteOn', note: 40 },
    { kind: 'noteOn', note: 72 },
    { kind: 'noteOff', note: 40 },
    { kind: 'noteOff', note: 72 },
  ])
  expect(await heldByZone(page)).toEqual({ left: 1, main: 1 })
  // A sustained key pressed again is held twice; both releases arrive on pedal up.
  await inject(page, [
    { kind: 'noteOn', note: 72 },
    { kind: 'noteOff', note: 72 },
  ])
  await inject(page, [{ kind: 'pedal', down: false }])
  expect(await heldByZone(page)).toEqual({ left: 0, main: 0 })
})

test('EP Keys: a sustained note whose voice was stolen can be pressed again and held', async ({
  page,
}) => {
  await start(page)
  await page
    .getByRole('group', { name: /^Main sound/ })
    .getByLabel(/EP Keys/)
    .check()
  // Eleven sustained notes on ten voices: the first one's voice is stolen.
  const notes = Array.from({ length: 11 }, (_, i) => 60 + i)
  await inject(page, [
    { kind: 'pedal', down: true },
    ...notes.flatMap((note): SimEvent[] => [
      { kind: 'noteOn', note },
      { kind: 'noteOff', note },
    ]),
    { kind: 'noteOn', note: 60 },
    { kind: 'pedal', down: false },
  ])
  expect(await heldByZone(page)).toEqual({ left: 0, main: 1 })
  await inject(page, [{ kind: 'noteOff', note: 60 }])
  expect(await heldByZone(page)).toEqual({ left: 0, main: 0 })
})

test('bend and glide-hold modes: the pedal bends or forces glide instead of sustaining', async ({
  page,
}) => {
  await start(page)
  await pedal(page).getByLabel(/Bend/).check()
  await inject(page, [
    { kind: 'noteOn', note: 72 },
    { kind: 'pedal', down: true },
    { kind: 'noteOff', note: 72 },
  ])
  expect(await targets(page)).toEqual({ sustain: false, glideHold: false, bend: 2 })
  expect(await heldByZone(page)).toEqual({ left: 0, main: 0 }) // no sustain in this mode
  await page.getByLabel('Bend amount').selectOption('1')
  expect((await targets(page))?.bend).toBe(1)
  await inject(page, [{ kind: 'pedal', down: false }])
  expect((await targets(page))?.bend).toBe(0)

  // Switching mode with the pedal down leaves the old mode as if the pedal lifted.
  await inject(page, [{ kind: 'pedal', down: true }])
  await pedal(page)
    .getByLabel(/Glide-hold/)
    .check()
  expect(await targets(page)).toEqual({ sustain: false, glideHold: true, bend: 0 })
  await inject(page, [{ kind: 'pedal', down: false }])
  expect((await targets(page))?.glideHold).toBe(false)
})

test('the bend key bends while held, and Space still works on a control reached with Tab', async ({
  page,
}) => {
  await start(page)
  const invert = page.getByLabel(/Invert pedal/)
  await invert.click() // focused by a click: Space bends instead of toggling it
  await expect(invert).toBeChecked()
  await page.keyboard.down('Space')
  expect((await targets(page))?.bend).toBe(2)
  await page.keyboard.up('Space')
  expect((await targets(page))?.bend).toBe(0)
  await expect(invert).toBeChecked()

  // Reached from the keyboard, the checkbox keeps Space for itself.
  await pedal(page)
    .getByLabel(/Sustain/)
    .click()
  await page.keyboard.press('Tab')
  await expect(invert).toBeFocused()
  await page.keyboard.press('Space')
  await expect(invert).not.toBeChecked()
  expect((await targets(page))?.bend).toBe(0)

  // Another key, or none. (Clicking the heading moves focus off the Tab-focused checkbox.)
  await page.getByRole('heading', { name: 'Keyflow' }).click()
  await page.getByLabel('Bend key').selectOption({ label: '\\' })
  await page.keyboard.down('Backslash')
  expect((await targets(page))?.bend).toBe(2)
  await page.keyboard.up('Backslash')
  await page.getByLabel('Bend key').selectOption({ label: 'Off' })
  await page.keyboard.down('Backslash')
  expect((await targets(page))?.bend).toBe(0)
  await page.keyboard.up('Backslash')
})

test('scrolling over the on-screen keys bends, then springs back to center', async ({ page }) => {
  await start(page)
  await page.getByRole('group', { name: 'On-screen piano' }).hover()
  const scrollBefore = await page.evaluate(() => window.scrollY)
  await page.mouse.wheel(0, -100) // up: one semitone up
  await expect.poll(async () => (await targets(page))?.bend).toBeGreaterThan(0)
  await expect.poll(async () => (await targets(page))?.bend).toBe(0)
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore)
})

for (const preset of ['funk-lead', 'ep-keys'] as const) {
  test(`${preset}: a bend moves a held note's pitch up by the bend and back`, async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
    // A3 (220 Hz) bent up 2 semitones (246.9 Hz) at 0.4 s, back at 0.9 s, each over 0.1 s.
    const r = await page.evaluate((spec) => (window as DevWindow).__keyflow!.render(spec), {
      preset,
      notes: [{ note: 57, velocity: 0.8, on: 0.05, off: 1.4 }],
      bends: [
        { at: 0.4, semitones: 2, ramp: 0.1 },
        { at: 0.9, semitones: 0, ramp: 0.1 },
      ],
      duration: 1.5,
      windows: [
        [0.15, 0.35],
        [0.6, 0.85],
        [1.1, 1.35],
      ],
      pitchRange: [180, 300],
    })
    const cents = (hz: number | null, ref: number) => 1200 * Math.log2((hz ?? 0) / ref)
    const [before, bent, after] = r.pitches
    expect(Math.abs(cents(before, 220))).toBeLessThan(10)
    expect(Math.abs(cents(bent, 220 * 2 ** (2 / 12)))).toBeLessThan(10)
    expect(Math.abs(cents(after, 220))).toBeLessThan(10)
  })
}
