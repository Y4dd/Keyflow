import { describe, expect, it } from 'vitest'
import { Rating } from 'ts-fsrs'
import { isItemId, newItem, review } from './items.ts'

const now = new Date('2026-11-27T10:00:00Z')
const attempt = { ms: 1800, hintLevel: 0, wrongNotes: 0 }
const day = 86_400_000

describe('isItemId', () => {
  it.each([
    ['geo:F#', true],
    ['chord:E:min:root', true],
    ['scale:A:minPent:asc1', true],
    ['rn:G:major:vi', true],
    ['prog:ii-V-I:Bb', true],
    ['ear:degree:5', true],
    ['lick:l1:C', true],
    ['chord:E:min', false],
    ['geo:', false],
    ['geo', false],
    ['song:x', false],
    ['chord:E::root', false],
  ])('%s → %s', (id, ok) => expect(isItemId(id)).toBe(ok))
})

describe('items', () => {
  it('a new item is due now and rejects a bad ID', () => {
    const item = newItem('chord:E:min:root', now, now)
    expect(item.card.dueAt).toEqual(now)
    expect(item.card.reps).toBe(0)
    expect(item.unlocked).toEqual(now)
    expect(() => newItem('chord:E', now)).toThrow()
  })

  it('a rating schedules the next review and logs the attempt', () => {
    const item = newItem('geo:F#', now)
    const good = review(item, Rating.Good, attempt, now)
    expect(good.item.card.reps).toBe(1)
    expect(good.item.card.dueAt.getTime()).toBeGreaterThan(now.getTime())
    expect(good.log).toMatchObject({ item: 'geo:F#', at: now, rating: Rating.Good, ...attempt })
    expect(item.card.reps).toBe(0) // not changed in place
    const again = review(item, Rating.Again, attempt, now)
    expect(again.item.card.dueAt.getTime()).toBeLessThan(good.item.card.dueAt.getTime())
  })

  it('a stored card schedules again, and stability grows with each good review', () => {
    // structuredClone is what IndexedDB does to a row (Dates stay Dates)
    let item = newItem('scale:A:minPent:asc1', now)
    let t = now
    const stabilities: number[] = []
    for (let i = 0; i < 4; i++) {
      item = structuredClone(review(item, Rating.Good, attempt, t).item)
      stabilities.push(item.card.stability)
      t = new Date(item.card.dueAt.getTime() + day)
    }
    expect(stabilities).toEqual([...stabilities].sort((a, b) => a - b))
    expect(new Set(stabilities).size).toBe(4)
    expect(item.card.reps).toBe(4)
  })
})
