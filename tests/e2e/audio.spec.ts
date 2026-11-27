import { expect, test, type Page } from '@playwright/test'

// Dev tools are on in the e2e build (see playwright.config.ts). Browsers are muted there.
// The basses play an octave lower in the shared passages below.
const BASSES = ['wobble-bass', 'round-bass'] as const
type Bass = (typeof BASSES)[number]
const isBass = (preset: string) => (BASSES as readonly string[]).includes(preset)

interface RenderNote {
  note: number
  velocity: number
  on: number
  off: number
}
interface RenderSpec {
  preset: 'funk-lead' | 'ep-keys' | 'warm-tines' | Bass
  knobs?: Record<string, number>
  notes: RenderNote[]
  duration: number
  master?: boolean
  windows?: [number, number][]
  sendAt?: number
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
  pianoKey(note: number): { x: number; y: number; lit: boolean } | null
  audio: {
    heldCount(): number
    heldByZone(): { main: number; left: number }
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

// Setup holds the Sound card and the sound crate (P2-T12); the keyboard is in every view.
async function open(page: Page) {
  await page.goto('/#/setup')
  await page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
}

const status = (page: Page) => page.getByTestId('audio-status')
const held = (page: Page) => page.evaluate(() => (window as DevWindow).__keyflow!.audio.heldCount())
const heldByZone = (page: Page) =>
  page.evaluate(() => (window as DevWindow).__keyflow!.audio.heldByZone())
const inject = (page: Page, events: { kind: 'noteOn' | 'noteOff'; note: number }[]) =>
  page.evaluate((e) => (window as DevWindow).__keyflow!.inject(e), events)
const zone = (page: Page, title: 'Main sound' | 'Left sound') =>
  page.getByRole('group', { name: new RegExp(`^${title}`) })
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

  // Notes reach the engine: three held on EP Keys (poly), released by stop(). They're above the
  // split point, so the main sound plays them.
  await zone(page, 'Main sound')
    .getByLabel(/EP Keys/)
    .check()
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
  await zone(page, 'Main sound')
    .getByLabel(/Funk Lead/)
    .check()
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

test('the split keyboard plays each hand on its own sound, and no note sticks', async ({
  page,
}) => {
  await open(page)
  await page.getByRole('button', { name: 'Start audio' }).click()
  await expect(status(page)).toHaveAttribute('data-status', 'running')
  await expect(page.getByTestId('split-summary')).toHaveText(/^Keys below G3 play the left sound/)
  await expect(zone(page, 'Left sound').getByLabel(/Round Bass/)).toBeChecked()
  await expect(zone(page, 'Main sound').getByLabel(/Funk Lead/)).toBeChecked()

  // F#3 is the left sound's top key and G3 the main sound's lowest.
  await inject(page, [
    { kind: 'noteOn', note: 40 },
    { kind: 'noteOn', note: 54 },
    { kind: 'noteOn', note: 55 },
    { kind: 'noteOn', note: 67 },
  ])
  expect(await heldByZone(page)).toEqual({ left: 2, main: 2 })

  // Moving the split and shifting an octave while keys are held: their note-offs still find
  // the notes they started.
  await page.getByLabel('Split point').selectOption({ label: 'C3' })
  // The menu lets go of focus, so the computer keys play again instead of picking a note.
  await expect(page.getByLabel('Split point')).not.toBeFocused()
  await zone(page, 'Main sound')
    .getByRole('combobox', { name: /^Octave/ })
    .selectOption('1')
  await inject(page, [{ kind: 'noteOn', note: 50 }]) // D3: now the main sound's
  expect(await heldByZone(page)).toEqual({ left: 2, main: 3 })
  await inject(page, [
    { kind: 'noteOff', note: 54 },
    { kind: 'noteOff', note: 55 },
  ])
  expect(await heldByZone(page)).toEqual({ left: 1, main: 2 })

  // Changing one zone's preset releases that zone only.
  await zone(page, 'Left sound')
    .getByLabel(/EP Keys/)
    .check()
  expect(await heldByZone(page)).toEqual({ left: 0, main: 2 })
  await page.evaluate(() => (window as DevWindow).__keyflow!.stop())
  expect(await heldByZone(page)).toEqual({ left: 0, main: 0 })

  // The split point can be set by pressing a key; that key doesn't sound.
  await page.getByRole('button', { name: 'Set by pressing a key' }).click()
  await inject(page, [{ kind: 'noteOn', note: 52 }])
  await expect(page.getByTestId('split-summary')).toHaveText(/^Keys below E3/)
  expect(await held(page)).toBe(0)
  await inject(page, [{ kind: 'noteOff', note: 52 }])
  await inject(page, [{ kind: 'noteOn', note: 51 }])
  expect(await heldByZone(page)).toEqual({ left: 1, main: 0 })
  await page.evaluate(() => (window as DevWindow).__keyflow!.stop())

  // With the split off, the main sound covers every key.
  await page.getByLabel('Split keyboard').uncheck()
  await expect(zone(page, 'Left sound')).toHaveCount(0)
  await inject(page, [{ kind: 'noteOn', note: 40 }])
  expect(await heldByZone(page)).toEqual({ left: 0, main: 1 })
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
  await page.getByRole('group', { name: 'On-screen piano' }).scrollIntoViewIfNeeded()
  const d4 = await page.evaluate(() => (window as DevWindow).__keyflow!.pianoKey(62))
  if (!d4) throw new Error('D4 key not drawn')
  await page.mouse.move(d4.x, d4.y)
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
    knobs: { cutoff: 3000, drive: 1, lfoSync: 0, lfoRate: 10 },
    notes: [28, 36, 24].map((note, i) => ({
      note,
      velocity: 1,
      on: 0.1 + i * 0.5,
      off: 0.55 + i * 0.5,
    })),
    duration: 3,
  },
  // Ten fingers at full velocity, brightness and tremolo at maximum.
  'warm-tines': {
    knobs: { brightness: 1, tremolo: 0.8 },
    notes: chord([36, 43, 48, 52, 55, 60, 64, 67, 72, 76], 1, 0.1, 1.5),
    duration: 3.5,
  },
  // Low notes, filter wide open, glide at most.
  'round-bass': {
    knobs: { cutoff: 2000, glide: 0.3 },
    notes: [28, 36, 24].map((note, i) => ({
      note,
      velocity: 1,
      on: 0.1 + i * 0.5,
      off: 0.55 + i * 0.5,
    })),
    duration: 3,
  },
}

for (const preset of ['ep-keys', 'warm-tines', 'funk-lead', ...BASSES] as const) {
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
      preset === 'ep-keys' || preset === 'warm-tines'
        ? chord([48, 55, 60, 64, 67, 71], v, 0.1, 1.5) // a six-note voicing
        : [48, 55, 60, 63, 67, 72].map((note, i) => ({
            note: isBass(preset) ? note - 12 : note,
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
    const note = isBass(preset) ? 36 : 60
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

// Warm Tines (P1-T3b): the Tremolo knob swings the level of a held note; at 0 it doesn't.
test('warm-tines: the Tremolo knob makes a held note swell and dip', async ({ page }) => {
  await open(page)
  // 30 ms windows over about four tremolo cycles (4.2 Hz), well inside the 5 s decay.
  const windows: [number, number][] = Array.from({ length: 30 }, (_, i) => [
    0.3 + i * 0.03,
    0.33 + i * 0.03,
  ])
  const swing = async (tremolo: number) => {
    const r = await render(page, {
      preset: 'warm-tines',
      knobs: { tremolo },
      notes: [{ note: 60, velocity: 0.8, on: 0.05, off: 1.3 }],
      duration: 1.4,
      master: false,
      windows,
    })
    const db = r.windows.map((w) => w.rmsDb)
    return Math.max(...db) - Math.min(...db)
  }
  const off = await swing(0)
  const full = await swing(0.8)
  info('warm-tines level swing off / full (dB)', off)
  expect(full).toBeGreaterThan(off + 6)
})

// Warm Tines: the Tone knob is its warmth; turned down, the same chord has less high end.
test('warm-tines: turning Tone down makes it darker', async ({ page }) => {
  await open(page)
  const hf = async (tone: number) =>
    (
      await render(page, {
        preset: 'warm-tines',
        // Bright and hard, so there is high end for the knob to take away.
        knobs: { tone, tremolo: 0, brightness: 1 },
        notes: chord([48, 55, 60, 64, 67], 1, 0.05, 1),
        duration: 1.1,
        master: false,
        windows: [[0.05, 0.6]],
      })
    ).windows[0].hf
  const dark = await hf(500)
  const bright = await hf(5000)
  info('warm-tines hf at Tone 500 / 5000 Hz', dark)
  expect(bright).toBeGreaterThan(dark * 1.2)
})

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

test('ep-keys: a pitch struck twice after the clock passed its time plays, without a Tone error', async ({
  page,
}) => {
  await open(page)
  // Both presses ask for 0.01 s but arrive at 0.05 s, so Tone clamps both starts to the clock:
  // live input meets this when the clock ticks between reading the time and starting the note.
  const r = await render(page, {
    preset: 'ep-keys',
    notes: [60, 60].map((note) => ({ note, velocity: 0.8, on: 0.01, off: 0.4 })),
    sendAt: 0.05,
    duration: 0.5,
    windows: [[0.1, 0.3]],
  })
  expect(r.windows[0].rmsDb).toBeGreaterThan(-40)
})

test('the setup steps mark sound done once it runs, and its card follows', async ({ page }) => {
  await open(page)
  // No MIDI keyboard in CI, so connecting stays the next step, in the top bar and in Setup.
  await expect(page.getByRole('link', { name: 'Setup: Connect keyboard' })).toBeVisible()
  await expect(page.locator('#sound')).not.toHaveAttribute('data-state', 'done')
  await page.getByRole('button', { name: 'Start audio' }).click()
  await expect(page.locator('#sound')).toHaveAttribute('data-state', 'done')
  await expect(page.locator('#keyboard')).toHaveAttribute('data-state', 'now')
  await expect(page.locator('#timing')).toHaveAttribute('data-state', 'todo')
})
