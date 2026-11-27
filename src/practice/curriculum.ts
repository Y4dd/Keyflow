// The curriculum graph (P2-T5). Pure data plus two small functions: the graph says which items
// exist and what must be stable before they unlock; `unlockNext` says which to unlock now.
// Item IDs follow docs/learning-design.md. The session builder (P2-T6) calls `unlockNext`, and
// the progress view (P2-T7) reads `CURRICULUM` and `unitProgress`.

import { isItemId, type Item } from './items.ts'

export type TrackId = 'geography' | 'scales' | 'triads' | 'sevenths' | 'chordsInKey'

export interface Unit {
  id: string
  track: TrackId
  title: string
  /** Item IDs in the order they unlock. */
  items: readonly string[]
  /** Units that must be stable first (see UNLOCK); none for a track's start. */
  after: readonly string[]
}

/**
 * When a unit counts as stable, and how many new items one session may unlock.
 * shortcut: starting values picked by feel, not measured; tune them once there is real review
 * data (the progress view shows it).
 */
export const UNLOCK = {
  /** FSRS stability in days (days until recall drops to 90%) for one item to count as stable. */
  stableDays: 7,
  /** The share of a prerequisite unit's items that must be stable: 0.5 is "about six keys" of 12. */
  share: 0.5,
  /** New items per session: learning-design.md allows 2 to 4. */
  perSession: 3,
}

// ---- The data ----

// Roots with the keys the grooves use (D, E♭, D♭, F) first, so new items pay off in jam mode
// right away (the phase file's open question, recommended order).
const ROOTS = ['D', 'Eb', 'Db', 'F', 'A', 'E', 'G', 'C', 'Bb', 'Ab', 'B', 'F#']
const WHITE = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const BLACK = ['C#', 'Db', 'D#', 'Eb', 'F#', 'Gb', 'G#', 'Ab', 'A#', 'Bb']
// common keys for chords in key, groove keys first
const RN_KEYS = { major: ['Eb', 'Db', 'C', 'G'], minor: ['D', 'F', 'A', 'E'] }
const RN_NUMERALS = {
  triads: { major: ['ii', 'iii', 'IV', 'V', 'vi'], minor: ['iv', 'v', 'bIII', 'bVI', 'bVII'] },
  sevenths: { major: ['ii7', 'V7', 'IVmaj7'], minor: ['iv7', 'bVImaj7'] },
}

const geo = (notes: string[]) => notes.map((n) => `geo:${n}`)
const chords = (quality: string, variant: string) =>
  ROOTS.map((r) => `chord:${r}:${quality}:${variant}`)
const scales = (quality: string, roots = ROOTS) => roots.map((r) => `scale:${r}:${quality}:asc1`)
const rn = (kind: 'triads' | 'sevenths') =>
  (['major', 'minor'] as const).flatMap((mode) =>
    RN_NUMERALS[kind][mode].flatMap((n) => RN_KEYS[mode].map((k) => `rn:${k}:${mode}:${n}`)),
  )

const u = (
  id: string,
  track: TrackId,
  title: string,
  items: string[],
  ...after: string[]
): Unit => ({ id, track, title, items, after })

// shortcut: scales are the ascending-octave item only; add desc1 and updown1 units once those
// feel worth drilling separately.
export const CURRICULUM: readonly Unit[] = [
  u('geo-white', 'geography', 'White keys', geo(WHITE)),
  u('geo-black', 'geography', 'Black keys, sharp and flat names', geo(BLACK), 'geo-white'),

  u(
    'minpent-groove',
    'scales',
    'Minor pentatonic in D and F, the groove minors',
    scales('minPent', ['D', 'F']),
    'geo-white',
  ),
  u(
    'minpent-all',
    'scales',
    'Minor pentatonic in the other 10 keys',
    scales(
      'minPent',
      ROOTS.filter((r) => r !== 'D' && r !== 'F'),
    ),
    'minpent-groove',
  ),
  u('blues', 'scales', 'Blues scale', scales('blues'), 'minpent-all'),
  u('dorian', 'scales', 'Dorian', scales('dorian'), 'minpent-all'),
  u('majpent', 'scales', 'Major pentatonic', scales('majPent'), 'minpent-all'),
  u('mixolydian', 'scales', 'Mixolydian', scales('mixolydian'), 'majpent', 'dorian'),

  u('triads-min', 'triads', 'Minor triads in all 12 keys', chords('min', 'root'), 'geo-white'),
  u('triads-maj', 'triads', 'Major triads in all 12 keys', chords('maj', 'root'), 'geo-white'),
  u('triads-dim', 'triads', 'Diminished triads', chords('dim', 'root'), 'triads-min', 'triads-maj'),
  u(
    'triads-sus',
    'triads',
    'Sus2 and sus4',
    [...chords('sus2', 'root'), ...chords('sus4', 'root')],
    'triads-min',
    'triads-maj',
  ),
  u(
    'triads-inv1',
    'triads',
    'First inversions',
    [...chords('maj', 'inv1'), ...chords('min', 'inv1')],
    'triads-min',
    'triads-maj',
  ),
  u(
    'triads-inv2',
    'triads',
    'Second inversions',
    [...chords('maj', 'inv2'), ...chords('min', 'inv2')],
    'triads-inv1',
  ),

  u('m7', 'sevenths', 'Minor 7th chords', chords('m7', 'any'), 'triads-min'),
  u('dom7', 'sevenths', 'Dominant 7th chords', chords('7', 'any'), 'triads-maj', 'm7'),
  u('maj7', 'sevenths', 'Major 7th chords', chords('maj7', 'any'), 'triads-maj', 'm7'),

  u(
    'rn-triads',
    'chordsInKey',
    'Diatonic triads by Roman numeral',
    rn('triads'),
    'triads-min',
    'triads-maj',
  ),
  u(
    'rn-sevenths',
    'chordsInKey',
    'Diatonic 7ths by Roman numeral',
    rn('sevenths'),
    'rn-triads',
    'm7',
    'dom7',
    'maj7',
  ),
]

// ---- Validation ----

/** Everything wrong with a graph: duplicate IDs, a bad item ID, a missing prerequisite, a cycle. */
export function validateCurriculum(units: readonly Unit[] = CURRICULUM): string[] {
  const errors: string[] = []
  const byId = new Map<string, Unit>()
  const owner = new Map<string, string>()
  for (const unit of units) {
    if (byId.has(unit.id)) errors.push(`duplicate unit ${unit.id}`)
    byId.set(unit.id, unit)
    if (unit.items.length === 0) errors.push(`${unit.id}: no items`)
    for (const item of unit.items) {
      if (!isItemId(item)) errors.push(`${unit.id}: bad item ID ${item}`)
      const other = owner.get(item)
      if (other) errors.push(`${item} is in both ${other} and ${unit.id}`)
      owner.set(item, unit.id)
    }
  }
  for (const unit of units)
    for (const p of unit.after)
      if (!byId.has(p)) errors.push(`${unit.id}: unknown prerequisite ${p}`)

  // depth-first, 0 = unseen, 1 = on the current path, 2 = done
  const state = new Map<string, 1 | 2>()
  const visit = (id: string, path: string[]) => {
    if (state.get(id) === 2) return
    if (state.get(id) === 1) {
      errors.push(`cycle: ${[...path.slice(path.indexOf(id)), id].join(' → ')}`)
      return
    }
    state.set(id, 1)
    for (const p of byId.get(id)?.after ?? []) if (byId.has(p)) visit(p, [...path, id])
    state.set(id, 2)
  }
  for (const unit of units) visit(unit.id, [])
  return errors
}

// ---- Unlocking ----

type Progress = Pick<Item, 'id' | 'card' | 'unlocked'>

/** The share of a unit's items that are unlocked and have reached the stability threshold. */
export function unitProgress(unit: Unit, items: readonly Progress[]): number {
  const stable = new Set(
    items.filter((i) => i.unlocked && i.card.stability >= UNLOCK.stableDays).map((i) => i.id),
  )
  return unit.items.filter((id) => stable.has(id)).length / unit.items.length
}

/**
 * The item IDs to unlock now, at most `cap`: the next locked items of units whose prerequisites are
 * stable, in unit and item order, each slot from the track with the fewest unlocked items so far
 * (a session mixes tracks and none starves).
 * shortcut: throws on a graph with an unknown prerequisite; run validateCurriculum on custom graphs.
 */
export function unlockNext(
  items: readonly Progress[],
  cap = UNLOCK.perSession,
  units: readonly Unit[] = CURRICULUM,
): string[] {
  const open = new Set(items.filter((i) => i.unlocked).map((i) => i.id))
  const byId = new Map(units.map((x) => [x.id, x]))
  const ready = (unit: Unit) =>
    unit.after.every((p) => unitProgress(byId.get(p)!, items) >= UNLOCK.share)

  const perTrack = new Map<TrackId, string[]>()
  for (const unit of units) {
    if (!ready(unit)) continue
    const next = unit.items.filter((id) => !open.has(id))
    perTrack.set(unit.track, [...(perTrack.get(unit.track) ?? []), ...next])
  }
  // each slot goes to the ready track with the fewest unlocked items, so no track starves
  const count = new Map<TrackId, number>()
  for (const unit of units) {
    const n = unit.items.filter((id) => open.has(id)).length
    count.set(unit.track, (count.get(unit.track) ?? 0) + n)
  }
  const out: string[] = []
  while (out.length < cap) {
    let best: TrackId | null = null
    for (const [track, q] of perTrack)
      if (q.length && (best === null || count.get(track)! < count.get(best)!)) best = track
    if (best === null) break
    out.push(perTrack.get(best)!.shift()!)
    count.set(best, count.get(best)! + 1)
  }
  return out
}
