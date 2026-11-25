// Laptop bend, a substitute for the pitch bend wheel the YPT-380 doesn't have: hold the bend
// key to bend up by the bend amount, or scroll (mouse wheel or touchpad) over the on-screen
// keys for a continuous bend that springs back to center. Emits `bend` events onto the bus;
// the engine slews them at the bend speed (src/audio/expression.ts). The controller is fed key
// codes and wheel deltas, so it's unit-tested; the attach functions wire it to the DOM.

import type { SimClock } from '../sim/player.ts'
import type { InputEvent } from '../types.ts'

/** KeyboardEvent.code values offered for the bend key, with labels. */
export const BEND_KEYS = [
  { code: 'Space', label: 'Space' },
  { code: 'Backslash', label: '\\' },
] as const

export const DEFAULT_BEND_KEY = 'Space'
/** Scrolling this far bends one semitone (a mouse wheel notch is often about 100 px). */
export const WHEEL_PX_PER_SEMITONE = 100
/** The wheel bend springs back once scrolling has stopped for this long. */
export const SPRING_BACK_MS = 150

export interface LaptopBend {
  /** Returns true if the key is the bend key (the caller should preventDefault). */
  keyDown(code: string, time: number): boolean
  keyUp(code: string, time: number): boolean
  /** Vertical scroll in px: negative (scrolling up) bends up. */
  wheel(deltaPx: number, time: number): void
  releaseAll(time: number): void
  /** The bend key's code, or null when off. */
  getKey(): string | null
  setKey(code: string | null, time: number): void
  /** Notified when the bend key changes. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void
}

export function createLaptopBend(
  emit: (event: InputEvent) => void,
  clock: SimClock,
  /** The bend amount, semitones. */
  range: () => number,
): LaptopBend {
  let key: string | null = DEFAULT_BEND_KEY
  let keyHeld = false
  let wheel = 0
  let sent = 0
  let timer: unknown = null
  let listeners: readonly (() => void)[] = []

  const clamp = (v: number) => Math.min(range(), Math.max(-range(), v))

  function send(time: number) {
    const semitones = clamp((keyHeld ? range() : 0) + wheel)
    if (semitones === sent) return
    sent = semitones
    emit({ kind: 'bend', semitones, time, source: 'computer' })
  }

  function stopTimer() {
    if (timer !== null) clock.clearTimer(timer)
    timer = null
  }

  return {
    keyDown(code, time) {
      if (code !== key) return false
      if (!keyHeld) {
        keyHeld = true
        send(time)
      }
      return true
    },

    keyUp(code, time) {
      if (code !== key || !keyHeld) return false
      keyHeld = false
      send(time)
      return true
    },

    wheel(deltaPx, time) {
      wheel = clamp(wheel - deltaPx / WHEEL_PX_PER_SEMITONE)
      send(time)
      stopTimer()
      timer = clock.setTimer(() => {
        timer = null
        wheel = 0
        send(clock.now())
      }, SPRING_BACK_MS)
    },

    releaseAll(time) {
      stopTimer()
      keyHeld = false
      wheel = 0
      send(time)
    },

    getKey: () => key,

    setKey(code, time) {
      if (code === key) return
      key = code
      keyHeld = false
      send(time)
      for (const l of listeners) l()
    },

    subscribe(listener) {
      listeners = [...listeners, listener]
      return () => {
        listeners = listeners.filter((l) => l !== listener)
      }
    },
  }
}

// shortcut: one "line" or "page" of scroll is taken as 16 or 800 px, not the real line height
// or page size; upgrade if a browser that scrolls in lines makes the wheel bend too slow or fast.
const DELTA_PX = [1, 16, 800]

/** Wheel bend over one element (the on-screen keys). Returns a detach function. */
export function attachWheelBend(bend: LaptopBend, element: HTMLElement): () => void {
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey) return // pinch and Ctrl+wheel zoom the page
    e.preventDefault() // the page doesn't scroll while bending
    bend.wheel(e.deltaY * (DELTA_PX[e.deltaMode] ?? 1), e.timeStamp)
  }
  // Not passive, so preventDefault works.
  element.addEventListener('wheel', onWheel, { passive: false })
  return () => element.removeEventListener('wheel', onWheel)
}
