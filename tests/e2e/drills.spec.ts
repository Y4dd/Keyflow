import { expect, test, type Page } from '@playwright/test'

// Drill types (P2-T3), each end to end through the simulated source: open a drill by item ID,
// play a wrong answer, then the right one. Then grading and the hint ladder (P2-T4): a stalled
// answer's hints, the rating shown and saved. The judging, ratings and hint delays are
// unit-tested (src/practice/drills.test.ts, grading.test.ts). No sound is needed: drills listen
// to the input bus.

type SimEvent = Record<string, unknown> & { kind: string; at?: number }
interface DevApi {
  inject(events: SimEvent[]): Promise<void>
  drill(item: string, opts?: { build?: boolean; bpm?: number }): void
  items: { logs(id: string): Promise<{ rating: number; hintLevel: number; ms: number | null }[]> }
}
type DevWindow = Window & { __keyflow?: DevApi }

async function open(page: Page) {
  await page.goto('/#/practice')
  await page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
}

const drill = (page: Page, item: string, opts?: { build?: boolean; bpm?: number }) =>
  page.evaluate(([item, opts]) => (window as DevWindow).__keyflow!.drill(item, opts), [
    item,
    opts,
  ] as const)

/** Presses the notes together (or `gap` ms apart), then lets them go. */
const play = (page: Page, notes: number[], gap = 0) =>
  page.evaluate(
    (events) => (window as DevWindow).__keyflow!.inject(events),
    [
      ...notes.map((note, i) => ({ kind: 'noteOn', note, velocity: 0.8, at: i * gap })),
      ...notes.map((note) => ({ kind: 'noteOff', note, at: notes.length * gap + 100 })),
    ],
  )

test.beforeEach(async ({ page }) => open(page))

const prompt = (page: Page) => page.getByTestId('drill-prompt')
const result = (page: Page) => page.getByTestId('drill-result')

test('find the note', async ({ page }) => {
  await drill(page, 'geo:F#')
  await expect(prompt(page)).toHaveText('F♯')
  await play(page, [67])
  await expect(result(page)).toHaveText('That’s G. Find F♯.')
  await play(page, [78])
  await expect(result(page)).toContainText('Right')
})

test('play the chord, in the asked inversion', async ({ page }) => {
  await drill(page, 'chord:F:m7:inv1')
  await expect(prompt(page)).toHaveText('Fm7, 1st inversion')
  await play(page, [53, 56, 60, 63])
  await expect(result(page)).toHaveText('Right notes. Put A♭ at the bottom.')
  await play(page, [56, 60, 63, 65])
  await expect(result(page)).toContainText('Right,')
})

test('play the scale, in time', async ({ page }) => {
  await drill(page, 'scale:A:minPent:asc1', { bpm: 240 })
  await expect(prompt(page)).toHaveText('A minor pentatonic, up one octave, at 240 BPM')
  const run = [57, 60, 62, 64, 67, 69]
  await play(page, run, 500)
  await expect(result(page)).toHaveText('Right notes at 120 BPM. Again at 240 BPM.')
  await play(page, run, 250)
  await expect(result(page)).toContainText('Right,')
})

test('chord in key', async ({ page }) => {
  await drill(page, 'rn:G:major:vi')
  await expect(prompt(page)).toHaveText('The vi chord in G')
  await play(page, [55, 59, 62])
  await expect(result(page)).toHaveText('You played G.')
  await play(page, [52, 55, 59])
  await expect(result(page)).toContainText(': E minor')
})

test('build it, from the formula', async ({ page }) => {
  await drill(page, 'chord:D:min:any', { build: true })
  await expect(prompt(page)).toHaveText('Build D minor from its formula')
  await expect(page.getByText('Minor: root, +3 half-steps, +4 half-steps')).toBeVisible()
  await play(page, [62, 66, 69])
  await expect(result(page)).toHaveText('You played D.')
  await play(page, [62, 65, 69])
  await expect(result(page)).toContainText('Right,')
})

const logs = (page: Page, item: string) =>
  page.evaluate((item) => (window as DevWindow).__keyflow!.items.logs(item), item)

/** Presses the notes and lets them go at once, with no timers (for a fake clock). */
const tap = (page: Page, notes: number[]) =>
  page.evaluate(
    (events) => (window as DevWindow).__keyflow!.inject(events),
    [
      ...notes.map((note) => ({ kind: 'noteOn', note, velocity: 0.8 })),
      ...notes.map((note) => ({ kind: 'noteOff', note })),
    ],
  )

test('a stalled answer climbs the hint ladder, then is asked again unaided', async ({ page }) => {
  await page.clock.install()
  await open(page)
  const hint = page.getByTestId('drill-hint')
  await drill(page, 'chord:D:min:root')
  await expect(hint).toHaveText('')
  // the first hint waits for the item's card to load, so step the clock until it shows
  await expect(async () => {
    await page.clock.runFor(1000)
    await expect(hint).toContainText('Start from D.', { timeout: 100 })
  }).toPass()
  await page.clock.runFor(6000)
  await expect(hint).toContainText('From D: root, +3 half-steps, +4 half-steps.')
  await page.clock.runFor(6000)
  await expect(hint).toHaveAttribute('data-level', '3')
  await expect(hint).toContainText('This is D minor.')
  await tap(page, [62, 65, 69])
  await expect(result(page)).toHaveText('Right. Now once more, on your own.')
  await expect(hint).toHaveText('')
  await tap(page, [50, 53, 57])
  await expect(result(page)).toContainText('Right,')
  await expect(page.getByTestId('drill-rating')).toHaveText('Again')
  await expect
    .poll(() => logs(page, 'chord:D:min:root'))
    .toMatchObject([{ rating: 1, hintLevel: 3 }])
})

test('a quick answer is graded and saved; a skip after trying counts as Again', async ({
  page,
}) => {
  await drill(page, 'geo:Eb')
  await play(page, [63])
  await expect(result(page)).toContainText('Right,')
  await expect(page.getByTestId('drill-rating')).toHaveText(/Easy|Good/)
  await expect.poll(async () => (await logs(page, 'geo:Eb')).length).toBe(1)
  expect((await logs(page, 'geo:Eb'))[0]).toMatchObject({ hintLevel: 0 })

  await drill(page, 'geo:Ab')
  await play(page, [60])
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect.poll(() => logs(page, 'geo:Ab')).toMatchObject([{ rating: 1, ms: null }])
  expect(await logs(page, 'geo:Eb')).toHaveLength(1) // the finished drill isn't logged again
})
