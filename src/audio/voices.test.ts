import { describe, expect, it } from 'vitest'
import { createMonoNoteStack, createPolyAllocator, glideTimeFor } from './voices.ts'

describe('createPolyAllocator', () => {
  it('gives each new pitch a free voice and releases it on note-off', () => {
    const a = createPolyAllocator(4)
    expect(a.noteOn(60)).toEqual({ kind: 'start', voice: 0 })
    expect(a.noteOn(64)).toEqual({ kind: 'start', voice: 1 })
    expect(a.noteOn(67)).toEqual({ kind: 'start', voice: 2 })
    expect(a.heldCount()).toBe(3)
    expect(a.noteOff(64)).toBe(1)
    expect(a.heldCount()).toBe(2)
  })

  it('reuses the voice released longest ago, so recent tails ring out', () => {
    const a = createPolyAllocator(3)
    a.noteOn(60) // v0
    a.noteOn(62) // v1
    a.noteOn(64) // v2
    a.noteOff(62) // v1 released first
    a.noteOff(60) // then v0
    expect(a.noteOn(70)).toEqual({ kind: 'start', voice: 1 })
    expect(a.noteOn(72)).toEqual({ kind: 'start', voice: 0 })
  })

  it('replays a pitch on the voice still ringing it out, so it never doubles', () => {
    const a = createPolyAllocator(3)
    a.noteOn(60) // v0
    a.noteOn(62) // v1
    a.noteOff(60)
    a.noteOff(62)
    // v2 was never used, so it's the "oldest" free voice, but v0 and v1 are still ringing.
    expect(a.noteOn(60)).toEqual({ kind: 'start', voice: 0 })
    expect(a.noteOn(62)).toEqual({ kind: 'start', voice: 1 })
  })

  it('steals the oldest held note when every voice is busy', () => {
    const a = createPolyAllocator(2)
    a.noteOn(60) // v0
    a.noteOn(64) // v1
    expect(a.noteOn(67)).toEqual({ kind: 'steal', voice: 0, stolenNote: 60 })
    expect(a.heldCount()).toBe(2)
    // The stolen note's key-up changes nothing; the voice now belongs to 67.
    expect(a.noteOff(60)).toBeNull()
    expect(a.noteOff(67)).toBe(0)
  })

  it('treats a re-struck note as new when choosing what to steal', () => {
    const a = createPolyAllocator(2)
    a.noteOn(60) // v0
    a.noteOn(64) // v1
    a.noteOn(60) // retrigger: 60 is now newer than 64
    expect(a.noteOn(67)).toEqual({ kind: 'steal', voice: 1, stolenNote: 64 })
  })

  it('ref-counts a pitch pressed twice: it sounds until the last press lifts', () => {
    const a = createPolyAllocator(4)
    expect(a.noteOn(60)).toEqual({ kind: 'start', voice: 0 })
    expect(a.noteOn(60)).toEqual({ kind: 'retrigger', voice: 0 })
    expect(a.heldCount()).toBe(1)
    expect(a.noteOff(60)).toBeNull()
    expect(a.noteOff(60)).toBe(0)
    expect(a.noteOff(60)).toBeNull()
  })

  it('ignores a note-off with no note-on', () => {
    const a = createPolyAllocator(2)
    expect(a.noteOff(61)).toBeNull()
    expect(a.heldCount()).toBe(0)
  })

  it('releaseAll returns every held voice once and clears the counts', () => {
    const a = createPolyAllocator(4)
    a.noteOn(67) // v0
    a.noteOn(60) // v1
    a.noteOn(60)
    a.noteOn(64) // v2
    a.noteOff(64)
    expect(a.releaseAll()).toEqual([0, 1])
    expect(a.heldCount()).toBe(0)
    expect(a.noteOff(60)).toBeNull()
    expect(a.releaseAll()).toEqual([])
  })

  it('rejects a voice count below 1', () => {
    expect(() => createPolyAllocator(0)).toThrow(/≥ 1/)
  })
})

describe('createMonoNoteStack', () => {
  it('attacks the first note and releases when it lifts', () => {
    const s = createMonoNoteStack()
    expect(s.noteOn(60)).toEqual({ kind: 'attack', note: 60 })
    expect(s.current()).toBe(60)
    expect(s.noteOff(60)).toEqual({ kind: 'release' })
    expect(s.current()).toBeNull()
  })

  it('last-note priority: a new key while one is held moves legato', () => {
    const s = createMonoNoteStack()
    s.noteOn(60)
    expect(s.noteOn(64)).toEqual({ kind: 'legato', note: 64 })
    expect(s.current()).toBe(64)
  })

  it('lifting the sounding key returns legato to the newest key still held', () => {
    const s = createMonoNoteStack()
    s.noteOn(60)
    s.noteOn(64)
    s.noteOn(67)
    expect(s.noteOff(67)).toEqual({ kind: 'legato', note: 64 })
    expect(s.noteOff(64)).toEqual({ kind: 'legato', note: 60 })
    expect(s.noteOff(60)).toEqual({ kind: 'release' })
  })

  it('lifting a key that is not sounding changes nothing', () => {
    const s = createMonoNoteStack()
    s.noteOn(60)
    s.noteOn(64)
    expect(s.noteOff(60)).toBeNull()
    expect(s.current()).toBe(64)
    expect(s.noteOff(64)).toEqual({ kind: 'release' })
  })

  it('a note played after all keys are up attacks again (no glide)', () => {
    const s = createMonoNoteStack()
    s.noteOn(60)
    s.noteOff(60)
    expect(s.noteOn(62)).toEqual({ kind: 'attack', note: 62 })
  })

  it('ref-counts a pitch pressed twice', () => {
    const s = createMonoNoteStack()
    expect(s.noteOn(60)).toEqual({ kind: 'attack', note: 60 })
    expect(s.noteOn(60)).toBeNull()
    expect(s.noteOff(60)).toBeNull()
    expect(s.current()).toBe(60)
    expect(s.noteOff(60)).toEqual({ kind: 'release' })
  })

  it('pressing a held pitch again brings it back on top', () => {
    const s = createMonoNoteStack()
    s.noteOn(60)
    s.noteOn(64)
    expect(s.noteOn(60)).toEqual({ kind: 'legato', note: 60 })
    expect(s.held()).toEqual([64, 60])
    s.noteOff(60) // one of two presses
    expect(s.current()).toBe(60)
  })

  it('ignores a note-off with no note-on', () => {
    const s = createMonoNoteStack()
    expect(s.noteOff(60)).toBeNull()
    s.noteOn(62)
    expect(s.noteOff(60)).toBeNull()
    expect(s.current()).toBe(62)
  })

  it('releaseAll releases once and forgets every key', () => {
    const s = createMonoNoteStack()
    expect(s.releaseAll()).toBeNull()
    s.noteOn(60)
    s.noteOn(64)
    expect(s.releaseAll()).toEqual({ kind: 'release' })
    expect(s.held()).toEqual([])
    expect(s.noteOff(64)).toBeNull()
    expect(s.noteOn(64)).toEqual({ kind: 'attack', note: 64 })
  })
})

describe('glideTimeFor (legato-only glide)', () => {
  it('glides only on legato moves', () => {
    expect(glideTimeFor({ kind: 'legato', note: 64 }, 0.06)).toBe(0.06)
    expect(glideTimeFor({ kind: 'attack', note: 64 }, 0.06)).toBe(0)
    expect(glideTimeFor({ kind: 'release' }, 0.06)).toBe(0)
    expect(glideTimeFor({ kind: 'legato', note: 64 }, -1)).toBe(0)
  })

  it('glide-hold also glides into a detached note, but not into the first one', () => {
    expect(glideTimeFor({ kind: 'attack', note: 64 }, 0.06, true)).toBe(0.06)
    expect(glideTimeFor({ kind: 'legato', note: 64 }, 0.06, true)).toBe(0.06)
    expect(glideTimeFor({ kind: 'release' }, 0.06, true)).toBe(0)
    // Nothing played yet: there is no pitch to glide from.
    expect(glideTimeFor({ kind: 'attack', note: 64 }, 0.06, true, false)).toBe(0)
  })

  it('a played phrase: glide on the overlapping notes, none after a gap', () => {
    const s = createMonoNoteStack()
    const glides = [
      s.noteOn(60), // attack
      s.noteOn(63), // overlapping: legato
      s.noteOff(60), // not sounding: nothing
      s.noteOff(63), // release
      s.noteOn(65), // after a gap: attack
      s.noteOn(67), // legato
      s.noteOff(67), // back to 65: legato
    ]
      .filter((a) => a !== null)
      .map((a) => glideTimeFor(a, 0.05))
    expect(glides).toEqual([0, 0.05, 0, 0, 0.05, 0.05])
  })
})
