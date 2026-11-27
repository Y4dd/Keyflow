import { describe, expect, it } from 'vitest'
import { Midi } from '@tonejs/midi'
import { createSimPlayer, type SimClock } from '../input/sim/player.ts'
import type { InputEvent } from '../input/types.ts'
import {
  createTakeRecorder,
  parseTake,
  TAKE_FORMAT,
  takeNotes,
  takeToMidi,
  tickAt,
  type Take,
} from './take.ts'

const ORIGIN = 123_456.789 // a performance-time origin with a fraction, as real ones have

const on = (note: number, time: number, velocity = 0.5): InputEvent => ({
  kind: 'noteOn',
  note,
  velocity,
  time,
  source: 'midi',
})
const off = (note: number, time: number): InputEvent => ({
  kind: 'noteOff',
  note,
  time,
  source: 'midi',
})

function take(events: Take['events'], extra: Partial<Take> = {}): Take {
  return {
    format: TAKE_FORMAT,
    createdAt: 1,
    grooveId: 'vamp',
    tonic: 2,
    bpm: 120,
    scale: 'minor pentatonic',
    countIn: true,
    lengthMs: 4000,
    events,
    offsetMs: null,
    offsetLeadMs: null,
    leadMs: null,
    ...extra,
  }
}

describe('createTakeRecorder', () => {
  it('times events from the origin, on a 0.001 ms grid', () => {
    const r = createTakeRecorder(ORIGIN)
    r.add(on(60, ORIGIN + 500.12345))
    r.add(off(60, ORIGIN + 750))
    expect(r.finish(ORIGIN + 1000)).toEqual({
      events: [
        { kind: 'noteOn', note: 60, velocity: 0.5, at: 500.123 },
        { kind: 'noteOff', note: 60, at: 750 },
      ],
      lengthMs: 1000,
    })
  })

  it('clamps early presses to 0 and drops note-offs of notes it never saw start', () => {
    const r = createTakeRecorder(ORIGIN)
    r.add(off(48, ORIGIN + 10)) // held from before Record
    r.add(on(60, ORIGIN - 30)) // pressed in the look-ahead before the transport started
    r.add(off(60, ORIGIN + 20))
    expect(r.finish(ORIGIN + 100).events).toEqual([
      { kind: 'noteOn', note: 60, velocity: 0.5, at: 0 },
      { kind: 'noteOff', note: 60, at: 20 },
    ])
  })

  it('records a key pressed twice before its release as one press and one release', () => {
    const r = createTakeRecorder(ORIGIN)
    r.add(on(60, ORIGIN + 1)) // the same key on two MIDI channels
    r.add(on(60, ORIGIN + 2))
    r.add(off(60, ORIGIN + 3))
    r.add(off(60, ORIGIN + 4))
    r.add(on(62, ORIGIN + 5))
    r.add(on(62, ORIGIN + 6))
    r.add(off(62, ORIGIN + 7)) // one press still down: closed once at the end
    expect(r.finish(ORIGIN + 9).events).toEqual([
      { kind: 'noteOn', note: 60, velocity: 0.5, at: 1 },
      { kind: 'noteOff', note: 60, at: 4 },
      { kind: 'noteOn', note: 62, velocity: 0.5, at: 5 },
      { kind: 'noteOff', note: 62, at: 9 },
    ])
  })

  it('closes held notes, the pedal and a bend at the end', () => {
    const r = createTakeRecorder(ORIGIN)
    r.add(on(60, ORIGIN + 1))
    r.add({ kind: 'pedal', down: true, time: ORIGIN + 2, source: 'midi' })
    r.add({ kind: 'bend', semitones: 1.5, time: ORIGIN + 3, source: 'computer' })
    const { events } = r.finish(ORIGIN + 9)
    expect(events.slice(3)).toEqual([
      { kind: 'noteOff', note: 60, at: 9 },
      { kind: 'pedal', down: false, at: 9 },
      { kind: 'bend', semitones: 0, at: 9 },
    ])
  })

  it('ignores events after finish', () => {
    const r = createTakeRecorder(ORIGIN)
    r.finish(ORIGIN + 1)
    r.add(on(60, ORIGIN + 2))
    expect(r.finish(ORIGIN + 3).events).toEqual([])
  })
})

describe('record → replay round trip through the simulated source', () => {
  // A clock with fractional, drifting readings, like performance.now().
  function fakeClock() {
    let now = 98_765.4321
    const timers: { at: number; fn: () => void }[] = []
    const clock: SimClock = {
      now: () => now,
      setTimer(fn, ms) {
        const t = { at: now + ms, fn }
        timers.push(t)
        return t
      },
      clearTimer(h) {
        timers.splice(timers.indexOf(h as (typeof timers)[number]), 1)
      },
    }
    const run = () => {
      while (timers.length) {
        timers.sort((a, b) => a.at - b.at)
        const t = timers.shift()!
        now = Math.max(now, t.at) + 0.37 // a timer fires a bit late
        t.fn()
      }
    }
    return { clock, run }
  }

  it('gives identical events', async () => {
    const first = createTakeRecorder(ORIGIN)
    const input: InputEvent[] = [
      on(62, ORIGIN + 0.5, 0.8),
      { kind: 'pedal', down: true, time: ORIGIN + 100.25, source: 'midi' },
      on(65, ORIGIN + 333.3333, 0.41),
      { kind: 'bend', semitones: 2, time: ORIGIN + 400.1, source: 'computer' },
      off(62, ORIGIN + 500.0001),
      { kind: 'bend', semitones: 0, time: ORIGIN + 610, source: 'computer' },
      { kind: 'pedal', down: false, time: ORIGIN + 700, source: 'midi' },
      off(65, ORIGIN + 812.5),
    ]
    for (const e of input) first.add(e)
    const recorded = first.finish(ORIGIN + 1000)

    // Replay starts at its own origin, in the future like a transport start; record it again.
    const { clock, run } = fakeClock()
    const origin2 = clock.now() + 104.123
    const second = createTakeRecorder(origin2)
    const player = createSimPlayer(clock, second.add)
    const done = player.play(recorded.events, origin2)
    run()
    await done
    expect(second.finish(origin2 + recorded.lengthMs)).toEqual(recorded)
  })
})

describe('parseTake', () => {
  it('keeps a valid take', () => {
    const t = take([{ kind: 'noteOn', note: 60, velocity: 0.5, at: 0 }])
    expect(parseTake(t)).toEqual(t)
    const { offsetLeadMs: _, ...first } = t // recorded before the field existed
    expect(parseTake(first)).toEqual(t)
  })

  it('rejects a take it cannot read and drops events it cannot', () => {
    expect(parseTake(null)).toBeNull()
    expect(parseTake({ ...take([]), format: 2 })).toBeNull()
    expect(parseTake({ ...take([]), bpm: 'fast' })).toBeNull()
    expect(parseTake({ ...take([]), scale: 'lydian' })).toBeNull()
    const events = [
      { kind: 'noteOn', note: 60, velocity: 0.5, at: 0 },
      { kind: 'noteOn', note: 200, velocity: 0.5, at: 1 },
      { kind: 'noteOn', note: 61, velocity: 0, at: 1 },
      { kind: 'noteOff', note: 60, at: -1 },
      { kind: 'pedal', down: 'yes', at: 2 },
      { kind: 'bend', semitones: 1, at: 3 },
      { kind: 'cc', at: 4 },
    ]
    expect(parseTake({ ...take([]), events })?.events).toEqual([
      { kind: 'noteOn', note: 60, velocity: 0.5, at: 0 },
      { kind: 'bend', semitones: 1, at: 3 },
    ])
  })
})

describe('takeNotes', () => {
  it('pairs presses and releases, closing a re-press and what is left at the end', () => {
    const t = take([
      { kind: 'noteOn', note: 60, velocity: 0.5, at: 0 },
      { kind: 'noteOn', note: 64, velocity: 0.9, at: 100 },
      { kind: 'noteOff', note: 60, at: 200 },
      { kind: 'noteOn', note: 64, velocity: 0.3, at: 300 },
      { kind: 'noteOn', note: 67, velocity: 1, at: 3500 },
    ])
    expect(takeNotes(t)).toEqual([
      { note: 60, velocity: 0.5, start: 0, end: 200 },
      { note: 64, velocity: 0.9, start: 100, end: 300 },
      { note: 64, velocity: 0.3, start: 300, end: 4000 },
      { note: 67, velocity: 1, start: 3500, end: 4000 },
    ])
  })
})

describe('tickAt', () => {
  it('is groove ticks: transport ticks less the count-in bar', () => {
    // 120 BPM: a beat is 500 ms, 192 ticks; the count-in bar is 2000 ms.
    expect(tickAt(take([]), 2000)).toBe(0)
    expect(tickAt(take([]), 2500)).toBe(192)
    expect(tickAt(take([], { countIn: false }), 2500)).toBe(960)
    expect(tickAt(take([]), 0)).toBe(-768)
  })
})

describe('takeToMidi', () => {
  it('writes the notes at the take tempo, on the transport timeline', () => {
    const t = take([
      { kind: 'noteOn', note: 60, velocity: 0.5, at: 1000 }, // a pickup in the count-in
      { kind: 'noteOff', note: 60, at: 1500 },
      { kind: 'noteOn', note: 67, velocity: 1, at: 2000 },
    ])
    const midi = new Midi(takeToMidi(t))
    expect(midi.header.tempos[0]?.bpm).toBeCloseTo(120)
    const notes = midi.tracks[0]!.notes
    expect(notes.map((n) => [n.midi, n.ticks, n.durationTicks])).toEqual([
      [60, midi.header.ppq * 2, midi.header.ppq],
      [67, midi.header.ppq * 4, midi.header.ppq * 4],
    ])
    expect(notes[0]!.velocity).toBeCloseTo(0.5, 1)
  })
})
