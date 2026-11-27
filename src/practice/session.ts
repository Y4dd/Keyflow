// The session builder (P2-T6). Pure: the store (src/state/session.ts) loads the items and recent
// ratings and plays the queue. A core session is the due items, most overdue first, capped and
// interleaved, then the curriculum's new items (unlockNext), as many as the rolling success
// rate allows (learning-design.md, "Session structure" and "Desirable difficulty").

import type { Grade } from 'ts-fsrs'
import type { Groove } from '../grooves/groove.ts'
import type { ScaleId } from '../music/harmony.ts'
import { UNLOCK, unlockNext } from './curriculum.ts'
import { drillOf, SCALE_BPM, type Drill } from './drills.ts'
import type { Item } from './items.ts'

/**
 * shortcut: starting values picked by feel (about 15 s a drill fills 5 minutes); tune them once
 * there is review data. Strict modes aren't raised with the success rate yet, only new items;
 * add them (strict inversion once root positions are stable) with the phase's open question.
 */
export const SESSION = {
  /** Due reviews in one core session, so a week away isn't a 60-drill "5 minutes". */
  dueCap: 20,
  /** The last N attempts the success rate is measured over. */
  window: 20,
  /** Fewer attempts than this count as neither high nor low. */
  minAttempts: 10,
  /** Success rate (not Again) above which a session gets one more new item. */
  high: 0.9,
  /** Success rate below which a session gets the fewest new items. */
  low: 0.7,
  /** New items per session at a low, normal and high rate: learning-design.md allows 2 to 4. */
  newItems: { low: 2, normal: UNLOCK.perSession, high: 4 },
}

/** How many new items this session gets, from the latest ratings (any order). */
export function newItemCap(ratings: readonly Grade[]): number {
  const recent = ratings.slice(-SESSION.window)
  if (recent.length < SESSION.minAttempts) return SESSION.newItems.normal
  const rate = recent.filter((r) => r > 1).length / recent.length
  if (rate > SESSION.high) return SESSION.newItems.high
  if (rate < SESSION.low) return SESSION.newItems.low
  return SESSION.newItems.normal
}

const typeOf = (id: string) => id.split(':')[0]!
const keyOf = (id: string) => id.split(':')[1]!

/**
 * The IDs reordered so neighbours differ in type (geo, chord, scale, rn) wherever the mix allows,
 * then in key, keeping the given priority within a type. `previous` is the item shown just
 * before, so a session never opens with it unless it is the only one.
 */
export function interleave(ids: readonly string[], previous: string | null = null): string[] {
  const byType = new Map<string, string[]>()
  for (const id of ids) byType.set(typeOf(id), [...(byType.get(typeOf(id)) ?? []), id])
  const out: string[] = []
  let prev = previous
  while (out.length < ids.length) {
    // the fullest type that isn't the last one shown spreads the rest best
    const rank = (type: string, q: string[]) =>
      (prev !== null && typeOf(prev) === type ? ids.length : 0) - q.length
    let q: string[] = []
    let best = Infinity
    for (const [type, left] of byType)
      if (left.length && rank(type, left) < best) [q, best] = [left, rank(type, left)]
    // within it, the first in priority that isn't the last item, in another key if one is left
    const otherKey = q.findIndex(
      (id) => id !== prev && (prev === null || keyOf(id) !== keyOf(prev)),
    )
    const i =
      otherKey >= 0
        ? otherKey
        : Math.max(
            0,
            q.findIndex((id) => id !== prev),
          )
    const id = q.splice(i, 1)[0]!
    out.push(id)
    prev = id
  }
  return out
}

/** The drill for a session item: scales in time, and a chord item new to the learner built. */
function drillFor(id: string, isNew: boolean): Drill | null {
  try {
    const variant = id.split(':')[3]
    return drillOf(id, {
      bpm: SCALE_BPM,
      build: isNew && typeOf(id) === 'chord' && (variant === 'root' || variant === 'any'),
    })
  } catch {
    return null // a row drills can't play (an ear or lick item, a bad import): skipped
  }
}

/**
 * Today's core session: due reviews first (unlocked items due by `now`, most overdue first, at
 * most SESSION.dueCap), interleaved, then up to newItemCap(ratings) new items, interleaved.
 */
export function buildSession(
  items: readonly Item[],
  ratings: readonly Grade[],
  now: Date,
  previous: string | null = null,
): Drill[] {
  const due = items
    .filter((i) => i.unlocked && i.card.dueAt <= now && drillFor(i.id, false))
    .sort((a, b) => a.card.dueAt.getTime() - b.card.dueAt.getTime())
    .slice(0, SESSION.dueCap)
    .map((i) => i.id)
  const fresh = unlockNext(items, newItemCap(ratings)).filter((id) => drillFor(id, true))
  const first = interleave(due, previous)
  return [
    ...first.map((id) => drillFor(id, false)!),
    ...interleave(fresh, first.at(-1) ?? previous).map((id) => drillFor(id, true)!),
  ]
}

// scale item qualities (learning-design.md's vocabulary) as the grooves' solo scales
const SOLO: Record<string, ScaleId> = {
  minPent: 'minor pentatonic',
  blues: 'minor blues',
  dorian: 'dorian',
  majPent: 'major pentatonic',
  mixolydian: 'mixolydian',
  major: 'major',
}

export interface Jam {
  grooveId: string
  scale: ScaleId
  /** The key's tonic as a pitch class, and its name as the item spells it ("Eb"). */
  tonic: number
  root: string
}

/**
 * The jam to offer after a session: the last scale practised that a groove offers as its solo
 * scale, in that scale's key; null when there's none.
 * shortcut: scales only, so early sessions (white keys) offer none; offer a comping jam for
 * chords in Phase 3.
 */
export function jamOf(session: readonly Drill[], grooves: readonly Groove[]): Jam | null {
  for (const d of [...session].reverse()) {
    if (d.kind !== 'scale') continue
    const [, root, quality] = d.item.split(':')
    const scale = SOLO[quality!]
    const g = grooves.find((g) => scale && [g.soloScale, ...g.altScales].includes(scale))
    if (g && scale) return { grooveId: g.id, scale, tonic: d.target[0]! % 12, root: root! }
  }
  return null
}
