// The live audio engine. Loaded with a dynamic import on the first click or key press
// (src/state/audio.ts): importing Tone.js creates its AudioContext, so loading it later means
// no context exists before a user gesture. Tone's default context is the one context
// (latencyHint "interactive", the Tone default).
//
// Hot path: the input bus calls handle() synchronously; notes start at Tone.immediate(). The
// zone router (src/audio/zones.ts) picks the zone and pitch from the engine's own copy of the
// layout, never the store.
//
// The pedal and bends (src/audio/expression.ts): sustain holds both sounds; bends and
// glide-hold move only the main sound, the hand playing the lead (decisions log, P0-T7).

import * as Tone from 'tone'
import type { InputEvent } from '../../input/types.ts'
import {
  bendRampSeconds,
  createExpression,
  type ExpressionSettings,
  type ExpressionTargets,
} from '../expression.ts'
import { dbToGain } from '../curves.ts'
import { readClock, readLatency, type ClockPair, type LatencyReadout } from '../latency.ts'
import { getPreset, PRESETS } from '../presets/index.ts'
import type { KnobValues, PresetId } from '../presets/types.ts'
import { createZoneRouter, ZONE_IDS, type KeyboardLayout, type ZoneId } from '../zones.ts'
import { createGroovePlayer, type GroovePlayer } from './groove.ts'
import { createInstrument, type Instrument } from './instrument.ts'
import { createMaster } from './master.ts'

export type ContextState = 'running' | 'suspended' | 'closed'

export interface EngineOptions {
  layout: KeyboardLayout
  knobs: Record<PresetId, KnobValues>
  expression: ExpressionSettings
  onStateChange(state: ContextState): void
}

export interface Engine {
  handle(event: InputEvent): void
  state(): ContextState
  resume(): Promise<void>
  setLayout(layout: KeyboardLayout): void
  setKnob(presetId: PresetId, id: string, value: number): void
  setExpression(settings: ExpressionSettings): void
  /** Dev tools: what the pedal and bends are doing now. */
  expression(): ExpressionTargets
  releaseAll(): void
  latency(): LatencyReadout
  latencyHint(): string
  /** The audio clock against performance time (src/audio/latency.ts, readClock). */
  clock(): ClockPair
  /**
   * Schedules metronome clicks at audio-clock times (s), the first of every `accentEvery`
   * higher. Returns a function that stops and removes them.
   */
  playClicks(times: readonly number[], accentEvery: number): () => void
  /** Dev tools: pitches a zone's instruments hold (including presets switched away from). */
  heldCount(zone: ZoneId): number
  currentTime(): number
  /** The groove player (src/audio/tone/groove.ts), built with its instruments on first use. */
  groove(): GroovePlayer
  /** The transport tempo, which a synced wobble follows even with no groove playing. */
  setTempo(bpm: number): void
}

// shortcut: one fixed level for the whole groove until the mixer (P1-T6).
export const GROOVE_LEVEL_DB = -3

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
  const expression = createExpression(options.expression)
  let applied = expression.targets()

  /** Sends what changed to the instruments. */
  function apply(next: ExpressionTargets) {
    const now = Tone.immediate()
    if (next.sustain !== applied.sustain) {
      for (const zone of ZONE_IDS) current[zone].setSustain(next.sustain, now)
    }
    if (next.glideHold !== applied.glideHold) current.main.setGlideHold(next.glideHold)
    if (next.bend !== applied.bend) {
      // shortcut: measured from the last target, not where a cut-short ramp got to, so a quick
      // tap returns over the full distance's time; upgrade if short taps feel sluggish.
      const ramp = bendRampSeconds(applied.bend, next.bend, expression.settings())
      current.main.bend(next.bend, now, ramp)
    }
    applied = next
  }

  /** An instrument becoming a zone's sound takes up the pedal and bend state as it is. */
  function adopt(zone: ZoneId, instrument: Instrument) {
    const now = Tone.immediate()
    instrument.setSustain(applied.sustain, now)
    instrument.setGlideHold(zone === 'main' && applied.glideHold)
    instrument.bend(zone === 'main' ? applied.bend : 0, now, 0)
  }

  // The groove's own instruments, apart from the zones: the pedal and bends never reach them.
  // They're in `instruments`, so knob changes (your bass and EP Keys sound) and releaseAll reach
  // them too.
  let groovePlayer: GroovePlayer | null = null
  const grooveBus = new Tone.Gain(dbToGain(GROOVE_LEVEL_DB)).connect(master.input)
  const grooveInstrument = (id: PresetId) => {
    let instrument = instruments.get(`groove:${id}`)
    if (!instrument) {
      instrument = createInstrument(getPreset(id), knobs[id], grooveBus)
      instruments.set(`groove:${id}`, instrument)
    }
    return instrument
  }
  // shortcut: for the P1-T3b audition the groove's bass follows the left sound whenever that is a
  // bass, so one sleeve click changes both; it goes once the user has picked a bass.
  const isBass = (id: PresetId) => id !== 'funk-lead' && id !== 'ep-keys'
  let grooveBass: PresetId = isBass(layout.left.presetId) ? layout.left.presetId : 'wobble-bass'
  function groove() {
    if (groovePlayer) return groovePlayer
    // Every bass up front, so a Play lines up a synced wobble picked later in the groove too.
    for (const p of PRESETS) if (isBass(p.id)) grooveInstrument(p.id)
    groovePlayer = createGroovePlayer({
      bass: grooveInstrument(grooveBass),
      chords: grooveInstrument('ep-keys'),
      destination: grooveBus,
      onStart(time) {
        for (const instrument of instruments.values()) instrument.restartLfo(time)
      },
    })
    return groovePlayer
  }

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
    // Notes held across a suspension would play stale on resume; so would the groove.
    if (state !== 'running') {
      groovePlayer?.stop()
      releaseAll()
    }
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
        case 'pedal':
          apply(expression.pedal(event.down))
          break
        case 'bend':
          apply(expression.bend(event.source, event.semitones))
          break
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
        adopt(zone, current[zone])
      }
      // A new split point or octave applies to the next note-on; held notes keep their routes.
      layout = next
      const left = next.left.presetId
      if (isBass(left) && left !== grooveBass) {
        grooveBass = left
        groovePlayer?.setBass(grooveInstrument(left))
      }
    },
    setKnob(presetId, id, value) {
      knobs[presetId] = { ...knobs[presetId], [id]: value }
      for (const instrument of instruments.values())
        if (instrument.preset.id === presetId) instrument.setKnob(id, value)
    },
    setExpression: (settings) => apply(expression.setSettings(settings)),
    expression: () => applied,
    releaseAll,
    latency: () => readLatency(context.rawContext),
    latencyHint: () => String(context.latencyHint),
    clock: () => readClock(context.rawContext, performance.now(), Tone.immediate()),
    playClicks(times, accentEvery) {
      // Through the master like every sound, so the offset includes its 6 ms.
      const click = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
        volume: -10,
      }).connect(master.input)
      times.forEach((t, i) => click.triggerAttackRelease(i % accentEvery ? 880 : 1760, 0.03, t))
      return () => click.dispose()
    },
    heldCount(zone) {
      let n = 0
      for (const [key, instrument] of instruments)
        if (key.startsWith(`${zone}:`)) n += instrument.heldCount()
      return n
    },
    currentTime: () => Tone.immediate(),
    groove,
    setTempo(bpm) {
      Tone.getTransport().bpm.value = bpm
    },
  }
}
