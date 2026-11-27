import { readFile } from 'node:fs/promises'
import tonejsMidi from '@tonejs/midi'
import { expect, test, type Page } from '@playwright/test'

// Takes (P1-T7): record over the groove through the simulated source, save to IndexedDB,
// replay (the replayed events must equal the recorded ones), export as .mid, and the database
// upgrade from version 1 keeps the settings. The take logic itself is unit-tested
// (src/analysis/take.test.ts). Browsers are muted.

const { Midi } = tonejsMidi // CommonJS: no named exports under Node

type SimEvent = Record<string, unknown> & { kind: string; at?: number }
type Heard = Record<string, unknown> & { kind: string; time: number }
interface DevApi {
  inject(events: SimEvent[]): Promise<void>
  subscribe(listener: (e: Heard) => void): () => void
  audio: {
    heldCount(): number
    expression(): { sustain: boolean; bend: number } | null
  }
  groove: { ticks(): number | null }
}
type DevWindow = Window & { __keyflow?: DevApi; __heard?: Heard[] }

async function open(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
}

async function startSound(page: Page) {
  await page.getByRole('button', { name: 'Start audio' }).click()
  await expect(page.getByTestId('audio-status')).toHaveAttribute('data-status', 'running')
}

/** The takes table as stored, oldest first. */
const storedTakes = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<
        { events: (SimEvent & { at: number })[]; lengthMs: number; leadMs: number | null }[]
      >((resolve, reject) => {
        const req = indexedDB.open('keyflow')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const all = req.result.transaction('takes').objectStore('takes').getAll()
          all.onsuccess = () => {
            req.result.close()
            resolve(all.result)
          }
          all.onerror = () => reject(all.error)
        }
      }),
  )

const PLAYED: SimEvent[] = [
  { kind: 'noteOn', note: 62, velocity: 0.8, at: 0 },
  { kind: 'pedal', down: true, at: 120 },
  { kind: 'noteOn', note: 65, velocity: 0.45, at: 250 },
  { kind: 'noteOff', note: 62, at: 300 },
  { kind: 'bend', semitones: 2, at: 400 },
  { kind: 'bend', semitones: 0, at: 600 },
  { kind: 'noteOff', note: 65, at: 700 },
  { kind: 'pedal', down: false, at: 750 },
  { kind: 'noteOn', note: 69, velocity: 1, at: 800 },
  { kind: 'noteOff', note: 69, at: 1000 },
]

const strip = ({ at: _at, time: _time, source: _source, ...rest }: Record<string, unknown>) => rest

async function recordTake(page: Page, played = PLAYED) {
  const groove = page.getByTestId('groove')
  await groove.getByLabel('Count-in').uncheck() // one bar less to wait for
  await groove.getByRole('button', { name: 'Record', exact: true }).click()
  // A take keeps one groove, key and tempo.
  await expect(groove.getByRole('combobox', { name: 'Groove' })).toBeDisabled()
  await expect(groove.getByLabel('Key')).toBeDisabled()
  // A beat past the transport's start, so no press lands before the downbeat as heard (the
  // origin includes the output latency): those are clamped to 0.
  await page.waitForFunction(() => ((window as DevWindow).__keyflow!.groove.ticks() ?? -1) > 192)
  await page.evaluate((events) => (window as DevWindow).__keyflow!.inject(events), played)
  await groove.getByRole('button', { name: 'Save take' }).click()
  await expect(groove.getByRole('combobox', { name: 'Groove' })).toBeEnabled()
  await expect(page.getByTestId('takes').getByRole('radio')).toHaveCount(1)
}

test('a take is saved, and replays over its groove with identical events', async ({ page }) => {
  await open(page)
  await startSound(page)
  await expect(page.getByTestId('takes')).toContainText('No takes yet')
  await recordTake(page)

  // P1-T8: its stats (D, F and A in D minor pentatonic) and one suggestion. The strong-beat
  // count depends on when the injection landed, so it's unit-tested (src/analysis/stats.test.ts).
  const stats = page.getByTestId('take-stats')
  await expect(stats).toContainText('Notes3')
  await expect(stats).toContainText('RangeD4 to A4')
  await expect(stats).toContainText('In the scale100%')
  await expect(stats.locator('.take-tip')).toHaveText(/^Play a little longer next time/)

  const [take] = await storedTakes(page)
  expect(take!.events.map(strip)).toEqual(PLAYED.map(strip))
  const gaps = (times: number[]) => times.slice(1).map((t, i) => t - times[i]!)
  // Recorded on the 0.001 ms grid, so the spacing is the injected spacing to within it.
  gaps(take!.events.map((e) => e.at)).forEach((g, i) =>
    expect(g).toBeCloseTo(gaps(PLAYED.map((e) => e.at!))[i]!, 2),
  )

  // Replay: listen to the input bus and compare what it hears with the take.
  await page.evaluate(() => {
    const w = window as DevWindow
    w.__heard = []
    w.__keyflow!.subscribe((e) => w.__heard!.push({ ...e }))
  })
  const takes = page.getByTestId('takes')
  await takes.getByRole('button', { name: 'Replay', exact: true }).click()
  await expect(takes.getByRole('button', { name: 'Stop replay' })).toBeVisible()
  await expect(page.getByTestId('groove').getByRole('combobox', { name: 'Groove' })).toBeDisabled()
  // It ends by itself at the take's length.
  await expect(takes.getByRole('button', { name: 'Replay', exact: true })).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByTestId('groove').getByRole('button', { name: 'Play' })).toBeVisible()

  const heard = await page.evaluate(() => (window as DevWindow).__heard!)
  expect(heard.map(strip)).toEqual(take!.events.map(strip))
  expect(heard.every((e) => e.source === 'sim')).toBe(true)
  gaps(heard.map((e) => e.time)).forEach((g, i) =>
    expect(g).toBeCloseTo(gaps(take!.events.map((e) => e.at))[i]!, 6),
  )
  expect(await page.evaluate(() => (window as DevWindow).__keyflow!.audio.heldCount())).toBe(0)

  // Saved: it's still listed after a reload.
  await page.reload()
  await expect(page.getByTestId('takes').getByRole('radio')).toHaveCount(1)
})

test('stopping a replay mid-take releases its notes, pedal and bend, and puts Loop back', async ({
  page,
}) => {
  await open(page)
  await startSound(page)
  const groove = page.getByTestId('groove')
  await groove.getByLabel('Loop').uncheck()
  // A note, the pedal and a full bend (one scale step), all held for 2 s.
  await recordTake(page, [
    { kind: 'noteOn', note: 64, velocity: 0.7, at: 0 },
    { kind: 'pedal', down: true, at: 50 },
    { kind: 'bend', semitones: 1, at: 100 },
    { kind: 'bend', semitones: 0, at: 2000 },
    { kind: 'pedal', down: false, at: 2000 },
    { kind: 'noteOff', note: 64, at: 2000 },
  ])
  const takes = page.getByTestId('takes')
  const dev = () =>
    page.evaluate(() => {
      const k = (window as DevWindow).__keyflow!
      return { held: k.audio.heldCount(), expression: k.audio.expression()! }
    })
  await takes.getByRole('button', { name: 'Replay', exact: true }).click()
  await expect(groove.getByLabel('Loop')).toBeChecked() // so the groove outlasts the take
  await expect
    .poll(dev, { timeout: 5000 })
    .toMatchObject({ expression: { sustain: true, bend: 1 } })
  expect((await dev()).held).toBeGreaterThan(0)

  await takes.getByRole('button', { name: 'Stop replay' }).click()
  await expect(groove.getByRole('combobox', { name: 'Groove' })).toBeEnabled()
  await expect(groove.getByLabel('Loop')).not.toBeChecked()
  expect((await dev()).expression).toMatchObject({ sustain: false, bend: 0 })
  // The groove's notes and yours release one look-ahead out.
  await expect.poll(async () => (await dev()).held).toBe(0)
})

test('notes land at their transport positions, in the count-in and after it', async ({ page }) => {
  await open(page)
  await startSound(page)
  const groove = page.getByTestId('groove')
  await expect(groove.getByLabel('Count-in')).toBeChecked()
  await groove.getByRole('button', { name: 'Record', exact: true }).click()
  /** Once the groove passes `ticks`, presses a key; returns the groove ticks as it does. */
  const pressAfter = async (ticks: number, note: number) => {
    await page.waitForFunction(
      (min) => ((window as DevWindow).__keyflow!.groove.ticks() ?? -Infinity) > min,
      ticks,
    )
    return page.evaluate(async (note) => {
      const k = (window as DevWindow).__keyflow!
      const now = k.groove.ticks()!
      await k.inject([
        { kind: 'noteOn', note, at: 0 },
        { kind: 'noteOff', note, at: 50 },
      ])
      return now
    }, note)
  }
  const inCountIn = await pressAfter(-400, 60) // half-way through the count-in bar
  const inBar2 = await pressAfter(900, 64) // early in groove bar 2 (768 ticks a bar)
  expect(inCountIn).toBeLessThan(0)
  await groove.getByRole('button', { name: 'Save take' }).click()
  await expect(page.getByTestId('takes').getByRole('radio')).toHaveCount(1)

  const [take] = await storedTakes(page)
  const ons = take!.events.filter((e) => e.kind === 'noteOn')
  // Groove ticks from `at` at 108 BPM, the count-in bar (768 ticks) first.
  const tick = (at: number) => (at / 60_000) * 108 * 192 - 768
  // The take counts from the downbeat as heard (the calibration mapping), which comes after the
  // audio clock's tick 0 by the output latency, so a note lands up to that much earlier than the
  // audio clock's tick: 43 to 66 ms one test at a time here, more under load (Chromium reports it
  // as the clock's lead; Firefox reports none but shows the same gap). An origin missing the
  // look-ahead (about −50 ms) or off by the count-in bar (2.2 s) lands outside.
  const ms = (ticks: number) => (ticks / 192 / 108) * 60_000
  for (const [on, read] of [
    [ons[0]!, inCountIn],
    [ons[1]!, inBar2],
  ] as const) {
    const early = ms(read - tick(on.at))
    expect(early).toBeGreaterThan(-10)
    expect(early).toBeLessThan(300) // loose: Firefox under load reads its audio clock late
  }
})

test('a take exports as a MIDI file of the notes played', async ({ page }) => {
  await open(page)
  await startSound(page)
  await recordTake(page)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('takes').getByRole('button', { name: 'Export .mid' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^keyflow-electro-funk-vamp-[\d-]+\.mid$/)
  const midi = new Midi(await readFile((await download.path())!))
  expect(midi.header.tempos[0]?.bpm).toBeCloseTo(108)
  expect(midi.tracks[0]!.notes.map((n) => n.midi)).toEqual([62, 65, 69])
})

test('the database upgrade to version 2 keeps version 1 settings', async ({ page }) => {
  await open(page)
  // Replace the database with a version 1 one (Dexie's version 1 is IndexedDB version 10), as
  // a visit before P1-T7 left it, holding one setting.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const del = indexedDB.deleteDatabase('keyflow') // Dexie closes on versionchange
        del.onerror = () => reject(del.error)
        del.onsuccess = () => {
          const req = indexedDB.open('keyflow', 10)
          req.onupgradeneeded = () => req.result.createObjectStore('settings', { keyPath: 'key' })
          req.onerror = () => reject(req.error)
          req.onsuccess = () => {
            const tx = req.result.transaction('settings', 'readwrite')
            tx.objectStore('settings').put({ key: 'keyLetters', value: false })
            tx.oncomplete = () => {
              req.result.close()
              resolve()
            }
            tx.onerror = () => reject(tx.error)
          }
        }
      }),
  )
  await page.reload()
  await expect(page.getByLabel('Show the computer-key letters on the keys')).not.toBeChecked()
  await expect(page.getByTestId('takes')).toContainText('No takes yet')
  expect(await storedTakes(page)).toEqual([])
})
