import { describe, expect, it } from 'vitest'
import type { PedalMode } from '../audio/expression.ts'
import type { InputEvent } from '../input/types.ts'
import { pc } from '../music/harmony.ts'
import { noteNames } from '../music/spelling.ts'
import {
  checkChord,
  checkScale,
  createHeldNotes,
  detectChord,
  nameHeld,
  type PlayedNote,
} from './recognize.ts'

// Chord shapes as semitones above the root, in tone order (root, third, fifth, seventh).
const QUALITIES: Record<string, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  '7': [0, 4, 7, 10],
  m7b5: [0, 3, 6, 10],
}

/** The chord's notes in an inversion, ascending from `low` (the bass is the inversion's tone). */
function voice(root: number, shape: number[], inversion: number, low = 48): number[] {
  const tones = shape.map((s) => root + s)
  const notes = tones.map((n, i) => (i < inversion ? n + 12 : n))
  // Lift so the bass (the lowest) lands at or above `low`, keeping the shape.
  const lift = Math.ceil((low - Math.min(...notes)) / 12) * 12
  return notes.map((n) => n + lift).sort((a, b) => a - b)
}

const cases = Object.entries(QUALITIES).flatMap(([quality, shape]) =>
  Array.from({ length: 12 }, (_, root) =>
    shape.map((_, inversion) => ({ quality, shape, root, inversion })),
  ).flat(),
)

describe('checkChord, every quality in all 12 keys and every inversion', () => {
  it.each(cases)('$quality root $root inversion $inversion', ({ shape, root, inversion }) => {
    const tones = shape.map((s) => pc(root + s))
    const held = voice(root, shape, inversion)
    expect(checkChord(held, tones)).toEqual({ ok: true, missing: [], extra: [], bassOk: true })
    // strict inversion: right only for this inversion's bass
    for (let want = 0; want < shape.length; want++) {
      expect(checkChord(held, tones, { kind: 'inversion', inversion: want }).ok).toBe(
        want === inversion,
      )
    }
    // strict register: exactly these notes, not the same notes an octave up
    expect(checkChord(held, tones, { kind: 'register', notes: held }).ok).toBe(true)
    expect(
      checkChord(
        held.map((n) => n + 12),
        tones,
        { kind: 'register', notes: held },
      ).ok,
    ).toBe(false)
  })

  it('accepts doubled and spread notes in any order', () => {
    const e = [4, 7, 11]
    expect(checkChord([40, 52, 59, 67, 71, 76], e).ok).toBe(true)
    expect(checkChord([76, 43, 59], e).ok).toBe(true)
  })

  it('reports a missing note', () => {
    expect(checkChord([52, 59], [4, 7, 11])).toEqual({
      ok: false,
      missing: [7],
      extra: [],
      bassOk: true,
    })
  })

  it('reports an extra note, even when the chord is all there', () => {
    expect(checkChord([52, 55, 59, 61], [4, 7, 11])).toEqual({
      ok: false,
      missing: [],
      extra: [1],
      bassOk: true,
    })
  })

  it('reports a missing and an extra note together', () => {
    const c = checkChord([52, 56, 59], [4, 7, 11])
    expect(c).toMatchObject({ ok: false, missing: [7], extra: [8] })
  })

  it('is not ok for nothing held, and says the whole chord is missing', () => {
    expect(checkChord([], [4, 7, 11])).toMatchObject({ ok: false, missing: [4, 7, 11] })
    expect(checkChord([], [4, 7, 11], { kind: 'inversion', inversion: 0 }).ok).toBe(false)
  })

  it('flags a wrong bass apart from wrong notes in inversion mode', () => {
    const c = checkChord([55, 59, 64], [4, 7, 11], { kind: 'inversion', inversion: 0 })
    expect(c).toEqual({ ok: false, missing: [], extra: [], bassOk: false })
  })

  it('register mode fails when nothing is held', () => {
    expect(checkChord([], [4, 7, 11], { kind: 'register', notes: [] }).ok).toBe(false)
  })

  it('register mode fails on a doubled octave', () => {
    expect(
      checkChord([52, 55, 59, 64], [4, 7, 11], { kind: 'register', notes: [52, 55, 59] }).ok,
    ).toBe(false)
  })
})

describe('detectChord', () => {
  it('names a G6 for G B D E, root position, then the slash chord', () => {
    expect(detectChord([55, 59, 62, 64])[0]).toBe('G6')
    expect(detectChord([55, 59, 62, 64])).toContain('Em7/G')
  })

  it.each([
    [[60, 64, 67], 'CM'],
    [[64, 67, 71], 'Em'],
    [[62, 66, 69, 72], 'D7'],
    [[67, 71, 74], 'GM'],
    [[59, 62, 66], 'Bm'],
  ])('names %j as %s', (held, name) => {
    expect(detectChord(held)[0]).toBe(name)
  })

  it('uses the key spelling when given names', () => {
    const flats = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']
    expect(detectChord([58, 62, 65], flats)[0]).toBe('BbM')
    expect(detectChord([58, 62, 65])[0]).toBe('A#M')
  })

  it('is empty for fewer than two pitch classes and for no match', () => {
    expect(detectChord([])).toEqual([])
    expect(detectChord([60, 72])).toEqual([])
  })
})

describe('held notes', () => {
  const ev = {
    on: (note: number): InputEvent => ({
      kind: 'noteOn',
      note,
      velocity: 0.7,
      time: 0,
      source: 'sim',
    }),
    off: (note: number): InputEvent => ({ kind: 'noteOff', note, time: 0, source: 'sim' }),
    pedal: (down: boolean): InputEvent => ({ kind: 'pedal', down, time: 0, source: 'sim' }),
  }
  const make = (mode: PedalMode = 'sustain') => {
    let m = mode
    const held = createHeldNotes(() => m)
    return { held, setMode: (x: PedalMode) => (m = x) }
  }

  it('holds keys while down, sorted', () => {
    const { held } = make()
    ;[67, 60, 64].forEach((n) => held.apply(ev.on(n)))
    expect(held.notes()).toEqual([60, 64, 67])
    held.apply(ev.off(64))
    expect(held.notes()).toEqual([60, 67])
  })

  it('counts released notes while the pedal is down in Sustain mode', () => {
    const { held } = make()
    held.apply(ev.on(60))
    held.apply(ev.pedal(true))
    held.apply(ev.off(60))
    held.apply(ev.on(64))
    expect(held.notes()).toEqual([60, 64])
    held.apply(ev.pedal(false))
    expect(held.notes()).toEqual([64])
  })

  it('does not count the pedal in Bend or Glide-hold mode, and follows a mode change', () => {
    const { held, setMode } = make('bend')
    held.apply(ev.pedal(true))
    held.apply(ev.on(60))
    held.apply(ev.off(60))
    expect(held.notes()).toEqual([])
    setMode('sustain')
    expect(held.notes()).toEqual([60])
    setMode('glideHold')
    expect(held.notes()).toEqual([])
  })

  it('does not hold a note released before the pedal went down', () => {
    const { held } = make()
    held.apply(ev.on(60))
    held.apply(ev.off(60))
    held.apply(ev.pedal(true))
    expect(held.notes()).toEqual([])
  })

  it('a stray note-off under the pedal holds nothing', () => {
    const { held } = make()
    held.apply(ev.pedal(true))
    held.apply(ev.off(61))
    expect(held.notes()).toEqual([])
  })

  it('a re-pressed sustained note is one note, and reset clears everything', () => {
    const { held } = make()
    held.apply(ev.pedal(true))
    held.apply(ev.on(60))
    held.apply(ev.off(60))
    held.apply(ev.on(60))
    expect(held.notes()).toEqual([60])
    held.reset()
    expect(held.notes()).toEqual([])
    held.apply(ev.off(61))
    expect(held.notes()).toEqual([])
  })
})

describe('checkScale', () => {
  // A minor pentatonic up one octave from A3 (57).
  const target = [57, 60, 62, 64, 67, 69]
  const run = (notes: number[], gap = 500, start = 0): PlayedNote[] =>
    notes.map((note, i) => ({ note, time: start + i * gap }))

  it('is partial while right and unfinished, done at the last note', () => {
    expect(checkScale(run(target.slice(0, 3)), target)).toMatchObject({
      status: 'partial',
      matched: 3,
      ok: false,
    })
    expect(checkScale(run(target), target)).toMatchObject({ status: 'done', matched: 6, ok: true })
  })

  it('names the first wrong note and what was expected', () => {
    expect(checkScale(run([57, 60, 63]), target)).toMatchObject({
      status: 'wrong',
      matched: 2,
      expected: 62,
      ok: false,
    })
  })

  it('wrong order and skipped notes fail', () => {
    expect(checkScale(run([57, 62, 60, 64, 67, 69]), target).status).toBe('wrong')
    expect(checkScale(run([57, 60, 64, 67, 69]), target).status).toBe('wrong')
  })

  it('any register: the same shape from another octave is right', () => {
    expect(checkScale(run(target.map((n) => n + 12)), target).ok).toBe(true)
    expect(checkScale(run(target.map((n) => n - 24)), target).ok).toBe(true)
  })

  it('any register: the first note must be the root, and the shape must hold', () => {
    expect(checkScale(run([58, 61, 63, 65, 68, 70]), target)).toMatchObject({
      status: 'wrong',
      matched: 0,
      expected: 9,
    })
    expect(checkScale(run([57, 60, 62, 64, 67, 81]), target).status).toBe('wrong')
  })

  it('exact register: only the target notes', () => {
    expect(checkScale(run(target), target, { register: 'exact' }).ok).toBe(true)
    expect(checkScale(run(target.map((n) => n + 12)), target, { register: 'exact' })).toMatchObject(
      {
        status: 'wrong',
        matched: 0,
        expected: 57,
      },
    )
  })

  it('ignores notes after the target is complete', () => {
    expect(checkScale(run([...target, 72]), target).status).toBe('done')
  })

  it('nothing played yet is partial with zero matched', () => {
    expect(checkScale([], target)).toMatchObject({ status: 'partial', matched: 0, timing: null })
  })

  describe('with a tempo', () => {
    // 70 BPM quarters: 857 ms apart.
    const gap = 60000 / 70
    it('is ok in time, and reports the measured tempo', () => {
      const c = checkScale(run(target, gap), target, { bpm: 70 })
      expect(c.ok).toBe(true)
      expect(c.timing).toEqual({ bpm: 70, inTime: true })
    })

    it('is done but not ok when too slow or too fast', () => {
      const slow = checkScale(run(target, gap * 1.6), target, { bpm: 70 })
      expect(slow).toMatchObject({ status: 'done', ok: false })
      expect(slow.timing).toEqual({ bpm: 44, inTime: false })
      const fast = checkScale(run(target, gap / 2), target, { bpm: 70 })
      expect(fast).toMatchObject({ status: 'done', ok: false })
      expect(fast.timing?.bpm).toBe(140)
    })

    it('tolerates small wobble, not one badly late note', () => {
      const wobble = run(target, gap).map((p, i) => ({ ...p, time: p.time + (i % 2) * 120 }))
      expect(checkScale(wobble, target, { bpm: 70 }).ok).toBe(true)
      const late = run(target, gap)
      late[4] = { ...late[4]!, time: late[4]!.time + gap * 0.6 }
      expect(checkScale(late, target, { bpm: 70 }).timing?.inTime).toBe(false)
    })

    it('counts beats per note: eighths at 70 BPM', () => {
      const c = checkScale(run(target, gap / 2), target, { bpm: 70, noteBeats: 0.5 })
      expect(c.timing).toEqual({ bpm: 70, inTime: true })
      expect(c.ok).toBe(true)
    })

    it('notes sharing a timestamp give a finite tempo', () => {
      const c = checkScale(run(target, 0), target, { bpm: 70 })
      expect(Number.isFinite(c.timing?.bpm)).toBe(true)
      expect(c.ok).toBe(false)
    })

    it('has no timing yet for fewer than two right notes, and a done run then fails', () => {
      expect(checkScale(run([57]), target, { bpm: 70 }).timing).toBeNull()
      expect(checkScale(run([57]), [57], { bpm: 70 })).toMatchObject({ status: 'done', ok: false })
    })
  })
})

describe('nameHeld', () => {
  const G = { tonic: 7, mode: 'major' as const }
  const names = noteNames(G, 'major pentatonic')
  const cases: [string, number[], string, string | null][] = [
    ['nothing', [], '', null],
    ['one note', [64], 'E', null],
    ['one note in two octaves', [64, 76], 'E', null],
    ['an interval, lowest up', [64, 67], 'minor 3rd', null],
    ['an interval past the octave', [60, 76], 'major 3rd', null],
    ['a major triad as its root', [67, 71, 74], 'G', 'I'],
    ['a first inversion as a slash chord', [71, 74, 79], 'G/B', 'I'],
    ['a minor triad', [64, 67, 71], 'Em', 'vi'],
    ['a minor inversion', [55, 64, 71], 'Em/G', 'vi'],
    ['a 7th', [62, 66, 69, 72], 'D7', 'V'],
    ['a diminished triad', [66, 69, 72], 'F♯dim', 'vii°'],
    ['a cluster names nothing', [60, 62, 64], '', null],
  ]
  it.each(cases)('%s', (_, held, name, numeral) => {
    expect(nameHeld(held, names, G)).toEqual({ name, numeral })
  })

  it('spells by key and gives no numeral without one', () => {
    const flats = noteNames({ tonic: 3, mode: 'major' }, 'major pentatonic')
    expect(nameHeld([63, 67, 70], flats, null)).toEqual({ name: 'E♭', numeral: null })
    expect(nameHeld([70, 75, 79], flats, { tonic: 3, mode: 'major' })).toEqual({
      name: 'E♭/B♭',
      numeral: 'I',
    })
  })
})
