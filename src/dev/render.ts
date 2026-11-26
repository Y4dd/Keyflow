// Dev-only: renders a preset offline (Tone.Offline) through the same instrument and master
// chain the live engine uses, and measures the result. Loaded on demand by devtools.ts, so the
// Tone import (which creates the live AudioContext) doesn't run at page load.

import * as Tone from 'tone'
import { defaultKnobs, getPreset } from '../audio/presets/index.ts'
import type { KnobValues, PresetId } from '../audio/presets/types.ts'
import { createInstrument } from '../audio/tone/instrument.ts'
import { createMaster } from '../audio/tone/master.ts'
import { onsetTime, pitchHz, windowStats, type WindowStats } from './signal.ts'

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
  /** Bends, as the engine sends them: semitones from center, sliding over `ramp` s. */
  bends?: { at: number; semitones: number; ramp: number }[]
  duration: number
  /** Transport tempo, for tempo-synced LFOs (the Wobble sync knob). Tone's default is 120. */
  bpm?: number
  /** Restarts a tempo-synced LFO here, as a groove starting at this time does. */
  lfoRestartAt?: number
  /** Through the full master chain (default), the master without its limiter, or straight. */
  master?: boolean | 'noLimiter'
  /** [from, to] in seconds; one WindowStats each. */
  windows?: [number, number][]
  /** Set to estimate each window's pitch (pitchHz in ./signal.ts), searching this range. */
  pitchRange?: [minHz: number, maxHz: number]
  /**
   * Seconds into the render at which the notes are sent. Notes timed before it arrive late, as
   * live input can in Chromium, whose clock moves on during a task: Tone clamps their times.
   */
  sendAt?: number
}

export interface RenderResult {
  sampleRate: number
  peak: number
  /** First sample above -60 dBFS, s. */
  onset: number | null
  windows: WindowStats[]
  /** Hz per window, when pitchRange is set. */
  pitches: (number | null)[]
}

export async function renderPreset(spec: RenderSpec): Promise<RenderResult> {
  const preset = getPreset(spec.preset)
  const knobs = { ...defaultKnobs(preset), ...spec.knobs }
  const buffer = await Tone.Offline(
    (context) => {
      if (spec.bpm !== undefined) context.transport.bpm.value = spec.bpm
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
      const send = () => {
        for (const { time, on, n } of events) {
          if (on) instrument.noteOn(n.note, n.velocity, time)
          else instrument.noteOff(n.note, time)
        }
        for (const b of [...(spec.bends ?? [])].sort((x, y) => x.at - y.at)) {
          instrument.bend(b.semitones, b.at, b.ramp)
        }
      }
      if (spec.lfoRestartAt !== undefined) instrument.restartLfo(spec.lfoRestartAt)
      if (spec.sendAt === undefined) send()
      else context.setTimeout(send, spec.sendAt)
    },
    spec.duration,
    1,
  )
  const samples = buffer.getChannelData(0)
  const rate = buffer.sampleRate
  const range = spec.pitchRange
  return {
    sampleRate: rate,
    peak: windowStats(samples, rate, 0, spec.duration).peak,
    onset: onsetTime(samples, rate, 0.001),
    windows: (spec.windows ?? []).map(([from, to]) => windowStats(samples, rate, from, to)),
    pitches: range
      ? (spec.windows ?? []).map(([from, to]) => pitchHz(samples, rate, from, to, ...range))
      : [],
  }
}
