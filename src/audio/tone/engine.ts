// The live audio engine. Loaded with a dynamic import on the first click or key press
// (src/state/audio.ts): importing Tone.js creates its AudioContext, so loading it later means
// no context exists before a user gesture. Tone's default context is the one context
// (latencyHint "interactive", the Tone default).
//
// Hot path: the input bus calls handle() synchronously; notes start at Tone.immediate(). The
// zone router (src/audio/zones.ts) picks the zone and pitch from the engine's own copy of the
// layout, never the store.

import * as Tone from 'tone'
import type { InputEvent } from '../../input/types.ts'
import { readLatency, type LatencyReadout } from '../latency.ts'
import { getPreset } from '../presets/index.ts'
import type { KnobValues, PresetId } from '../presets/types.ts'
import { createZoneRouter, ZONE_IDS, type KeyboardLayout, type ZoneId } from '../zones.ts'
import { createInstrument, type Instrument } from './instrument.ts'
import { createMaster } from './master.ts'

export type ContextState = 'running' | 'suspended' | 'closed'

export interface EngineOptions {
  layout: KeyboardLayout
  knobs: Record<PresetId, KnobValues>
  onStateChange(state: ContextState): void
}

export interface Engine {
  handle(event: InputEvent): void
  state(): ContextState
  resume(): Promise<void>
  setLayout(layout: KeyboardLayout): void
  setKnob(presetId: PresetId, id: string, value: number): void
  releaseAll(): void
  latency(): LatencyReadout
  latencyHint(): string
  /** Dev tools: pitches a zone's instruments hold (including presets switched away from). */
  heldCount(zone: ZoneId): number
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
  // One instance per zone and preset, so both zones can play the same preset without sharing
  // voices. Kept once built, so switching back doesn't rebuild. Built on layout changes, never
  // on a note.
  const instruments = new Map<string, Instrument>()
  const instrumentFor = (zone: ZoneId, id: PresetId) => {
    const key = `${zone}:${id}`
    let instrument = instruments.get(key)
    if (!instrument) {
      instrument = createInstrument(getPreset(id), knobs[id], master.input)
      instruments.set(key, instrument)
    }
    return instrument
  }
  let layout = options.layout
  // Both zones are built up front, so turning the split on doesn't build anything.
  const current: Record<ZoneId, Instrument> = {
    main: instrumentFor('main', layout.main.presetId),
    left: instrumentFor('left', layout.left.presetId),
  }
  const router = createZoneRouter()
  let state = toState(context.state)

  const resume = () => Tone.start().catch(() => {}) // retried on the next gesture

  const releaseAll = () => {
    const now = Tone.immediate()
    for (const instrument of instruments.values()) instrument.releaseAll(now)
    router.releaseAll()
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
        case 'noteOn': {
          // While suspended, currentTime is frozen: the note would pile up and play on resume.
          // A dropped note-on leaves no route, so its note-off is ignored too.
          if (state !== 'running') break
          const route = router.noteOn(event.note, layout)
          if (route) current[route.zone].noteOn(route.note, event.velocity, Tone.immediate())
          break
        }
        case 'noteOff': {
          // Follows the route of its note-on, whatever the layout is now.
          const route = router.noteOff(event.note)
          if (route) current[route.zone].noteOff(route.note, Tone.immediate())
          break
        }
        // Pedal and bend modes arrive in P0-T7.
      }
    },
    state: () => state,
    resume,
    setLayout(next) {
      for (const zone of ZONE_IDS) {
        const id = next[zone].presetId
        if (id === current[zone].preset.id) continue
        current[zone].releaseAll(Tone.immediate())
        router.releaseZone(zone)
        current[zone] = instrumentFor(zone, id)
      }
      // A new split point or octave applies to the next note-on; held notes keep their routes.
      layout = next
    },
    setKnob(presetId, id, value) {
      knobs[presetId] = { ...knobs[presetId], [id]: value }
      for (const instrument of instruments.values())
        if (instrument.preset.id === presetId) instrument.setKnob(id, value)
    },
    releaseAll,
    latency: () => readLatency(context.rawContext),
    latencyHint: () => String(context.latencyHint),
    heldCount(zone) {
      let n = 0
      for (const [key, instrument] of instruments)
        if (key.startsWith(`${zone}:`)) n += instrument.heldCount()
      return n
    },
    currentTime: () => Tone.immediate(),
  }
}
