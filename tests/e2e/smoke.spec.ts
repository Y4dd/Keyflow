import { expect, test } from '@playwright/test'

test('app shell loads', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Keyflow')
  await expect(page.getByRole('heading', { name: 'Keyflow' })).toBeVisible()
})

// Headless browsers differ in MIDI support and permission state, so this only checks that
// onboarding settles in one of its states and shows that state's heading.
test('MIDI onboarding settles in a known state', async ({ page }) => {
  await page.goto('/')
  const panel = page.getByRole('region', { name: 'Keyboard' })
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('heading')).toHaveText(
    /Connect your keyboard|No keyboard found|Keyboard connected|MIDI access was refused|can't use MIDI keyboards/,
  )
})

test('MIDI permission already granted: requests silently, no Connect button', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Only Chromium lets Playwright grant the midi permission')
  await context.grantPermissions(['midi'])
  await page.goto('/')
  const panel = page.getByRole('region', { name: 'Keyboard' })
  await expect(panel.getByRole('heading')).toHaveText(
    /No keyboard found|Keyboard connected|MIDI access was refused/,
  )
  await expect(panel.getByRole('button', { name: 'Connect' })).toHaveCount(0)
})
