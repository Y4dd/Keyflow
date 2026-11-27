import type { Grade } from 'ts-fsrs'
import { describe, expect, it } from 'vitest'
import { GROOVES } from '../grooves/library.ts'
import { CURRICULUM } from './curriculum.ts'
import { newItem, review, type Item } from './items.ts'
import { buildSession, interleave, jamOf, newItemCap, SESSION } from './session.ts'

const NOW = new Date('2026-11-27T12:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000)
/** An unlocked item due `d` days ago. */
const due = (id: string, d = 1): Item => newItem(id, daysAgo(d), daysAgo(d))
/** An unlocked item reviewed Good just now, so not due. */
const fresh = (id: string): Item =>
  review(due(id), 3, { ms: 900, hintLevel: 0, wrongNotes: 0 }, NOW).item
const type = (id: string) => id.split(':')[0]
const repeats = (ids: string[]) => ids.slice(1).filter((id, i) => type(id) === type(ids[i]!))
const ratings = (good: number, again: number): Grade[] => [
  ...Array<Grade>(good).fill(3),
  ...Array<Grade>(again).fill(1),
]

describe('interleave', () => {
  it('keeps the same type apart whenever the mix allows', () => {
    const ids = ['chord:D:min:root', 'chord:E:min:root', 'chord:F:min:root', 'chord:G:min:root']
    const mixed = interleave([...ids, 'scale:D:minPent:asc1', 'geo:C', 'rn:G:major:vi'])
    expect(repeats(mixed)).toEqual([])
    expect(new Set(mixed).size).toBe(7)
  })

  it('repeats a type only as often as it must', () => {
    const ids = ['chord:D:min:root', 'chord:E:min:root', 'chord:F:min:root', 'geo:C']
    expect(repeats(interleave(ids))).toHaveLength(1)
  })

  it('moves to another key within a type', () => {
    const ids = ['chord:D:min:root', 'chord:D:maj:root', 'chord:E:min:root']
    expect(interleave(ids)).toEqual(['chord:D:min:root', 'chord:E:min:root', 'chord:D:maj:root'])
  })

  it('never opens with the item shown just before', () => {
    expect(interleave(['geo:C', 'geo:D'], 'geo:C')[0]).toBe('geo:D')
    expect(interleave(['geo:C', 'chord:E:min:root'], 'geo:D')[0]).toBe('chord:E:min:root')
  })
})

describe('newItemCap', () => {
  it.each([
    ['too few attempts to judge', ratings(3, 0), SESSION.newItems.normal],
    ['above 90%', ratings(19, 1), SESSION.newItems.high],
    ['between', ratings(16, 4), SESSION.newItems.normal],
    ['below 70%', ratings(13, 7), SESSION.newItems.low],
    [
      'only the latest window counts',
      [...ratings(0, 30), ...ratings(20, 0)],
      SESSION.newItems.high,
    ],
  ])('%s', (_, r, cap) => expect(newItemCap(r)).toBe(cap))

  it('stays within learning-design.md’s 2 to 4', () => {
    for (const n of Object.values(SESSION.newItems)) expect(n >= 2 && n <= 4).toBe(true)
  })
})

describe('buildSession', () => {
  it('starts a new learner on the curriculum’s first items', () => {
    const s = buildSession([], [], NOW)
    expect(s.map((d) => d.item)).toEqual(['geo:C', 'geo:D', 'geo:E'])
  })

  it('serves due items first, most overdue first within a type, then new ones', () => {
    const items = [due('geo:D', 1), due('geo:C', 3), fresh('geo:E'), due('scale:D:minPent:asc1', 2)]
    const s = buildSession(items, [], NOW).map((d) => d.item)
    expect(s.slice(0, 3)).toEqual(['geo:C', 'scale:D:minPent:asc1', 'geo:D'])
    expect(s).not.toContain('geo:E') // not due yet
    expect(s.slice(3)).toEqual(['geo:F', 'geo:G', 'geo:A']) // white keys still to unlock
  })

  it('leaves locked items out', () => {
    const locked = newItem('geo:C', daysAgo(5))
    expect(buildSession([locked], [], NOW).map((d) => d.item)).toEqual([
      'geo:C', // offered as new, not as a review
      'geo:D',
      'geo:E',
    ])
  })

  it('caps the due reviews and still offers new items', () => {
    // 24 due triads; the white keys are still new
    const triads = CURRICULUM.filter((u) => u.id === 'triads-min' || u.id === 'triads-maj')
    const items = triads.flatMap((u) => u.items).map((id) => due(id))
    const s = buildSession(items, [], NOW)
    expect(s).toHaveLength(SESSION.dueCap + SESSION.newItems.normal)
  })

  it('adds new items by the success rate', () => {
    expect(buildSession([], ratings(20, 0), NOW)).toHaveLength(SESSION.newItems.high)
    expect(buildSession([], ratings(10, 10), NOW)).toHaveLength(SESSION.newItems.low)
  })

  it('builds a new chord, plays a due one, and times scales', () => {
    const stable = CURRICULUM[0]!.items.map((id) => {
      const item = due(id, 30)
      return { ...item, card: { ...item.card, stability: 30, dueAt: daysAgo(-9) } }
    })
    const s = buildSession(
      [...stable, due('chord:E:min:root'), due('scale:D:minPent:asc1')],
      [],
      NOW,
    )
    expect(s.find((d) => d.item === 'chord:E:min:root')?.kind).toBe('chord')
    const others = s.filter((d) => d.item.startsWith('chord:') && d.item !== 'chord:E:min:root')
    expect(others.map((d) => d.kind)).toContain('build')
    const scale = s.find((d) => d.kind === 'scale')
    expect(scale?.kind === 'scale' && scale.bpm).toBe(70)
  })

  it('skips rows no drill can play', () => {
    expect(
      buildSession([due('ear:degree:5')], ratings(10, 0), NOW).map((d) => d.item),
    ).not.toContain('ear:degree:5')
  })
})

describe('jamOf', () => {
  const jam = (...items: Item[]) => jamOf(buildSession(items, [], NOW), GROOVES)

  it('offers the last scale practised, in its key, on a groove that solos in it', () => {
    expect(jam(due('scale:Eb:majPent:asc1'), due('scale:F:dorian:asc1', 2))).toEqual({
      grooveId: 'soul-groove',
      scale: 'major pentatonic',
      tonic: 3,
      root: 'Eb',
    })
  })

  it('skips a scale no groove offers, and offers nothing without one', () => {
    expect(jam(due('scale:A:mixolydian:asc1'))).toBeNull()
    expect(jam(due('scale:D:minPent:asc1', 2), due('scale:A:mixolydian:asc1'))).toMatchObject({
      grooveId: 'electro-funk-vamp',
      tonic: 2,
    })
    expect(jam()).toBeNull()
  })
})
