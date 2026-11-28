import { expect, test, type Page } from '@playwright/test'

// Progress (P2-T7): recorded attempts show in the heatmap and the practice days without a
// reload. The levels and day maths are unit-tested (src/practice/progress.test.ts).

interface DevApi {
  items: {
    record(
      id: string,
      rating: number,
      attempt: object,
      now?: number,
    ): Promise<{ card: { dueAt: Date } }>
  }
}
type DevWindow = Window & { __keyflow?: DevApi }

async function record(page: Page, id: string, now?: number) {
  return page.evaluate(
    ([id, now]) =>
      (window as DevWindow).__keyflow!.items.record(
        id,
        3, // Good
        { ms: 1500, hintLevel: 0, wrongNotes: 0 },
        now,
      ),
    [id, now] as const,
  )
}

test('attempts fill the heatmap and the practice days as they are recorded', async ({ page }) => {
  await page.goto('/#/practice')
  await page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
  const progress = page.getByTestId('progress')
  const mark = (id: string) => progress.locator(`td[data-item="${id}"] .mark`)

  await expect(progress.getByTestId('progress-empty')).toBeVisible() // nothing open: no grid yet
  await expect(progress.getByTestId('progress-days')).toContainText('Your practice days show here')

  const first = await record(page, 'chord:E:min:root')
  await expect(mark('chord:E:min:root')).toHaveAttribute('data-level', 'shaky')
  await expect(progress.getByTestId('progress-empty')).toHaveCount(0)
  await expect(progress.getByTestId('progress-days')).toHaveText(
    'You practised on 1 of the last 14 days.',
  )

  // a second Good when it's due takes it past the stable line
  await record(page, 'chord:E:min:root', first.card.dueAt.getTime())
  await expect(mark('chord:E:min:root')).toHaveAttribute('data-level', 'cold')
  await expect(progress.locator('.legend')).toContainText('Known cold 1')
  await expect(mark('chord:D:min:root')).toHaveAttribute('data-level', 'locked')
})
