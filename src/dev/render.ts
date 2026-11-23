// Dev-only: renders a preset offline (Tone.Offline) through the same instrument and master
// chain the live engine uses, and measures the result. Loaded on demand by devtools.ts, so the
// Tone import (which creates the live AudioContext) doesn't run at page load.

import * as Tone from 'tone'
import { defaultKnobs, getPreset } from '../audio/presets/index.ts'
import type { KnobValues, PresetId } from '../audio/presets/types.ts'
import { createInstrument } from '../audio/tone/instrument.ts'
import { createMaster } from '../audio/tone/master.ts'
import { onsetTime, windowStats, type WindowStats } from './signal.ts'

export interface RenderNote {
  note: number
  velocity: number
  /** Seconds from the start of the render. */
  on: number
  off: number
}

export interface RenderSpec {
  preset: PresetId
  knobs?: KnobValues
  notes: RenderNote[]
  duration: number
  /** Through the full master chain (default), the master without its limiter, or straight. */
  master?: boolean | 'noLimiter'
  /** [from, to] in seconds; one WindowStats each. */
  windows?: [number, number][]
}

export interface RenderResult {
  sampleRate: number
  peak: number
  /** First sample above -60 dBFS, s. */
  onset: number | null
  windows: WindowStats[]
}

export async function renderPreset(spec: RenderSpec): Promise<RenderResult> {
  const preset = getPreset(spec.preset)
  const knobs = { ...defaultKnobs(preset), ...spec.knobs }
  const buffer = await Tone.Offline(
    () => {
      const master =
        spec.master === false ? null : createMaster({ limiter: spec.master !== 'noLimiter' })
      const instrument = createInstrument(
        preset,
        knobs,
        master ? master.input : Tone.getDestination(),
      )
      // In time order, as live input arrives: the voice logic decides from the order of calls.
      // At equal times, note-offs go first.
      const events = spec.notes.flatMap((n) => [
        { time: n.on, on: true, n },
        { time: n.off, on: false, n },
      ])
      events.sort((a, b) => a.time - b.time || Number(a.on) - Number(b.on))
      for (const { time, on, n } of events) {
        if (on) instrument.noteOn(n.note, n.velocity, time)
        else instrument.noteOff(n.note, time)
      }
    },
    spec.duration,
    1,
  )
  const samples = buffer.getChannelData(0)
  const rate = buffer.sampleRate
  return {
    sampleRate: rate,
    peak: windowStats(samples, rate, 0, spec.duration).peak,
    onset: onsetTime(samples, rate, 0.001),
    windows: (spec.windows ?? []).map(([from, to]) => windowStats(samples, rate, from, to)),
  }
}
