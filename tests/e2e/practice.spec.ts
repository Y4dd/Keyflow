import { expect, test, type Page } from '@playwright/test'

// The Practice screen (P2-T13): a start screen with one Start, then each drill on a stage right
// above the pinned keyboard, so the prompt and the keys its hints mark are on screen together.
// 1280×720 is the default viewport; 1536×730 stands in for a 1080p laptop at 125% scaling with a
// maximised browser (the user's real screen is P2-T12's manual check).

interface DevApi {
  drill(item: string, opts?: { build?: boolean; bpm?: number }): void
  inject(events: Record<string, unknown>[]): Promise<void>
}
type DevWindow = Window & { __keyflow?: DevApi }

const SIZES = [
  { width: 1280, height: 720 },
  { width: 1536, height: 730 },
]

async function open(page: Page) {
  await page.goto('/#/practice')
  await page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
}
const canvas = (page: Page) => page.locator('canvas.piano-canvas')
const start = (page: Page) => page.getByRole('button', { name: 'Start today’s session' })
/** The canvas keyboard's pixels as a hash, to see the hint's marks drawn (as in highlight.spec). */
const canvasHash = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('canvas.piano-canvas')!
    const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
    let h = 0
    for (let i = 0; i < data.length; i += 4) h = (h * 31 + data[i]! + data[i + 1]! * 7) | 0
    return h
  })

test('a session runs on the stage over the keys, then offers the start screen again', async ({
  page,
}) => {
  await open(page)
  await expect(start(page)).toBeInViewport({ ratio: 1 })
  await expect(page.getByTestId('progress-empty')).toBeVisible() // a new learner: no grid yet
  await expect(page.locator('table.heatmap')).toHaveCount(0)

  await start(page).click()
  for (const [i, note] of [60, 62, 64].entries()) {
    await expect(page.getByTestId('session-count')).toHaveText(`Session: ${i + 1} of 3`)
    await expect(page.locator('.session-dots li[data-at="now"]')).toHaveCount(1)
    await expect(start(page)).toHaveCount(0) // one yellow action at a time
    await expect(page.getByTestId('progress')).toHaveCount(0)
    for (const size of SIZES) {
      await page.setViewportSize(size)
      await expect(page.getByTestId('drill-prompt')).toBeInViewport({ ratio: 1 })
      await expect(canvas(page)).toBeInViewport({ ratio: 1 })
    }
    await page.evaluate(
      (note) =>
        (window as DevWindow).__keyflow!.inject([
          { kind: 'noteOn', note, velocity: 0.8 },
          { kind: 'noteOff', note, at: 50 },
        ]),
      note,
    )
    await expect(page.getByTestId('drill-result')).toContainText('Right')
    await page.getByRole('button', { name: 'Next' }).click()
  }
  await expect(page.getByTestId('session-done')).toBeInViewport()
  await expect(start(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Back to progress' }).click()
  await expect(start(page)).toBeVisible()
  await expect(page.getByTestId('progress-empty')).toBeVisible() // geography isn't in the grid
  await expect(page.getByTestId('progress-days')).toHaveText(
    'You practised on 1 of the last 14 days.',
  )
})

test('the tallest stage keeps the prompt, the hint and the marked keys on screen', async ({
  page,
}) => {
  await page.clock.install()
  await open(page)
  // a scale in time before Timing is calibrated: the prompt, its detail and the timing offer
  await page.evaluate(() =>
    (window as DevWindow).__keyflow!.drill('scale:D:minPent:asc1', { bpm: 70 }),
  )
  await expect(page.getByTestId('timing-offer')).toBeVisible()
  const hint = page.getByTestId('drill-hint')
  const toLevel = async (level: string) => {
    await expect(async () => {
      await page.clock.runFor(1000)
      await expect(hint).toHaveAttribute('data-level', level, { timeout: 100 })
    }).toPass()
    await page.clock.runFor(50) // the hint's redraw, in the next animation frame
  }
  await toLevel('2') // marks only the root, as level 1 does
  const before = await canvasHash(page)
  await toLevel('3')
  // level 3's keys are drawn marked on the keyboard
  expect(await canvasHash(page)).not.toBe(before)
  for (const size of SIZES) {
    await page.setViewportSize(size)
    for (const id of ['drill-prompt', 'drill-hint', 'timing-offer'])
      await expect(page.getByTestId(id)).toBeInViewport({ ratio: 1 })
    await expect(canvas(page)).toBeInViewport({ ratio: 1 })
  }
})
