import { describe, expect, it } from 'vitest'
import type { InputEvent } from '../types.ts'
import { createSimPlayer, type SimClock } from './player.ts'
import { chord } from './script.ts'

function setup() {
  let now = 1000
  const timers = new Map<number, { fn: () => void; due: number }>()
  let nextId = 1
  const clock: SimClock = {
    now: () => now,
    setTimer(fn, ms) {
      const id = nextId++
      timers.set(id, { fn, due: now + ms })
      return id
    },
    clearTimer(handle) {
      timers.delete(handle as number)
    },
  }
  const events: InputEvent[] = []
  const player = createSimPlayer(clock, (e) => events.push(e))
  /** Moves time forward, firing due timers in order. */
  const advance = (ms: number) => {
    const until = now + ms
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.due <= until)
      if (due.length === 0) break
      due.sort((a, b) => a[1].due - b[1].due)
      const [id, t] = due[0]
      timers.delete(id)
      now = t.due
      t.fn()
    }
    now = until
  }
  return { player, events, advance, timers }
}

describe('createSimPlayer', () => {
  it('emits events at offset 0 before play() returns, as source sim', () => {
    const t = setup()
    void t.player.play(chord([60, 64, 67]))
    expect(t.events.map((e) => e.kind === 'noteOn' && e.note)).toEqual([60, 64, 67])
    expect(t.events.every((e) => e.source === 'sim' && e.time === 1000)).toBe(true)
    expect(t.player.heldNotes()).toEqual([60, 64, 67])
  })

  it('emits later events on timers, stamped with their intended time', async () => {
    const t = setup()
    const done = t.player.play(chord([60, 64], { holdMs: 500 }))
    expect(t.events).toHaveLength(2)
    t.advance(499)
    expect(t.events).toHaveLength(2)
    t.advance(1)
    expect(t.events.slice(2)).toEqual([
      { kind: 'noteOff', note: 60, time: 1500, source: 'sim' },
      { kind: 'noteOff', note: 64, time: 1500, source: 'sim' },
    ])
    await expect(done).resolves.toBeUndefined()
    expect(t.player.heldNotes()).toEqual([])
  })

  it('keeps the given order for events at the same offset and sorts by offset', () => {
    const t = setup()
    void t.player.play([
      { kind: 'noteOff', note: 60, at: 200 },
      { kind: 'noteOn', note: 60, at: 100 },
      { kind: 'pedal', down: true, at: 100 },
    ])
    t.advance(300)
    expect(t.events.map((e) => e.kind)).toEqual(['noteOn', 'pedal', 'noteOff'])
  })

  it('throws and emits nothing when any event is invalid', () => {
    const t = setup()
    expect(() =>
      t.player.play([
        { kind: 'noteOn', note: 60 },
        { kind: 'noteOn', note: 200, at: 10 },
      ]),
    ).toThrow(/note/)
    expect(t.events).toEqual([])
    expect(t.timers.size).toBe(0)
  })

  it('stop() cancels pending events, releases held notes and the pedal, and resolves', async () => {
    const t = setup()
    const done = t.player.play([
      ...chord([62, 60], { holdMs: 1000 }),
      { kind: 'pedal', down: true },
      { kind: 'noteOn', note: 72, at: 500 },
    ])
    t.advance(100)
    t.player.stop()
    expect(t.events.slice(3)).toEqual([
      { kind: 'noteOff', note: 60, time: 1100, source: 'sim' },
      { kind: 'noteOff', note: 62, time: 1100, source: 'sim' },
      { kind: 'pedal', down: false, time: 1100, source: 'sim' },
    ])
    await expect(done).resolves.toBeUndefined()
    t.advance(2000)
    expect(t.events).toHaveLength(6) // nothing fires after stop
    expect(t.timers.size).toBe(0)
  })

  it('resolves immediately when everything is at offset 0', async () => {
    const t = setup()
    await expect(t.player.play([{ kind: 'pedal', down: false }])).resolves.toBeUndefined()
  })
})
