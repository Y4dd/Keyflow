import { expect, test, type Page } from '@playwright/test'

// Dev tools are on in the e2e build (see playwright.config.ts). Browsers are muted there.
interface RenderNote {
  note: number
  velocity: number
  on: number
  off: number
}
interface RenderSpec {
  preset: 'funk-lead' | 'wobble-bass' | 'ep-keys'
  knobs?: Record<string, number>
  notes: RenderNote[]
  duration: number
  master?: boolean
  windows?: [number, number][]
}
interface WindowStats {
  peak: number
  rmsDb: number
  hf: number
}
interface RenderResult {
  sampleRate: number
  peak: number
  onset: number | null
  windows: WindowStats[]
}
interface DevApi {
  inject(events: unknown[]): Promise<void>
  stop(): void
  audio: {
    heldCount(): number
    currentTime(): number | null
    latency(): {
      baseLatencyMs: number | null
      outputLatencyMs: number | null
      outputTimestamp: boolean
    } | null
  }
  render(spec: RenderSpec): Promise<RenderResult>
}
type DevWindow = Window & { __keyflow?: DevApi }

async function open(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
}

const status = (page: Page) => page.getByTestId('audio-status')
const held = (page: Page) => page.evaluate(() => (window as DevWindow).__keyflow!.audio.heldCount())
const render = (page: Page, spec: RenderSpec) =>
  page.evaluate((s) => (window as DevWindow).__keyflow!.render(s), spec)

test('sound starts on a click, reads the output latency, and plays injected notes', async ({
  page,
}) => {
  await open(page)
  await expect(status(page)).toHaveAttribute('data-status', 'off')

  // A keyboard note can't start audio; the panel says to click.
  await page.evaluate(() => (window as DevWindow).__keyflow!.inject([{ kind: 'noteOn', note: 60 }]))
  await expect(page.getByText('Your keyboard is playing, but sound is off.')).toBeVisible()
  await page.evaluate(() => (window as DevWindow).__keyflow!.stop())

  await page.getByRole('button', { name: 'Start audio' }).click()
  await expect(status(page)).toHaveAttribute('data-status', 'running')

  // The private-field route to outputLatency (src/audio/latency.ts) works in this browser.
  const latency = await page.evaluate(() => (window as DevWindow).__keyflow!.audio.latency())
  expect(latency?.outputTimestamp).toBe(true)
  expect(Number.isFinite(latency?.outputLatencyMs)).toBe(true)
  expect(Number.isFinite(latency?.baseLatencyMs)).toBe(true)
  await expect(page.getByTestId('audio-latency')).toHaveText(/Output latency: \d+ ms/)

  // The context clock runs.
  const t0 = await page.evaluate(() => (window as DevWindow).__keyflow!.audio.currentTime())
  await expect
    .poll(() => page.evaluate(() => (window as DevWindow).__keyflow!.audio.currentTime()))
    .toBeGreaterThan(t0! + 0.1)

  // Notes reach the engine: three held on EP Keys (poly), released by stop().
  await page.getByLabel(/EP Keys/).check()
  await page.evaluate(() =>
    (window as DevWindow).__keyflow!.inject([
      { kind: 'noteOn', note: 60 },
      { kind: 'noteOn', note: 64 },
      { kind: 'noteOn', note: 67 },
    ]),
  )
  expect(await held(page)).toBe(3)
  await page.evaluate(() => (window as DevWindow).__keyflow!.stop())
  expect(await held(page)).toBe(0)

  // Funk Lead (mono) holds a stack of keys and releases them all.
  await page.getByLabel(/Funk Lead/).check()
  await page.evaluate(() =>
    (window as DevWindow).__keyflow!.inject([
      { kind: 'noteOn', note: 60 },
      { kind: 'noteOn', note: 63 },
    ]),
  )
  expect(await held(page)).toBe(2)
  await page.evaluate(() => (window as DevWindow).__keyflow!.stop())
  expect(await held(page)).toBe(0)
})

test('a start that came without user activation recovers on the next click', async ({ page }) => {
  await open(page)
  // A synthetic key press runs the unlock handler but grants no user activation, so the
  // browser may hold resume() pending. That must not lock audio out.
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })))
  await expect(status(page)).not.toHaveAttribute('data-status', 'off')
  // Wait for the engine to load and give resume() a moment to settle either way.
  await expect
    .poll(() => page.evaluate(() => (window as DevWindow).__keyflow!.audio.currentTime()))
    .not.toBeNull()
  await page.waitForTimeout(500)
  const held = (await status(page).getAttribute('data-status')) === 'starting'
  test.info().annotations.push({
    type: 'browser held resume() without activation',
    description: String(held),
  })
  if (held) await page.getByRole('button', { name: 'Start audio' }).click()
  await expect(status(page)).toHaveAttribute('data-status', 'running')
})

test('the on-screen key that starts audio also sounds', async ({ page }) => {
  await open(page)
  const key = page.getByRole('group', { name: 'On-screen piano' }).locator('[data-note="62"]')
  await key.scrollIntoViewIfNeeded()
  const box = await key.boundingBox()
  if (!box) throw new Error('D4 key not rendered')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.85)
  await page.mouse.down()
  await expect(status(page)).toHaveAttribute('data-status', 'running')
  await expect.poll(() => held(page)).toBe(1)
  await page.mouse.up()
  await expect.poll(() => held(page)).toBe(0)
})

// Offline renders through the real instruments and master chain: levels nobody can hear in CI.
// Measurements are attached to the test results as annotations.
const info = (type: string, value: number) =>
  test.info().annotations.push({ type, description: value.toFixed(3) })

const chord = (notes: number[], velocity: number, on: number, off: number) =>
  notes.map((note) => ({ note, velocity, on, off }))

const WORST_CASE: Record<RenderSpec['preset'], Omit<RenderSpec, 'preset'>> = {
  // Ten fingers at full velocity, at full brightness.
  'ep-keys': {
    knobs: { brightness: 1 },
    notes: chord([36, 43, 48, 52, 55, 60, 64, 67, 72, 76], 1, 0.1, 1.5),
    duration: 3.5,
  },
  // A fast legato run at full velocity, filter wide open.
  'funk-lead': {
    knobs: { cutoff: 6000, glide: 0.3 },
    notes: [60, 72, 84, 67, 96, 48].map((note, i) => ({
      note,
      velocity: 1,
      on: 0.1 + i * 0.15,
      off: 0.3 + i * 0.15,
    })),
    duration: 2.5,
  },
  // Low notes, drive and cutoff at maximum.
  'wobble-bass': {
    knobs: { cutoff: 3000, drive: 1, lfoRate: 10 },
    notes: [28, 36, 24].map((note, i) => ({
      note,
      velocity: 1,
      on: 0.1 + i * 0.5,
      off: 0.55 + i * 0.5,
    })),
    duration: 3,
  },
}

for (const preset of ['ep-keys', 'funk-lead', 'wobble-bass'] as const) {
  test(`${preset}: a worst-case passage plays below full scale and goes silent after release`, async ({
    page,
  }) => {
    await open(page)
    const spec = WORST_CASE[preset]
    const lastOff = Math.max(...spec.notes.map((n) => n.off))
    const r = await render(page, {
      preset,
      ...spec,
      // Tail: well after the longest release (EP: 0.6 s).
      windows: [[lastOff + 1, spec.duration]],
    })
    info(`${preset} worst-case peak`, r.peak)
    expect(r.peak).toBeGreaterThan(0.05)
    expect(r.peak).toBeLessThan(1)
    expect(r.windows[0].rmsDb).toBeLessThan(-60)
  })

  test(`${preset}: playing as hard as the YPT-380 recording stays clear of the safety clip`, async ({
    page,
  }) => {
    await open(page)
    // 79/127 is the hardest note in tests/fixtures/ypt380-chrome-song.json.
    const v = 79 / 127
    const notes =
      preset === 'ep-keys'
        ? chord([48, 55, 60, 64, 67, 71], v, 0.1, 1.5) // a six-note voicing
        : [48, 55, 60, 63, 67, 72].map((note, i) => ({
            note: preset === 'wobble-bass' ? note - 12 : note,
            velocity: v,
            on: 0.1 + i * 0.2,
            off: 0.35 + i * 0.2,
          }))
    const r = await render(page, { preset, notes, duration: 2 })
    info(`${preset} typical peak`, r.peak)
    expect(r.peak).toBeGreaterThan(0.05)
    expect(r.peak).toBeLessThan(0.9) // SAFETY_KNEE: the clip stays linear
  })

  test(`${preset}: velocity is audible`, async ({ page }) => {
    await open(page)
    const note = preset === 'wobble-bass' ? 36 : 60
    const level = async (velocity: number) =>
      (
        await render(page, {
          preset,
          notes: [{ note, velocity, on: 0, off: 0.6 }],
          duration: 0.7,
          windows: [[0.02, 0.5]],
        })
      ).windows[0]
    const soft = await level(0.3)
    const hard = await level(0.9)
    expect(hard.rmsDb - soft.rmsDb).toBeGreaterThan(3)
    if (preset === 'ep-keys') expect(hard.hf).toBeGreaterThan(soft.hf * 1.1) // brighter, too
  })
}

test('the master chain adds almost no delay', async ({ page }) => {
  await open(page)
  const onset = async (master: boolean) =>
    (
      await render(page, {
        preset: 'funk-lead',
        notes: [{ note: 60, velocity: 1, on: 0.1, off: 0.3 }],
        duration: 0.5,
        master,
      })
    ).onset
  const direct = await onset(false)
  const limited = await onset(true)
  if (direct === null || limited === null) throw new Error('no onset found')
  const delayMs = (limited - direct) * 1000
  info('master chain delay (ms)', delayMs)
  expect(delayMs).toBeLessThan(10)
})
