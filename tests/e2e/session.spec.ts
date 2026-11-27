import { expect, test, type Page } from '@playwright/test'

// The session builder (P2-T6) end to end: a new learner's first session, and due reviews first
// with the jam offered after. Composition (interleaving, due-first, the new-item cap) is
// unit-tested in src/practice/session.test.ts.

type SimEvent = Record<string, unknown> & { kind: string; at?: number }
interface DevApi {
  inject(events: SimEvent[]): Promise<void>
  items: {
    record(
      id: string,
      rating: number,
      attempt: { ms: number | null; hintLevel: number; wrongNotes: number },
      now?: number,
    ): Promise<unknown>
    logs(id: string): Promise<unknown[]>
  }
}
type DevWindow = Window & { __keyflow?: DevApi }

test.beforeEach(async ({ page }) => {
  await page.goto('/#/practice')
  await page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
})

const card = (page: Page) => page.getByTestId('drills')
const item = (page: Page) => card(page).locator('[data-item]')
const tap = (page: Page, note: number) =>
  page.evaluate(
    (note) =>
      (window as DevWindow).__keyflow!.inject([
        { kind: 'noteOn', note, velocity: 0.8 },
        { kind: 'noteOff', note, at: 50 },
      ]),
    note,
  )

test('a new learner’s first session: the first white keys, then done', async ({ page }) => {
  await card(page).getByRole('button', { name: 'Start today’s session' }).click()
  for (const [i, [id, note]] of (
    [
      ['geo:C', 60],
      ['geo:D', 62],
      ['geo:E', 64],
    ] as const
  ).entries()) {
    await expect(page.getByTestId('session-count')).toHaveText(`Session: ${i + 1} of 3`)
    await expect(item(page)).toHaveAttribute('data-item', id)
    await tap(page, note)
    await expect(page.getByTestId('drill-result')).toContainText('Right')
    await card(page).getByRole('button', { name: 'Next' }).click()
  }
  await expect(page.getByTestId('session-done')).toContainText('That’s today’s session.')
  await expect(page.getByRole('button', { name: /^Jam/ })).toHaveCount(0) // no scale yet
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => (window as DevWindow).__keyflow!.items.logs('geo:E'))).length,
    )
    .toBe(1)
})

test('due reviews come first; after the session, jam with its scale', async ({ page }) => {
  const twoDaysAgo = Date.now() - 2 * 86_400_000
  await page.evaluate(async (at) => {
    const api = (window as DevWindow).__keyflow!.items
    const miss = { ms: null, hintLevel: 0, wrongNotes: 0 }
    await api.record('scale:D:minPent:asc1', 1, miss, at) // Again: due minutes later
    await api.record('geo:C', 3, { ms: 800, hintLevel: 0, wrongNotes: 0 }) // Good now: not due
  }, twoDaysAgo)

  await card(page).getByRole('button', { name: 'Start today’s session' }).click()
  // then the 3 new white keys, not D straight after the D scale; geo:C isn't due
  for (const [i, id] of ['scale:D:minPent:asc1', 'geo:E', 'geo:D', 'geo:F'].entries()) {
    await expect(page.getByTestId('session-count')).toHaveText(`Session: ${i + 1} of 4`)
    await expect(item(page)).toHaveAttribute('data-item', id)
    await card(page).getByRole('button', { name: 'Skip' }).click()
  }
  await expect(page.getByTestId('session-done')).toBeVisible()

  await page
    .getByRole('button', { name: 'Jam: D minor pentatonic over the electro-funk vamp' })
    .click()
  const groove = page.getByTestId('groove')
  await expect(groove.getByRole('combobox', { name: 'Groove' })).toHaveValue('electro-funk-vamp')
  await expect(groove.getByRole('combobox', { name: /^Key/ })).toHaveValue('2')
  await expect(groove.getByRole('combobox', { name: 'Scale' })).toHaveValue('minor pentatonic')
  await expect(page.getByTestId('session-done')).toHaveCount(0)
})
