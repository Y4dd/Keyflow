import { expect, test, type Page } from '@playwright/test'

// The chord and scale library (P2-T10): the marked notes, each inversion, a key's chords, Hear it
// through the input bus, and Drill this opening the item shown in Practice. Which notes, degrees
// and names an entry has is unit-tested against tonal (src/practice/library.test.ts).

interface BusEvent {
  kind: string
  note?: number
}
interface DevApi {
  subscribe(listener: (e: BusEvent) => void): () => void
  audio: { heldCount(): number }
}
type DevWindow = Window & { __keyflow?: DevApi; __heard?: number[]; __held?: Set<number> }

const card = (page: Page) => page.getByTestId('learn')
const marked = (page: Page) =>
  card(page)
    .locator('[data-note]')
    .evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-note'))))

test.beforeEach(async ({ page }) => {
  await page.goto('/#/learn')
  await page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
  await expect(card(page)).toBeVisible()
})

test('a chord, its inversions and its key’s chords, with the keys in view', async ({ page }) => {
  const c = card(page)
  await expect(page.getByTestId('learn-title')).toHaveText('D minor')
  await c.getByRole('radio', { name: 'E', exact: true }).check()
  // its bass would be E3, under the default split: lifted an octave to the main sound
  expect(await marked(page)).toEqual([64, 67, 71])
  await c.getByRole('radio', { name: 'E♭' }).check()
  await c.getByLabel('Chord or scale').selectOption({ label: 'Minor' })
  await expect(page.getByTestId('learn-title')).toHaveText('E♭ minor')
  expect(await marked(page)).toEqual([63, 66, 70])
  await c.getByRole('radio', { name: '1st' }).check()
  await expect(page.getByTestId('learn-title')).toHaveText('E♭ minor, 1st inversion')
  expect((await marked(page)).map((n) => n % 12)).toEqual([6, 10, 3]) // G♭ in the bass
  await c.getByRole('radio', { name: '2nd' }).press('ArrowLeft') // native radios step with arrows
  await expect(c.getByRole('radio', { name: '1st' })).toBeChecked()
  await expect(c.getByRole('radio', { name: '3rd' })).toHaveCount(0) // a triad has three

  await c.getByRole('button', { name: /^iv / }).click()
  await expect(page.getByTestId('learn-title')).toHaveText('A♭ minor')
  await expect(c.getByText('In A♭ minor')).toBeVisible()

  await expect(c.getByRole('button', { name: 'Drill this' })).toBeInViewport({ ratio: 1 })
  await expect(page.locator('canvas.piano-canvas')).toBeInViewport({ ratio: 1 })
})

test('Hear it plays the chord block then broken, and leaving stops it', async ({ page }) => {
  await page.evaluate(() => {
    const w = window as DevWindow
    w.__heard = []
    w.__held = new Set()
    w.__keyflow!.subscribe((e) => {
      if (e.kind === 'noteOn') {
        w.__heard!.push(e.note!)
        w.__held!.add(e.note!)
      } else if (e.kind === 'noteOff') w.__held!.delete(e.note!)
    })
  })
  const c = card(page)
  await c.getByRole('radio', { name: 'C', exact: true }).check()
  await c.getByLabel('Chord or scale').selectOption({ label: 'Major' })
  const notes = await marked(page)
  await c.getByRole('button', { name: 'Hear it' }).click()
  await expect(c.getByRole('button', { name: 'Stop' })).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => (window as DevWindow).__heard), { timeout: 8000 })
    .toEqual([...notes, ...notes])
  await expect(c.getByRole('button', { name: 'Hear it' })).toBeVisible()

  // a scale, left halfway: nothing stays held
  await c.getByLabel('Chord or scale').selectOption({ label: 'Minor pentatonic' })
  await c.getByRole('button', { name: 'Hear it' }).click()
  await expect
    .poll(() => page.evaluate(() => (window as DevWindow).__heard!.length))
    .toBeGreaterThan(8)
  await page.getByRole('link', { name: 'Jam', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as DevWindow).__held!.size)).toBe(0)
  await expect(page.locator('[data-view="jam"]')).toBeVisible()
})

test('Drill this opens the item shown in Practice; Skip comes back', async ({ page }) => {
  const c = card(page)
  await c.getByRole('radio', { name: 'G', exact: true }).check()
  await c.getByLabel('Chord or scale').selectOption({ label: 'Dominant 7th' })
  await c.getByRole('radio', { name: '3rd' }).check()
  await c.getByRole('button', { name: 'Drill this' }).click()
  await expect(page).toHaveURL(/#\/practice$/)
  await expect(page.getByTestId('drill-prompt')).toHaveText('G7, 3rd inversion')
  await expect(page.locator('[data-item]')).toHaveAttribute('data-item', 'chord:G:7:inv3')
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page).toHaveURL(/#\/learn$/)
  await expect(page.getByTestId('learn-title')).toHaveText('G7, 3rd inversion') // still there
})
