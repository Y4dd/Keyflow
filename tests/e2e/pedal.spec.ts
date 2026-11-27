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
  audio: {
    heldByZone(): { main: number; left: number }
    expression(): Targets | null
    bendScale(): number[] | null
  }
  render(spec: unknown): Promise<RenderResult>
}
type DevWindow = Window & { __keyflow?: DevApi }

// Setup holds the pedal and sound controls (P2-T12).
async function start(page: Page) {
  await page.goto('/#/setup')
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
const bendScale = (page: Page) =>
  page.evaluate(() => (window as DevWindow).__keyflow!.audio.bendScale())

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
  expect(await targets(page)).toEqual({ sustain: false, glideHold: false, bend: 1 }) // default: one scale step
  expect(await heldByZone(page)).toEqual({ left: 0, main: 0 }) // no sustain in this mode
  await page.getByLabel('Bend amount').selectOption('2')
  expect((await targets(page))?.bend).toBe(2)
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
  expect((await targets(page))?.bend).toBe(1)
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
  expect((await targets(page))?.bend).toBe(1)
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
    await page.goto('/#/jam')
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

test('to next scale tone: the main sound bends in steps of the shown solo scale', async ({
  page,
}) => {
  await start(page)
  await pedal(page).getByLabel(/Bend/).check()
  const amount = page.getByLabel('Bend amount')
  await expect(amount).toHaveValue('scale') // the default
  // The vamp opens in D minor over D minor pentatonic: D F G A C.
  expect(await bendScale(page)).toEqual([2, 5, 7, 9, 0])
  await inject(page, [
    { kind: 'noteOn', note: 72 },
    { kind: 'pedal', down: true },
  ])
  expect((await targets(page))?.bend).toBe(1) // one step
  await page.getByRole('link', { name: 'Jam', exact: true }).click()
  await page
    .getByTestId('groove')
    .getByRole('combobox', { name: /^Key/ })
    .selectOption({ label: 'F minor' })
  expect(await bendScale(page)).toEqual([5, 8, 10, 0, 3])
  await page.getByRole('link', { name: 'Setup', exact: true }).click()
  await amount.selectOption('2')
  expect(await bendScale(page)).toBeNull()
  expect((await targets(page))?.bend).toBe(2)
  await inject(page, [
    { kind: 'pedal', down: false },
    { kind: 'noteOff', note: 72 },
  ])
})

// Rendered offline over D minor pentatonic (D F G A C), each bend a full step up.
const cents = (hz: number | null, ref: number) => 1200 * Math.log2((hz ?? 0) / ref)
const hz = (note: number) => 440 * 2 ** ((note - 69) / 12)
const D_MINOR_PENT = [2, 5, 7, 9, 0]

test('funk-lead: a scale bend lands on the next scale tone, and follows a legato move', async ({
  page,
}) => {
  await page.goto('/#/jam')
  await page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
  // D4 bent a step (to F, 3 semitones), F4 slurred in under the bend (to G, 2 semitones), then
  // lifted, back to the D still held (to F again).
  const r = await page.evaluate((spec) => (window as DevWindow).__keyflow!.render(spec), {
    preset: 'funk-lead',
    notes: [
      { note: 62, velocity: 0.8, on: 0.05, off: 1.5 },
      { note: 65, velocity: 0.8, on: 0.5, off: 0.95 },
    ],
    bends: [{ at: 0.1, semitones: 1, ramp: 0 }],
    bendScale: D_MINOR_PENT,
    duration: 1.6,
    windows: [
      [0.25, 0.45],
      [0.7, 0.9],
      [1.15, 1.4],
    ],
    pitchRange: [300, 450],
  })
  const [first, second, back] = r.pitches
  expect(Math.abs(cents(first, hz(65)))).toBeLessThan(10)
  expect(Math.abs(cents(second, hz(67)))).toBeLessThan(10)
  expect(Math.abs(cents(back, hz(65)))).toBeLessThan(10)
})

test('ep-keys: a note played under a scale bend starts at its own next scale tone', async ({
  page,
}) => {
  await page.goto('/#/jam')
  await page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
  // A4 played under a held step bend sounds C5 (3 semitones up).
  const r = await page.evaluate((spec) => (window as DevWindow).__keyflow!.render(spec), {
    preset: 'ep-keys',
    notes: [{ note: 69, velocity: 0.8, on: 0.2, off: 1.0 }],
    bends: [{ at: 0.1, semitones: 1, ramp: 0 }],
    bendScale: D_MINOR_PENT,
    duration: 1.1,
    windows: [[0.4, 0.8]],
    pitchRange: [400, 600],
  })
  expect(Math.abs(cents(r.pitches[0] ?? null, hz(72)))).toBeLessThan(10)
})

test('ep-keys: a held note bent a step lands on its next scale tone', async ({ page }) => {
  await page.goto('/#/jam')
  await page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
  // F4 held, then bent a step: to G (2 semitones). (A chord's two pitches can't be told apart
  // by the pitch estimate, so each voice's own step is only checked one note at a time.)
  const r = await page.evaluate((spec) => (window as DevWindow).__keyflow!.render(spec), {
    preset: 'ep-keys',
    notes: [{ note: 65, velocity: 0.8, on: 0.05, off: 1.2 }],
    bends: [{ at: 0.3, semitones: 1, ramp: 0 }],
    bendScale: D_MINOR_PENT,
    duration: 1.3,
    windows: [
      [0.1, 0.28],
      [0.5, 0.9],
    ],
    pitchRange: [300, 450],
  })
  const [before, bent] = r.pitches
  expect(Math.abs(cents(before ?? null, hz(65)))).toBeLessThan(10)
  expect(Math.abs(cents(bent ?? null, hz(67)))).toBeLessThan(10)
})
