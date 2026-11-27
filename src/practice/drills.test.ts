import { describe, expect, it } from 'vitest'
import type { InputEvent } from '../input/types.ts'
import {
  CHORD_QUALITIES,
  createAttempt,
  drillOf,
  pickDrill,
  SCALE_BPM,
  SCALE_QUALITIES,
  type Attempt,
  type Drill,
} from './drills.ts'

const on = (note: number, time = 0): InputEvent => ({
  kind: 'noteOn',
  note,
  velocity: 0.8,
  time,
  source: 'sim',
})
const off = (note: number, time = 0): InputEvent => ({ kind: 'noteOff', note, time, source: 'sim' })

/** Feeds events, tracking held notes the simple way (no pedal), as the drill store does. */
function play(attempt: Attempt, events: InputEvent[]) {
  const held = new Set<number>()
  for (const e of events) {
    if (e.kind === 'noteOn') held.add(e.note)
    if (e.kind === 'noteOff') held.delete(e.note)
    attempt.apply(
      e,
      [...held].sort((a, b) => a - b),
    )
  }
  return attempt.state()
}

const chordNotes = (d: Drill) => (d.kind === 'scale' ? [] : d.answer)

describe('drillOf', () => {
  it('reads every chord and scale quality id', () => {
    for (const q of CHORD_QUALITIES) {
      const d = drillOf(`chord:C:${q}:any`)
      expect(d.kind).toBe('chord')
      if (d.kind === 'chord') expect(d.tones.length).toBeGreaterThanOrEqual(3)
    }
    for (const q of SCALE_QUALITIES) {
      const d = drillOf(`scale:C:${q}:asc1`)
      if (d.kind === 'scale') expect(d.target.length).toBeGreaterThanOrEqual(6)
    }
  })

  it.each([
    ['geo:F#', 'F♯'],
    ['chord:E:min:any', 'E minor'],
    ['chord:E:min:root', 'E minor, root position'],
    ['chord:F:m7:inv1', 'Fm7, 1st inversion'],
    ['chord:Bb:maj:inv2', 'B♭ major, 2nd inversion'],
    ['chord:B:m7b5:any', 'Bm7♭5'],
    ['scale:A:minPent:asc1', 'A minor pentatonic, up one octave'],
    ['scale:D:dorian:updown1', 'D Dorian, up and down one octave'],
    ['rn:G:major:vi', 'The vi chord in G'],
    ['rn:A:minor:bVII', 'The ♭VII chord in A minor'],
  ])('%s prompts "%s"', (item, prompt) => {
    expect(drillOf(item).prompt).toBe(prompt)
  })

  it('adds the tempo to a scale prompt', () => {
    expect(drillOf('scale:A:minPent:asc1', { bpm: 70 }).prompt).toBe(
      'A minor pentatonic, up one octave, at 70 BPM',
    )
  })

  it('builds a chord from its formula, the ladder starting at the method', () => {
    const d = drillOf('chord:D:min:any', { build: true })
    expect(d).toMatchObject({
      kind: 'build',
      prompt: 'Build D minor from its formula',
      hintStart: 2,
    })
    expect(d.detail).toBe('Minor: root, +3 half-steps, +4 half-steps')
    expect(drillOf('chord:D:min:any').hintStart).toBe(1)
    expect(drillOf('chord:C:m7:any', { build: true }).detail).toBe(
      'Minor 7th: root, +3 half-steps, +4 half-steps, +3 half-steps',
    )
  })

  it('names the chord a numeral gives in its key', () => {
    const d = drillOf('rn:G:major:vi')
    expect(d.kind === 'chordInKey' && d.tones).toEqual([4, 7, 11])
    expect(d.kind === 'chordInKey' && d.chordName).toBe('E minor')
    const ii = drillOf('rn:Bb:major:ii7')
    expect(ii.kind === 'chordInKey' && ii.chordName).toBe('Cm7')
  })

  it('plays one octave of a scale up, down, or both', () => {
    const at = (item: string) => {
      const d = drillOf(item)
      return d.kind === 'scale' ? d.target : []
    }
    expect(at('scale:A:minPent:asc1')).toEqual([57, 60, 62, 64, 67, 69])
    expect(at('scale:A:minPent:desc1')).toEqual([69, 67, 64, 62, 60, 57])
    expect(at('scale:A:minPent:updown1')).toEqual([57, 60, 62, 64, 67, 69, 67, 64, 62, 60, 57])
  })

  it('stacks an answer in the asked inversion', () => {
    expect(chordNotes(drillOf('chord:E:min:root'))).toEqual([52, 55, 59])
    expect(chordNotes(drillOf('chord:E:min:inv1'))).toEqual([55, 59, 64])
    expect(chordNotes(drillOf('chord:F:m7:inv3'))).toEqual([63, 65, 68, 72])
  })

  it.each([
    'geo:H',
    'geo:F#:x',
    'chord:E:minor:any',
    'chord:E:min:inv3',
    'chord:E:min',
    'scale:A:penta:asc1',
    'scale:A:minPent:asc2',
    'rn:G:major:viii',
    'rn:G:lydian:IV',
    'prog:ii-V-I:Bb',
    'chord:C:toString:any',
    'chord:C:maj:constructor',
    'scale:C:major:toString',
  ])('rejects %s', (item) => {
    expect(() => drillOf(item)).toThrow()
  })
})

describe('attempts', () => {
  it('find the note: any octave counts, wrong notes are counted', () => {
    const a = createAttempt(drillOf('geo:F#'), 1000)
    let s = play(a, [on(67, 1500)])
    expect(s).toMatchObject({ done: false, wrongNotes: 1, say: 'That’s G. Find F♯.' })
    s = play(a, [on(90, 2200)])
    expect(s).toMatchObject({ done: true, ms: 1200, wrongNotes: 1 })
  })

  it('play the chord: octave-agnostic, judged when a key goes down', () => {
    const a = createAttempt(drillOf('chord:E:min:any'), 0)
    expect(play(a, [on(64, 10), on(67, 20)]).done).toBe(false)
    expect(play(a, [on(64, 10), on(67, 20), on(47, 30)])).toMatchObject({
      done: true,
      ms: 30,
      wrongNotes: 0,
    })
  })

  it('a chord already held does not answer the next prompt', () => {
    const a = createAttempt(drillOf('chord:E:min:any'), 0)
    // keys from the last answer are still down, but only a new key-down judges
    a.apply(off(1), [52, 55, 59])
    expect(a.state().done).toBe(false)
  })

  it('names a wrong chord and the wrong bass', () => {
    const a = createAttempt(drillOf('chord:E:min:any'), 0)
    expect(play(a, [on(60), on(64), on(67), on(71)])).toMatchObject({
      done: false,
      wrongNotes: 1,
      say: 'You played Cmaj7.',
    })
    const b = createAttempt(drillOf('chord:E:min:root'), 0)
    expect(play(b, [on(55), on(59), on(64)])).toMatchObject({
      done: false,
      say: 'Right notes. Put E at the bottom.',
    })
  })

  it('lifting the wrong note answers, once a key went down for this drill', () => {
    const a = createAttempt(drillOf('chord:E:min:any'), 0)
    expect(play(a, [on(72), on(64), on(67), on(71), off(72, 50)])).toMatchObject({
      done: true,
      ms: 50,
      wrongNotes: 1,
    })
  })

  it('chord in key and build it judge like a chord', () => {
    const a = createAttempt(drillOf('rn:G:major:vi'), 0)
    expect(play(a, [on(52), on(55), on(59)]).done).toBe(true)
    const b = createAttempt(drillOf('chord:D:min:any', { build: true }), 0)
    expect(play(b, [on(62), on(65), on(69)]).done).toBe(true)
  })

  it('play the scale: a slip restarts the run, from the slipped note if it is the root', () => {
    const a = createAttempt(drillOf('scale:A:minPent:asc1'), 0)
    let s = play(a, [on(57), on(60), on(63)])
    expect(s).toMatchObject({
      done: false,
      wrongNotes: 1,
      say: 'Note 3 should be D. Start again from A.',
    })
    s = play(a, [on(69), on(72), on(74), on(76), on(79), on(81, 900)])
    expect(s).toMatchObject({ done: true, ms: 900, wrongNotes: 1 })
  })

  it('play the scale in time: a run out of time starts again', () => {
    const d = drillOf('scale:A:minPent:asc1', { bpm: 120 })
    const notes = d.kind === 'scale' ? d.target : []
    const a = createAttempt(d, 0)
    // twice as slow as asked
    let s = play(
      a,
      notes.map((n, i) => on(n, i * 1000)),
    )
    expect(s).toMatchObject({ done: false, say: 'Right notes at 60 BPM. Again at 120 BPM.' })
    s = play(
      a,
      notes.map((n, i) => on(n, 10000 + i * 500)),
    )
    expect(s).toMatchObject({ done: true, ms: 12500 })
  })

  it('a run with the right tempo but uneven gaps asks for even gaps', () => {
    const d = drillOf('scale:A:minPent:asc1', { bpm: 60 })
    const notes = d.kind === 'scale' ? d.target : []
    const times = [0, 1000, 2000, 3000, 4000, 5700]
    expect(
      play(
        createAttempt(d, 0),
        notes.map((n, i) => on(n, times[i])),
      ),
    ).toMatchObject({
      done: false,
      say: 'Right notes. Keep the gaps even.',
    })
  })

  it('ignores input once done', () => {
    const a = createAttempt(drillOf('geo:C'), 0)
    play(a, [on(60, 5)])
    expect(play(a, [on(61, 9)])).toMatchObject({ done: true, ms: 5, wrongNotes: 0 })
  })
})

describe('pickDrill', () => {
  it('gives the kind asked for, never the same item twice in a row', () => {
    for (const kind of ['note', 'chord', 'scale', 'chordInKey', 'build'] as const) {
      let last: string | null = null
      for (let i = 0; i < 200; i++) {
        const d = pickDrill(kind, last)
        expect(d.kind).toBe(kind)
        expect(d.item).not.toBe(last)
        last = d.item
      }
    }
  })

  it('times scale drills', () => {
    const d = pickDrill('scale', null)
    expect(d.kind === 'scale' && d.bpm).toBe(SCALE_BPM)
  })
})
