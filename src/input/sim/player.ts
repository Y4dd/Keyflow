// Plays SimEvents onto the input bus on a clock. The clock is injected so tests run without
// real timers. Used by window.__keyflow (dev builds) and the dev inspector's replay.

import type { InputEvent } from '../types.ts'
import { toInputEvent, type SimEvent } from './script.ts'

export interface SimClock {
  now(): number
  setTimer(fn: () => void, ms: number): unknown
  clearTimer(handle: unknown): void
}

export interface SimPlayer {
  /**
   * Validates every event first (throws, emitting nothing, if any is invalid), then emits each
   * at its `at` offset from now. Events at 0 are emitted before play() returns. Each event's
   * `time` is the intended time (start + at), not when the timer happened to fire, so tests
   * and grading see exact timing. Resolves after the last event, or when stop() is called.
   */
  play(events: readonly SimEvent[]): Promise<void>
  /** Cancels everything pending and releases every note and the pedal the sim is holding. */
  stop(): void
  /** Notes the sim is holding, ascending. */
  heldNotes(): number[]
}

export function createSimPlayer(clock: SimClock, emit: (event: InputEvent) => void): SimPlayer {
  const held = new Set<number>()
  let pedalDown = false
  const finishers = new Set<() => void>()

  function send(event: InputEvent) {
    if (event.kind === 'noteOn') held.add(event.note)
    else if (event.kind === 'noteOff') held.delete(event.note)
    else if (event.kind === 'pedal') pedalDown = event.down
    emit(event)
  }

  return {
    play(events) {
      const start = clock.now()
      // Stable sort keeps the given order for events at the same offset.
      const timed = events
        .map((e, i) => ({ event: toInputEvent(e, start), at: e.at ?? 0, i }))
        .sort((a, b) => a.at - b.at || a.i - b.i)

      let index = 0
      while (index < timed.length && timed[index].at === 0) send(timed[index++].event)
      if (index === timed.length) return Promise.resolve()

      // One timer per distinct offset; each emits its whole group in order.
      return new Promise<void>((resolve) => {
        const pending = new Set<unknown>()
        const finish = () => {
          for (const handle of pending) {
            clock.clearTimer(handle)
          }
          pending.clear()
          finishers.delete(finish)
          resolve()
        }
        finishers.add(finish)
        while (index < timed.length) {
          const at = timed[index].at
          const group: InputEvent[] = []
          while (index < timed.length && timed[index].at === at) group.push(timed[index++].event)
          const last = index === timed.length
          const handle: unknown = clock.setTimer(() => {
            pending.delete(handle)
            for (const event of group) send(event)
            if (last) finish()
          }, at)
          pending.add(handle)
        }
      })
    },

    stop() {
      for (const finish of [...finishers]) finish()
      const time = clock.now()
      for (const note of [...held].sort((a, b) => a - b)) {
        send({ kind: 'noteOff', note, time, source: 'sim' })
      }
      if (pedalDown) send({ kind: 'pedal', down: false, time, source: 'sim' })
    },

    heldNotes: () => [...held].sort((a, b) => a - b),
  }
}
