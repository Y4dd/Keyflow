import { describe, expect, it } from 'vitest'
import type { SimClock } from '../sim/player.ts'
import type { InputEvent } from '../types.ts'
import { createLaptopBend, SPRING_BACK_MS, WHEEL_PX_PER_SEMITONE } from './bend.ts'

function setup(range = 2) {
  const events: InputEvent[] = []
  let now = 0
  let pending: { fn: () => void; at: number } | null = null
  const clock: SimClock = {
    now: () => now,
    setTimer: (fn, ms) => (pending = { fn, at: now + ms }),
    clearTimer: () => (pending = null),
  }
  const advance = (ms: number) => {
    now += ms
    if (pending && pending.at <= now) {
      const { fn } = pending
      pending = null
      fn()
    }
  }
  const bend = createLaptopBend(
    (e) => events.push(e),
    clock,
    () => range,
  )
  const semis = () => events.map((e) => (e.kind === 'bend' ? e.semitones : NaN))
  return { bend, events, semis, advance }
}

describe('laptop bend: the bend key', () => {
  it('bends up by the bend amount while held, and back on release', () => {
    const { bend, semis, events } = setup(2)
    expect(bend.keyDown('Space', 5)).toBe(true)
    expect(bend.keyDown('Space', 6)).toBe(true) // auto-repeat: claimed, nothing sent
    expect(bend.keyUp('Space', 7)).toBe(true)
    expect(semis()).toEqual([2, 0])
    expect(events[0]).toEqual({ kind: 'bend', semitones: 2, time: 5, source: 'computer' })
  })

  it('ignores other keys, and a key-up it never saw go down', () => {
    const { bend, events } = setup()
    expect(bend.keyDown('KeyA', 0)).toBe(false)
    expect(bend.keyUp('Space', 0)).toBe(false)
    expect(events).toEqual([])
  })

  it('can be changed or turned off; changing it while held releases the bend', () => {
    const { bend, semis } = setup()
    bend.keyDown('Space', 0)
    bend.setKey('Backslash', 1)
    expect(semis()).toEqual([2, 0])
    expect(bend.keyDown('Space', 2)).toBe(false)
    expect(bend.keyDown('Backslash', 3)).toBe(true)
    bend.keyUp('Backslash', 4)
    bend.setKey(null, 5)
    expect(bend.getKey()).toBeNull()
    expect(bend.keyDown('Backslash', 6)).toBe(false)
  })
})

describe('laptop bend: the wheel', () => {
  it('scrolling up bends up, down bends down, within the bend amount', () => {
    const { bend, semis } = setup(2)
    bend.wheel(-WHEEL_PX_PER_SEMITONE / 2, 0)
    bend.wheel(-WHEEL_PX_PER_SEMITONE, 1)
    bend.wheel(-WHEEL_PX_PER_SEMITONE * 5, 2)
    bend.wheel(WHEEL_PX_PER_SEMITONE, 3)
    expect(semis()).toEqual([0.5, 1.5, 2, 1])
  })

  it('springs back to center once scrolling stops', () => {
    const { bend, semis, advance } = setup(2)
    bend.wheel(-WHEEL_PX_PER_SEMITONE, 0)
    advance(SPRING_BACK_MS - 1)
    bend.wheel(-WHEEL_PX_PER_SEMITONE / 2, 1) // still scrolling: the timer restarts
    advance(SPRING_BACK_MS - 1)
    expect(semis()).toEqual([1, 1.5])
    advance(1)
    expect(semis()).toEqual([1, 1.5, 0])
  })

  it('adds to the key bend, clamped to the bend amount', () => {
    const { bend, semis, advance } = setup(2)
    bend.keyDown('Space', 0)
    bend.wheel(WHEEL_PX_PER_SEMITONE, 1) // 2 - 1
    bend.wheel(-WHEEL_PX_PER_SEMITONE * 3, 2) // 2 + 2, clamped
    advance(SPRING_BACK_MS)
    expect(semis()).toEqual([2, 1, 2])
    bend.keyUp('Space', 3)
    expect(semis()).toEqual([2, 1, 2, 0])
  })

  it('releaseAll returns everything to center', () => {
    const { bend, semis, advance } = setup(2)
    bend.keyDown('Space', 0)
    bend.wheel(WHEEL_PX_PER_SEMITONE, 1)
    bend.releaseAll(2)
    advance(SPRING_BACK_MS)
    expect(semis()).toEqual([2, 1, 0])
    // The key-up that follows a release finds nothing to do.
    expect(bend.keyUp('Space', 3)).toBe(false)
  })
})
