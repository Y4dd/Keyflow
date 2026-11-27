import { describe, expect, it } from 'vitest'
import {
  CURRICULUM,
  UNLOCK,
  unitProgress,
  unlockNext,
  validateCurriculum,
  type Unit,
} from './curriculum.ts'
import { drillOf } from './drills.ts'
import { newItem, type Item } from './items.ts'

const now = new Date('2026-11-27T10:00:00Z')
const unit = (
  id: string,
  items: string[],
  after: string[] = [],
  track: Unit['track'] = 'scales',
): Unit => ({
  id,
  track,
  title: id,
  items,
  after,
})
/** An unlocked item with a given stability in days. */
const known = (id: string, stability: number): Item => {
  const item = newItem(id, now, now)
  return { ...item, card: { ...item.card, stability } }
}
const stableAll = (ids: readonly string[]) => ids.map((id) => known(id, UNLOCK.stableDays))
const unitOf = (id: string) => CURRICULUM.find((x) => x.id === id)!

describe('the shipped curriculum', () => {
  it('is a valid graph', () => expect(validateCurriculum()).toEqual([]))

  it('every item is one the drills can make', () => {
    for (const { items } of CURRICULUM)
      for (const id of items) expect(() => drillOf(id)).not.toThrow()
  })

  it('has every track, and 7th chords need minor triads', () => {
    expect(new Set(CURRICULUM.map((x) => x.track)).size).toBe(5)
    expect(unitOf('m7').after).toContain('triads-min')
  })
})

describe('validateCurriculum', () => {
  it.each([
    ['a duplicate unit', [unit('a', ['geo:C']), unit('a', ['geo:D'])], 'duplicate unit a'],
    ['a missing prerequisite', [unit('a', ['geo:C'], ['zzz'])], 'a: unknown prerequisite zzz'],
    ['a bad item ID', [unit('a', ['geo'])], 'a: bad item ID geo'],
    [
      'an item in two units',
      [unit('a', ['geo:C']), unit('b', ['geo:C'])],
      'geo:C is in both a and b',
    ],
    ['an empty unit', [unit('a', [])], 'a: no items'],
    ['a self-cycle', [unit('a', ['geo:C'], ['a'])], 'cycle: a → a'],
    [
      'a longer cycle',
      [unit('a', ['geo:C'], ['c']), unit('b', ['geo:D'], ['a']), unit('c', ['geo:E'], ['b'])],
      'cycle: a → c → b → a',
    ],
  ])('finds %s', (_name, units, error) => expect(validateCurriculum(units)).toContain(error))

  it('accepts a diamond', () => {
    const units = [
      unit('a', ['geo:C']),
      unit('b', ['geo:D'], ['a']),
      unit('c', ['geo:E'], ['a']),
      unit('d', ['geo:F'], ['b', 'c']),
    ]
    expect(validateCurriculum(units)).toEqual([])
  })
})

describe('unitProgress', () => {
  const u = unit('a', ['geo:C', 'geo:D', 'geo:E', 'geo:F'])
  it('counts items that are unlocked and at the stability threshold', () => {
    const items = [
      known('geo:C', UNLOCK.stableDays),
      known('geo:D', UNLOCK.stableDays - 0.1),
      { ...known('geo:E', 99), unlocked: null },
    ]
    expect(unitProgress(u, items)).toBe(0.25)
  })
})

describe('unlockNext', () => {
  it('starts with the white keys, three at a time, and nothing else is ready', () => {
    expect(unlockNext([])).toEqual(['geo:C', 'geo:D', 'geo:E'])
    expect(unlockNext([], 4)).toHaveLength(4)
  })

  it('skips items already unlocked', () => {
    const items = [known('geo:C', 0), known('geo:D', 0)]
    expect(unlockNext(items)).toEqual(['geo:E', 'geo:F', 'geo:G'])
  })

  it('opens a unit once its prerequisite is half stable, not before', () => {
    const white = unitOf('geo-white').items // 7: four stable is over half
    const three = white.slice(0, 3)
    const four = white.slice(0, 4)
    const next = (ids: string[]) =>
      unlockNext([...stableAll(ids), ...white.slice(4).map((id) => known(id, 0))], 99)
    expect(next(three)).not.toContain('geo:C#')
    expect(next(four)).toContain('geo:C#')
    expect(next(four)).toContain('chord:D:min:root')
    expect(next(four)).toContain('scale:D:minPent:asc1')
  })

  it('mixes tracks instead of finishing one', () => {
    const picks = unlockNext(stableAll(unitOf('geo-white').items), 3)
    const types = picks.map((id) => id.split(':')[0])
    expect(types).toContain('scale')
    expect(types).toContain('chord')
  })

  it('serves the tracks with the fewest unlocked items, so none starves', () => {
    const triads = [...unitOf('triads-min').items, ...unitOf('triads-maj').items]
    const items = stableAll([...unitOf('geo-white').items, ...triads]) // all five tracks are ready
    const picks = unlockNext(items, 3)
    expect(picks.some((id) => id.startsWith('rn:'))).toBe(true)
    expect(picks.some((id) => id.includes(':m7:'))).toBe(true)
    expect(picks.some((id) => id.startsWith('scale:'))).toBe(true)
  })

  it('needs every prerequisite, not just one', () => {
    const white = stableAll(unitOf('geo-white').items)
    const min = stableAll(unitOf('triads-min').items)
    const maj = stableAll(unitOf('triads-maj').items)
    const m7 = stableAll(unitOf('m7').items)
    const unstable = (ids: readonly string[]) => ids.map((id) => known(id, 0))
    const dom7 = (items: Item[]) => unlockNext(items, 999).some((id) => id.includes(':7:any'))
    // dom7 needs triads-maj and m7
    expect(dom7([...white, ...min, ...unstable(unitOf('triads-maj').items), ...m7])).toBe(false)
    expect(dom7([...white, ...min, ...maj, ...unstable(unitOf('m7').items)])).toBe(false)
    expect(dom7([...white, ...min, ...maj, ...m7])).toBe(true)
  })

  it('puts the groove keys first in a unit', () => {
    const picks = unlockNext(stableAll(unitOf('geo-white').items), 99)
    expect(picks.filter((id) => id.startsWith('chord:')).slice(0, 4)).toEqual([
      'chord:D:min:root',
      'chord:Eb:min:root',
      'chord:Db:min:root',
      'chord:F:min:root',
    ])
    expect(picks.filter((id) => id.startsWith('scale:')).slice(0, 2)).toEqual([
      'scale:D:minPent:asc1',
      'scale:F:minPent:asc1',
    ])
  })

  it('unlocks 7th chords only after minor triads are stable in six keys', () => {
    const triads = unitOf('triads-min').items
    const withStable = (n: number) => [
      ...stableAll(unitOf('geo-white').items),
      ...stableAll(triads.slice(0, n)),
      ...triads.slice(n).map((id) => known(id, 0)),
    ]
    expect(unlockNext(withStable(5), 999).some((id) => id.includes(':m7:'))).toBe(false)
    expect(unlockNext(withStable(6), 999).some((id) => id.includes(':m7:'))).toBe(true)
  })

  it('returns nothing once everything is unlocked', () => {
    const all = CURRICULUM.flatMap((x) => x.items).map((id) => known(id, 0))
    expect(unlockNext(all)).toEqual([])
  })
})
