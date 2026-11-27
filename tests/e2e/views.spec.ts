import { expect, test, type Page } from '@playwright/test'

// Views and navigation (P2-T12): one keyboard in the shell across Jam, Practice, Learn and Setup,
// a groove that keeps playing across them, the first-visit walk-through, and a drill that closes
// when you leave Practice. The default viewport is 1280×720.
interface DevApi {
  drill(item: string): void
  groove: { ticks(): number | null }
}
type DevWindow = Window & { __keyflow?: DevApi; __sameCanvas?: Element }

const ready = (page: Page) =>
  page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
async function go(page: Page, view: string) {
  const link = page.getByRole('link', { name: view, exact: true })
  await link.click()
  await expect(link).toHaveAttribute('aria-current', 'page')
}
const canvas = (page: Page) => page.locator('canvas.piano-canvas')
const ticks = (page: Page) => page.evaluate(() => (window as DevWindow).__keyflow!.groove.ticks())

test('every view keeps the one keyboard on screen, and a playing groove plays on', async ({
  page,
}) => {
  await page.goto('/#/jam')
  await ready(page)
  await page.getByRole('button', { name: 'Start audio' }).click()
  await expect(page.getByTestId('audio-status')).toHaveAttribute('data-status', 'running')
  await page.evaluate(() => {
    ;(window as DevWindow).__sameCanvas = document.querySelector('canvas.piano-canvas')!
  })
  const groove = page.getByTestId('groove')
  await expect(groove).toBeInViewport({ ratio: 1 })
  await groove.getByRole('button', { name: 'Play' }).click()
  await expect(page.getByRole('button', { name: 'Stop groove' })).toBeVisible()

  for (const view of ['Practice', 'Learn', 'Setup', 'Jam']) {
    await go(page, view)
    await expect(page.getByRole('link', { name: view, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(canvas(page)).toBeInViewport({ ratio: 1 })
    expect(
      await page.evaluate(
        () => (window as DevWindow).__sameCanvas === document.querySelector('canvas.piano-canvas'),
      ),
    ).toBe(true)
    const before = (await ticks(page))!
    await expect.poll(() => ticks(page)).toBeGreaterThan(before)
  }
  await expect(page.getByTestId('groove')).toBeInViewport({ ratio: 1 })

  await go(page, 'Practice')
  await expect(page.getByRole('button', { name: 'Start today’s session' })).toBeInViewport()
  await page.getByRole('button', { name: 'Stop groove' }).click()
  await expect(page.getByRole('button', { name: 'Stop groove' })).toHaveCount(0)
  expect(await ticks(page)).toBeNull()
})

test('first visit: Keyboard, then Sound, then Jam', async ({ page }) => {
  await page.goto('/')
  const welcome = page.getByRole('dialog', { name: 'Keyflow' })
  await expect(welcome).toBeVisible()
  await expect(page).toHaveURL(/#\/welcome$/)
  await expect(welcome.getByRole('region', { name: 'Keyboard' })).toBeVisible()
  // No MIDI device in CI: Next moves on without one.
  await welcome.getByRole('button', { name: 'Next' }).click()
  await expect(welcome.locator('#sound')).toBeVisible()
  // The pointerdown on Next has already started sound (attachAudioUnlock), so Start audio is gone.
  await expect(welcome.getByTestId('audio-status')).toHaveAttribute('data-status', 'running')
  await expect(welcome.getByRole('button', { name: 'Start playing' })).toHaveClass('primary')
  await welcome.getByRole('button', { name: 'Start playing' }).click()
  await expect(page).toHaveURL(/#\/jam$/)
  await expect(welcome).toHaveCount(0)
  await expect(page.getByTestId('groove')).toBeInViewport({ ratio: 1 })

  // Sound has run here now, so an empty hash opens Jam from then on.
  await page.waitForTimeout(400) // the settings save is debounced 300 ms
  await page.goto('/')
  await expect(page).toHaveURL(/#\/jam$/)
})

test('leaving Practice closes an open drill', async ({ page }) => {
  await page.goto('/#/practice')
  await ready(page)
  await page.evaluate(() => (window as DevWindow).__keyflow!.drill('geo:F#'))
  await expect(page.getByTestId('drill-prompt')).toHaveText('F♯')
  await go(page, 'Jam')
  await go(page, 'Practice')
  await expect(page.getByTestId('drill-prompt')).toHaveCount(0)
})
