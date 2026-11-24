// The audio controller and the Zustand store the UI reads. It doesn't import Tone.js: the
// engine (src/audio/tone/engine.ts) loads on the first click or key press, because browsers
// only let audio start after a user gesture, and importing Tone creates its AudioContext.
// MIDI notes aren't gestures, so a keyboard alone can't start audio; the UI says so.
//
// The store changes on status, layout and knob changes, never per note (except the one note
// that sets the split point).

import { create } from 'zustand'
import type { LatencyReadout } from '../audio/latency.ts'
import { defaultKnobs, getPreset, PRESETS } from '../audio/presets/index.ts'
import type { KnobValues, PresetId } from '../audio/presets/types.ts'
import type { ContextState, Engine } from '../audio/tone/engine.ts'
import {
  clampOctave,
  clampSplitNote,
  DEFAULT_LAYOUT,
  type KeyboardLayout,
  type ZoneId,
} from '../audio/zones.ts'
import type { InputEvent } from '../input/types.ts'

export type AudioStatus = 'off' | 'starting' | 'running' | 'suspended' | 'failed' | 'unsupported'

export interface AudioState {
  status: AudioStatus
  error: string | null
  layout: KeyboardLayout
  /** Waiting for a key press to set the split point. */
  learningSplit: boolean
  knobs: Record<PresetId, KnobValues>
  /** A note arrived while audio was off: tell the user to click. */
  notesWaiting: boolean
  latency: LatencyReadout | null
  latencyHint: string | null
}

const hasWebAudio = () =>
  typeof window !== 'undefined' &&
  (typeof window.AudioContext === 'function' ||
    typeof (window as { webkitAudioContext?: unknown }).webkitAudioContext === 'function')

export const useAudioStore = create<AudioState>(() => ({
  status: hasWebAudio() ? 'off' : 'unsupported',
  error: null,
  layout: DEFAULT_LAYOUT,
  learningSplit: false,
  knobs: Object.fromEntries(PRESETS.map((p) => [p.id, defaultKnobs(p)])) as Record<
    PresetId,
    KnobValues
  >,
  notesWaiting: false,
  latency: null,
  latencyHint: null,
}))

let engine: Engine | null = null
let loading: Promise<void> | null = null
// Notes pressed while audio is starting (e.g. the on-screen key whose click started it). Still
// held when sound first runs, they play then.
const pendingNotes = new Map<number, number>()
// Mirrors learningSplit for the hot path. The key that sets the split doesn't sound, and
// neither does its note-off.
let learningSplit = false
const swallowed = new Set<number>()

const set = useAudioStore.setState
const get = useAudioStore.getState

// outputLatency can read differently a moment after the device opens; read it again then.
const LATENCY_REREAD_MS = 1000

function onContextState(state: ContextState) {
  if (state === 'running') {
    set({ status: 'running', notesWaiting: false })
    playPending()
    refreshLatency()
    setTimeout(refreshLatency, LATENCY_REREAD_MS)
  } else if (state === 'suspended') {
    // Before the first resume succeeds this is still "starting", not a pause.
    if (get().status !== 'starting') set({ status: 'suspended' })
  } else set({ status: 'failed', error: 'The browser closed the audio output.' })
}

function playPending() {
  if (!engine) return
  const time = performance.now()
  for (const [note, velocity] of pendingNotes) {
    engine.handle({ kind: 'noteOn', note, velocity, time, source: 'onscreen' })
  }
  pendingNotes.clear()
}

function refreshLatency() {
  if (engine) set({ latency: engine.latency(), latencyHint: engine.latencyHint() })
}

function noteWaiting() {
  if (!get().notesWaiting) set({ notesWaiting: true })
}

export const audio = {
  /**
   * Starts audio, or resumes it if the browser hasn't let it run yet or paused it. Call from a
   * user gesture; safe to call repeatedly. The returned promise may never settle when the call
   * didn't come with user activation, so callers don't wait on it.
   */
  start(): Promise<void> {
    const { status } = get()
    if (status === 'unsupported') return Promise.resolve()
    if (engine) return engine.state() === 'running' ? Promise.resolve() : engine.resume()
    if (loading) return loading
    set({ status: 'starting', error: null })
    loading = import('../audio/tone/engine.ts')
      .then(({ createEngine }) => {
        const { layout, knobs } = get()
        engine = createEngine({ layout, knobs, onStateChange: onContextState })
        loading = null
        onContextState(engine.state())
      })
      .catch((err: unknown) => {
        loading = null
        pendingNotes.clear()
        set({ status: 'failed', error: err instanceof Error ? err.message : String(err) })
      })
    return loading
  },

  /** Input bus listener (hot path). */
  handle(event: InputEvent) {
    if (learningSplit && event.kind === 'noteOn') {
      learningSplit = false
      swallowed.add(event.note)
      set({ learningSplit: false })
      setLayout({ ...get().layout, splitNote: clampSplitNote(event.note) })
      return
    }
    if (event.kind === 'noteOff' && swallowed.delete(event.note)) return
    if (engine) {
      engine.handle(event) // drops note-ons itself while the context isn't running
      if (engine.state() === 'running') return
    }
    if (get().status === 'starting') {
      if (event.kind === 'noteOn') pendingNotes.set(event.note, event.velocity)
      else if (event.kind === 'noteOff') pendingNotes.delete(event.note)
    } else if (event.kind === 'noteOn') noteWaiting()
  },

  setSplit(on: boolean) {
    setLayout({ ...get().layout, split: on })
    if (!on) audio.learnSplit(false)
  },

  setSplitNote(note: number) {
    setLayout({ ...get().layout, splitNote: clampSplitNote(note) })
  },

  /** The next key pressed sets the split point (it becomes the main sound's lowest key). */
  learnSplit(on: boolean) {
    learningSplit = on
    set({ learningSplit: on })
  },

  setZonePreset(zone: ZoneId, id: PresetId) {
    getPreset(id) // throws on an unknown id
    const { layout } = get()
    setLayout({ ...layout, [zone]: { ...layout[zone], presetId: id } })
  },

  setZoneOctave(zone: ZoneId, octave: number) {
    const { layout } = get()
    setLayout({ ...layout, [zone]: { ...layout[zone], octave: clampOctave(octave) } })
  },

  setKnob(presetId: PresetId, id: string, value: number) {
    const { knobs } = get()
    set({ knobs: { ...knobs, [presetId]: { ...knobs[presetId], [id]: value } } })
    engine?.setKnob(presetId, id, value)
  },

  refreshLatency,

  /** Dev tools only. */
  engine: () => engine,
}

function setLayout(layout: KeyboardLayout) {
  set({ layout })
  engine?.setLayout(layout)
}

/**
 * Starts audio on any click, tap or key press until it runs, and resumes it the same way if
 * the browser pauses it later. Capture phase, so it runs before the piano's own handlers.
 */
export function attachAudioUnlock(target: Window): () => void {
  const unlock = () => {
    const { status } = get()
    if (status === 'off' || status === 'starting' || status === 'suspended') void audio.start()
  }
  target.addEventListener('pointerdown', unlock, true)
  target.addEventListener('keydown', unlock, true)
  return () => {
    target.removeEventListener('pointerdown', unlock, true)
    target.removeEventListener('keydown', unlock, true)
  }
}
