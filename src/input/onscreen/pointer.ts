// On-screen piano input: pointers (mouse, pen, each touch) pressing and sliding across keys.
// Pure: the component tells it which note is under each pointer; it emits InputEvents.

import type { InputEvent } from '../types.ts'

export const ONSCREEN_VELOCITY = 0.8

export interface PointerPiano {
  down(pointerId: number, note: number, time: number): void
  /** The note now under a pressed pointer, or null when it's off the keys. Others are ignored. */
  move(pointerId: number, note: number | null, time: number): void
  up(pointerId: number, time: number): void
  releaseAll(time: number): void
}

export function createPointerPiano(emit: (event: InputEvent) => void): PointerPiano {
  const pointers = new Map<number, number | null>() // pressed pointer -> note it holds
  const count = new Uint8Array(128) // two fingers can hold the same key

  function press(note: number, time: number) {
    count[note]++
    if (count[note] === 1) {
      emit({ kind: 'noteOn', note, velocity: ONSCREEN_VELOCITY, time, source: 'onscreen' })
    }
  }
  function release(note: number | null | undefined, time: number) {
    if (note === null || note === undefined) return
    count[note]--
    if (count[note] === 0) emit({ kind: 'noteOff', note, time, source: 'onscreen' })
  }

  return {
    down(id, note, time) {
      release(pointers.get(id), time)
      pointers.set(id, note)
      press(note, time)
    },
    move(id, note, time) {
      if (!pointers.has(id)) return
      const current = pointers.get(id)
      if (current === note) return
      // Sliding onto another key releases the old one first (a glissando).
      release(current, time)
      pointers.set(id, note)
      if (note !== null) press(note, time)
    },
    up(id, time) {
      if (!pointers.has(id)) return
      release(pointers.get(id), time)
      pointers.delete(id)
    },
    releaseAll(time) {
      for (const id of [...pointers.keys()]) {
        release(pointers.get(id), time)
        pointers.delete(id)
      }
    },
  }
}
