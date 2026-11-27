import { describe, expect, test } from 'vitest'
import { CURRICULUM, UNLOCK } from './curriculum.ts'
import { daysRunning, heatmap, KEYS, levelOf, practiceDays, type Level } from './progress.ts'
import { newItem, review, type Item } from './items.ts'

const DAY0 = new Date(2026, 10, 1, 9)
const ok = { ms: 1000, hintLevel: 0, wrongNotes: 0 }

const withStability = (id: string, stability: number, reps = 1): Item => {
  const item = newItem(id, DAY0, DAY0)
  return { ...item, card: { ...item.card, stability, reps } }
}

describe('levelOf', () => {
  test.each<[string, Item | undefined, Level]>([
    ['no row', undefined, 'locked'],
    ['a locked row', newItem('chord:D:min:root', DAY0), 'locked'],
    ['unlocked, never reviewed', newItem('chord:D:min:root', DAY0, DAY0), 'new'],
    ['below the stable line', withStability('chord:D:min:root', UNLOCK.stableDays - 0.1), 'shaky'],
    ['at the stable line', withStability('chord:D:min:root', UNLOCK.stableDays), 'cold'],
  ])('%s', (_, item, level) => expect(levelOf(item).level).toBe(level))

  test('one Good review is shaky, a second spaced one is cold', () => {
    let item = newItem('chord:E:min:root', DAY0, DAY0)
    item = review(item, 3, ok, DAY0).item
    expect(levelOf(item).level).toBe('shaky')
    item = review(item, 3, ok, item.card.dueAt).item
    expect(levelOf(item).level).toBe('cold')
  })

  test('fill grows with stability and stops at the stable line', () => {
    expect(levelOf(withStability('chord:D:min:root', UNLOCK.stableDays / 2)).fill).toBe(0.5)
    expect(levelOf(withStability('chord:D:min:root', 90)).fill).toBe(1)
  })
})

describe('heatmap', () => {
  const groups = heatmap([])

  test('groups the scale, triad and 7th rows, every cell a curriculum item in its key column', () => {
    expect(groups.map((g) => g.track)).toEqual(['scales', 'triads', 'sevenths'])
    const ids = new Set(CURRICULUM.flatMap((u) => u.items))
    for (const row of groups.flatMap((g) => g.rows)) {
      expect(row.label).not.toBe('')
      expect(row.cells).toHaveLength(12)
      row.cells.forEach((cell, k) => {
        if (!cell) return
        expect(ids.has(cell.item)).toBe(true)
        expect(cell.item.split(':')[1]).toBe(KEYS[k])
      })
    }
  })

  test('covers every chord and scale item in the curriculum, once', () => {
    const shown = groups.flatMap((g) =>
      g.rows.flatMap((r) => r.cells.flatMap((c) => c?.item ?? [])),
    )
    const expected = CURRICULUM.flatMap((u) => u.items).filter((id) => /^(chord|scale):/.test(id))
    expect(shown.sort()).toEqual(expected.sort())
  })

  test('labels rows by quality and inversion', () => {
    const labels = groups.flatMap((g) => g.rows.map((r) => r.label))
    expect(labels).toContain('Minor pentatonic')
    expect(labels).toContain('Minor')
    expect(labels).toContain('Major, 1st inversion')
    expect(labels).toContain('Dominant 7th')
  })

  test('reads stored items and ignores ones outside the grid', () => {
    const stored = [
      withStability('chord:E:min:root', 30),
      newItem('chord:C:aug:root', DAY0, DAY0), // a random drill's, not in the curriculum
      newItem('geo:C', DAY0, DAY0),
    ]
    const minor = heatmap(stored)
      .flatMap((g) => g.rows)
      .find((r) => r.label === 'Minor')!
    expect(minor.cells[KEYS.indexOf('E')]).toMatchObject({
      item: 'chord:E:min:root',
      level: 'cold',
    })
    expect(minor.cells[KEYS.indexOf('D')]!.level).toBe('locked')
  })
})

describe('practiceDays and daysRunning', () => {
  const now = new Date(2026, 10, 27, 20)
  const day = (back: number, hour = 12) => {
    const d = new Date(2026, 10, 27, hour)
    d.setDate(d.getDate() - back)
    return d
  }

  test('marks local days with at least one attempt, oldest first, today last', () => {
    const days = practiceDays([day(0, 0), day(0, 23), day(2), day(13), day(14)], now, 14)
    expect(days).toHaveLength(14)
    expect(days[13]).toBe(true)
    expect(days[12]).toBe(false)
    expect(days[11]).toBe(true)
    expect(days[0]).toBe(true)
    expect(days.filter(Boolean)).toHaveLength(3)
  })

  test.each<[string, number[], number]>([
    ['nothing yet', [], 0],
    ['today only', [0], 1],
    ['three days up to today', [0, 1, 2], 3],
    ['not yet today: the run up to yesterday still counts', [1, 2], 2],
    ['a gap ends the run', [0, 2, 3], 1],
  ])('%s', (_, back, run) => {
    expect(
      daysRunning(
        practiceDays(
          back.map((b) => day(b)),
          now,
          14,
        ),
      ),
    ).toBe(run)
  })
})
