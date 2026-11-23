// The live audio engine. Loaded with a dynamic import on the first click or key press
// (src/state/audio.ts): importing Tone.js creates its AudioContext, so loading it later means
// no context exists before a user gesture. Tone's default context is the one context
// (latencyHint "interactive", the Tone default).
//
// Hot path: the input bus calls handle() synchronously; notes start at Tone.immediate().

import * as Tone from 'tone'
import type { InputEvent } from '../../input/types.ts'
import { readLatency, type LatencyReadout } from '../latency.ts'
import { getPreset } from '../presets/index.ts'
import type { KnobValues, PresetId } from '../presets/types.ts'
import { createInstrument, type Instrument } from './instrument.ts'
import { createMaster } from './master.ts'

export type ContextState = 'running' | 'suspended' | 'closed'

export interface EngineOptions {
  presetId: PresetId
  knobs: Record<PresetId, KnobValues>
  onStateChange(state: ContextState): void
}

export interface Engine {
  handle(event: InputEvent): void
  state(): ContextState
  resume(): Promise<void>
  setPreset(id: PresetId): void
  setKnob(presetId: PresetId, id: string, value: number): void
  releaseAll(): void
  latency(): LatencyReadout
  latencyHint(): string
  /** Dev tools: pitches held by the current instrument, and the context clock. */
  heldCount(): number
  currentTime(): number
}

function toState(s: string): ContextState {
  // "interrupted" (Safari) and anything else not running counts as suspended.
  return s === 'running' ? 'running' : s === 'closed' ? 'closed' : 'suspended'
}

export function createEngine(options: EngineOptions): Engine {
  const context = Tone.getContext()
  const knobs = { ...options.knobs } // knob values for instruments not built yet
  const master = createMaster()
  const instruments = new Map<PresetId, Instrument>()
  const instrumentFor = (id: PresetId) => {
    let instrument = instruments.get(id)
    if (!instrument) {
      instrument = createInstrument(getPreset(id), knobs[id], master.input)
      instruments.set(id, instrument)
    }
    return instrument
  }
  let current = instrumentFor(options.presetId)
  let state = toState(context.state)

  const resume = () => Tone.start().catch(() => {}) // retried on the next gesture

  const releaseAll = () => {
    const now = Tone.immediate()
    for (const instrument of instruments.values()) instrument.releaseAll(now)
  }

  context.on('statechange', () => {
    const next = toState(context.state)
    if (next === state) return
    state = next
    // Notes held across a suspension would play stale on resume.
    if (state !== 'running') releaseAll()
    options.onStateChange(state)
  })

  // Not awaited: without user activation (a touch still held down, Escape), resume() may never
  // settle. The statechange listener reports when it runs; later gestures call resume() again.
  void resume()

  return {
    handle(event) {
      switch (event.kind) {
        case 'noteOn':
          // While suspended, currentTime is frozen: the note would pile up and play on resume.
          if (state === 'running') current.noteOn(event.note, event.velocity, Tone.immediate())
          break
        case 'noteOff':
          current.noteOff(event.note, Tone.immediate())
          break
        // Pedal and bend modes arrive in P0-T7.
      }
    },
    state: () => state,
    resume,
    setPreset(id) {
      if (id === current.preset.id) return
      current.releaseAll(Tone.immediate())
      current = instrumentFor(id)
    },
    setKnob(presetId, id, value) {
      knobs[presetId] = { ...knobs[presetId], [id]: value }
      instruments.get(presetId)?.setKnob(id, value)
    },
    releaseAll,
    latency: () => readLatency(context.rawContext),
    latencyHint: () => String(context.latencyHint),
    heldCount: () => current.heldCount(),
    currentTime: () => Tone.immediate(),
  }
}
