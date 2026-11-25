// Computer keyboard as a piano: a fallback when no MIDI keyboard is connected. The controller
// is pure (fed key codes and times) so it's unit-tested; attach() wires it to the DOM.

import type { InputEvent } from '../types.ts'
import type { LaptopBend } from './bend.ts'

/** Fixed: a computer key has no velocity. */
export const COMPUTER_VELOCITY = 0.8

/**
 * KeyboardEvent.code -> semitones above the current octave's C. Codes name physical keys, so
 * the layout is the same shape on QWERTY, AZERTY and others: the home row holds the white keys,
 * the row above holds the black keys between them.
 */
export const KEY_OFFSETS: Readonly<Record<string, number>> = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
  KeyO: 13,
  KeyL: 14,
  KeyP: 15,
  Semicolon: 16,
  Quote: 17,
}

export const OCTAVE_DOWN = 'KeyZ'
export const OCTAVE_UP = 'KeyX'
export const DEFAULT_BASE_NOTE = 60 // C4
export const MIN_BASE_NOTE = 24 // C1
export const MAX_BASE_NOTE = 96 // C7; the top key (+17) stays within MIDI's 0..127

export interface ComputerKeyboard {
  /** Returns true if the key belongs to the piano (the caller should preventDefault). */
  keyDown(code: string, time: number): boolean
  keyUp(code: string, time: number): boolean
  /** Releases every note, e.g. when the window loses focus and keyups would be missed. */
  releaseAll(time: number): void
  /** MIDI note of the home row's first key (A). */
  getBaseNote(): number
  /** Notified when the octave changes. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void
}

export function createComputerKeyboard(
  emit: (event: InputEvent) => void,
  baseNote = DEFAULT_BASE_NOTE,
): ComputerKeyboard {
  let base = baseNote
  const down = new Map<string, number>() // key code -> the note it started
  const octaveDown = new Set<string>() // so a held Z or X shifts once, not on every auto-repeat
  // Per-note count of keys holding it: after an octave shift, two keys can map to one pitch.
  const count = new Uint8Array(128)
  let listeners: readonly (() => void)[] = []

  function shift(by: number) {
    const next = Math.min(MAX_BASE_NOTE, Math.max(MIN_BASE_NOTE, base + by))
    if (next === base) return
    base = next
    for (const l of listeners) l()
  }

  function release(note: number, time: number) {
    count[note]--
    if (count[note] === 0) emit({ kind: 'noteOff', note, time, source: 'computer' })
  }

  return {
    keyDown(code, time) {
      if (code === OCTAVE_DOWN || code === OCTAVE_UP) {
        if (octaveDown.has(code)) return true // auto-repeat
        octaveDown.add(code)
        // Held notes keep their pitch; their keyups release what they started.
        shift(code === OCTAVE_UP ? 12 : -12)
        return true
      }
      const offset = KEY_OFFSETS[code]
      if (offset === undefined) return false
      if (down.has(code)) return true // auto-repeat
      const note = base + offset
      down.set(code, note)
      count[note]++
      if (count[note] === 1) {
        emit({ kind: 'noteOn', note, velocity: COMPUTER_VELOCITY, time, source: 'computer' })
      }
      return true
    },

    keyUp(code, time) {
      if (code === OCTAVE_DOWN || code === OCTAVE_UP) {
        octaveDown.delete(code)
        return true
      }
      const note = down.get(code)
      if (note === undefined) return false
      down.delete(code)
      release(note, time)
      return true
    },

    releaseAll(time) {
      for (const note of [...down.values()].sort((a, b) => a - b)) release(note, time)
      down.clear()
      octaveDown.clear()
    },

    getBaseNote: () => base,

    subscribe(listener) {
      listeners = [...listeners, listener]
      return () => {
        listeners = listeners.filter((l) => l !== listener)
      }
    },
  }
}

// Inputs that take letters. Radios, checkboxes, sliders and buttons don't, so after clicking a
// preset or a knob the computer keys keep playing.
const NON_TEXT_INPUTS = new Set([
  'radio',
  'checkbox',
  'range',
  'button',
  'submit',
  'reset',
  'color',
])

export function isTextEntry(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === 'INPUT') return !NON_TEXT_INPUTS.has((target as HTMLInputElement).type)
  return tag === 'TEXTAREA' || tag === 'SELECT'
}

/** Listens on the window. Returns a detach function. */
export function attachComputerKeyboard(
  keyboard: ComputerKeyboard,
  target: Window,
  bend?: LaptopBend,
): () => void {
  // How the focused control got its focus. Reached with Tab, it keeps its own keys, Space
  // included, so keyboard users can still toggle a checkbox; focused by a click, the bend key
  // bends instead of pressing it. (:focus-visible can't tell them apart: in e2e, Chromium and
  // Firefox both matched it on a clicked control once a key was pressed.)
  let pointing = false // the last input was a pointer, not a key
  let focusedByPointer = false
  const onPointerDown = () => {
    pointing = true
  }
  const onFocusIn = () => {
    focusedByPointer = pointing
  }
  const ownsKeys = (el: EventTarget | null) =>
    el !== target.document.body && el !== target.document && !focusedByPointer

  const onKeyDown = (e: KeyboardEvent) => {
    pointing = false // before Tab moves focus
    // Leave shortcuts (Ctrl+S, ...) and typing in form fields alone.
    if (e.ctrlKey || e.metaKey || e.altKey || isTextEntry(e.target)) return
    // Only Space means something to a control; another bend key bends even on a Tab-focused one.
    const controlKey = e.code === 'Space' && ownsKeys(e.target)
    if (bend && !controlKey && bend.keyDown(e.code, e.timeStamp)) {
      e.preventDefault() // Space would scroll the page or press the clicked button
      return
    }
    if (keyboard.keyDown(e.code, e.timeStamp)) e.preventDefault()
  }
  const onKeyUp = (e: KeyboardEvent) => {
    // No modifier check: a key pressed before Ctrl went down must still be released.
    if (bend?.keyUp(e.code, e.timeStamp)) {
      e.preventDefault() // a button or checkbox activates on Space's key-up
      return
    }
    if (keyboard.keyUp(e.code, e.timeStamp)) e.preventDefault()
  }
  const releaseAll = () => {
    const now = performance.now()
    keyboard.releaseAll(now)
    bend?.releaseAll(now)
  }
  const onVisibility = () => {
    if (target.document.visibilityState === 'hidden') releaseAll()
  }
  target.addEventListener('pointerdown', onPointerDown, true)
  target.addEventListener('focusin', onFocusIn, true)
  target.addEventListener('keydown', onKeyDown)
  target.addEventListener('keyup', onKeyUp)
  target.addEventListener('blur', releaseAll)
  target.document.addEventListener('visibilitychange', onVisibility)
  return () => {
    target.removeEventListener('pointerdown', onPointerDown, true)
    target.removeEventListener('focusin', onFocusIn, true)
    target.removeEventListener('keydown', onKeyDown)
    target.removeEventListener('keyup', onKeyUp)
    target.removeEventListener('blur', releaseAll)
    target.document.removeEventListener('visibilitychange', onVisibility)
  }
}
