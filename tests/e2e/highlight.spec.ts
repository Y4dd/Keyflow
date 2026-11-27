import { expect, test, type Page } from '@playwright/test'

// Jam-mode highlighting (P1-T4). The tier of each key is unit-tested (src/music/highlight.ts);
// here: the canvas draws what the controls choose in every look, and follows the chord while a
// groove plays.
// `lit` is false when a key's pixel is the unheld fill for its tier (dimmed for "other"), so
// it also proves the canvas redrew for the tier shown. Browsers are muted.

type Tier = 'chord' | 'scale' | 'other' | null
interface DevApi {
  pianoKey(note: number): { x: number; y: number; lit: boolean; tier: Tier } | null
  groove: { ticks(): number | null }
}
type DevWindow = Window & { __keyflow?: DevApi }

const D = 62
const E = 64
const F = 65
const G = 67
const B = 71
const PPQ = 192

async function open(page: Page) {
  await page.goto('/#/jam')
  await page.waitForFunction(() => (window as DevWindow).__keyflow !== undefined)
}

const key = (page: Page, note: number) =>
  page.evaluate((n) => (window as DevWindow).__keyflow!.pianoKey(n)!, note)
const card = (page: Page) => page.getByTestId('groove')
const LOOKS = ['Tags', 'Spotlight']
// "Help on the keys" (P2-T12) sets the training-wheels level and the look in one menu.
const help = (page: Page, label: string) =>
  card(page).getByRole('combobox', { name: 'Help on the keys' }).selectOption({ label })
const lookIs = (page: Page, look: string) => help(page, `${look} with names`)
const WHEELS: Record<string, (look: string) => string> = {
  Names: (look) => `${look} with names`,
  'No names': (look) => look,
  'Chord tones': () => 'Chord tones only',
  Off: () => 'Off',
}
const wheels = (page: Page, level: string, look = 'Tags') => help(page, WHEELS[level]!(look))

/**
 * The canvas keyboard's pixels as a hash, to compare two drawings. Read with getImageData, not
 * toDataURL: on CI's Chromium a toDataURL right after a redraw kept returning the previous drawing
 * (5 s of polling, then the right one), while getImageData always saw the new one.
 */
const image = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('canvas.piano-canvas')!
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
    let a = 0
    let b = 0
    for (let i = 0; i < d.length; i++) {
      a = (a * 31 + d[i]!) | 0
      b = (b * 17 + d[i]! + i) | 0
    }
    return a + ':' + b
  })

/** Waits until the key shows `tier`, drawn (not lit by a stale fill). */
const shows = (page: Page, note: number, tier: Tier) =>
  expect.poll(() => key(page, note)).toMatchObject({ tier, lit: false })

// Both looks (P1-T4b) draw each level, and follow the chord while a groove plays.
for (const look of LOOKS) {
  test(`${look}: stopped, the keyboard shows the groove's first chord at every training-wheels level`, async ({
    page,
  }) => {
    await open(page)
    await lookIs(page, look)
    // The vamp opens in D minor on i7 (Dm7: D F A C) with minor pentatonic (D F G A C).
    await shows(page, D, 'chord')
    await shows(page, G, 'scale')
    await shows(page, E, 'other')
    const withNames = await image(page)

    // Names and No names differ only in the note names, so the drawings must differ.
    await wheels(page, 'No names', look)
    await shows(page, E, 'other')
    await expect.poll(() => image(page)).not.toBe(withNames)
    await wheels(page, 'Chord tones', look)
    await shows(page, D, 'chord')
    await shows(page, G, null)
    await shows(page, E, null)
    await wheels(page, 'Off', look)
    await shows(page, D, null)
    await wheels(page, 'Names', look)
    await shows(page, E, 'other')
    await expect.poll(() => image(page)).toBe(withNames)
  })

  test(`${look}: the scale menu offers only the groove’s scales and resets with the groove; the key moves the chord`, async ({
    page,
  }) => {
    await open(page)
    await lookIs(page, look)
    const scale = card(page).getByRole('combobox', { name: 'Scale' })
    await expect(scale.locator('option')).toHaveText(['Minor pentatonic', 'Dorian', 'Blues'])
    await scale.selectOption({ label: 'Dorian' })
    await shows(page, E, 'scale') // Dorian adds E and B

    await card(page)
      .getByRole('combobox', { name: 'Groove' })
      .selectOption({ label: 'Soul groove' })
    await expect(scale).toHaveValue('major pentatonic')
    await expect(scale.locator('option')).toHaveText(['Major pentatonic', 'Major'])
    // Soul groove: E♭ major, Imaj7 = E♭maj7 (E♭ G B♭ D); E is outside it and the scale.
    await shows(page, D, 'chord')
    await shows(page, E, 'other')

    await card(page).getByRole('combobox', { name: /^Key/ }).selectOption({ label: 'F major' })
    // Fmaj7: F A C E.
    await shows(page, F, 'chord')
    await shows(page, E, 'chord')
  })

  test(`${look}: while a groove plays, the next chord shows before it sounds`, async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'Start audio' }).click()
    await expect(page.getByTestId('audio-status')).toHaveAttribute('data-status', 'running')
    await lookIs(page, look) // after Start audio: the first click anywhere turns sound on
    await card(page).getByLabel('Count-in').uncheck()
    await card(page).getByRole('button', { name: 'Play' }).click()

    // B is outside i7 (Dm7) and minor pentatonic, and the third of IV7 (G7), which starts at
    // beat 8. Watch every frame for the first one where B is drawn as a chord tone.
    const at = await page.evaluate(
      () =>
        new Promise<number | null>((resolve) => {
          const api = (window as DevWindow).__keyflow!
          const check = () => {
            const k = api.pianoKey(71)!
            const ticks = api.groove.ticks()
            if (k.tier === 'chord' && !k.lit) resolve(ticks)
            else requestAnimationFrame(check)
          }
          check()
        }),
    )
    expect(at).not.toBeNull()
    expect(at!).toBeGreaterThanOrEqual(8 * PPQ - PPQ / 2)
    expect(at!).toBeLessThan(8 * PPQ)
    await shows(page, B, 'chord')

    await card(page).getByRole('button', { name: 'Stop' }).click()
    // Stopped: back to the first chord.
    await shows(page, B, 'other')
  })
}

test('the computer-key letters can be hidden, and only they leave the drawing', async ({
  page,
}) => {
  await open(page)
  // Sound on first: the first click anywhere starts it, and the page around the keys settles.
  await page.getByRole('button', { name: 'Start audio' }).click()
  await expect(page.getByTestId('audio-status')).toHaveAttribute('data-status', 'running')
  await wheels(page, 'Off')
  await shows(page, E, null) // E was dimmed: now redrawn without highlighting
  await page.getByRole('link', { name: 'Setup', exact: true }).click() // the letters are a setting
  const toggle = page.getByLabel('Show the computer-key letters on the keys')
  // Two drawings in a row that match: nothing else is still changing the canvas.
  let withLetters = ''
  await expect.poll(async () => withLetters === (withLetters = await image(page))).toBe(true)
  await toggle.uncheck()
  await expect.poll(() => image(page)).not.toBe(withLetters)
  await toggle.check()
  await expect.poll(() => image(page)).toBe(withLetters)
})
