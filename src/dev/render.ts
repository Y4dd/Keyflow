// Dev-only: renders a preset offline (Tone.Offline) through the same instrument and master
// chain the live engine uses, and measures the result. Loaded on demand by devtools.ts, so the
// Tone import (which creates the live AudioContext) doesn't run at page load.

import * as Tone from 'tone'
import { defaultKnobs, getPreset } from '../audio/presets/index.ts'
import type { KnobValues, PresetId } from '../audio/presets/types.ts'
import { channelGains, DEFAULT_MIXER, type MixerSettings } from '../audio/mixer.ts'
import { createMixBuses } from '../audio/tone/mixer.ts'
import { createGroovePlayer, GROOVE_BASS } from '../audio/tone/groove.ts'
import { createInstrument } from '../audio/tone/instrument.ts'
import { BEATS_PER_BAR } from '../grooves/groove.ts'
import { GROOVES } from '../grooves/library.ts'
import { createMaster } from '../audio/tone/master.ts'
import { dropouts, onsetTime, pitchHz, windowStats, type WindowStats } from './signal.ts'

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
  /** Pitch classes the bends count steps of ("to next scale tone"); semitones when unset. */
  bendScale?: number[]
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
      // In time order, as live input arrives: the voice logic decides from the order of calls,
      // and a scale bend from the note sounding. At equal times: note-offs, bends, note-ons.
      const events = [
        ...spec.notes.flatMap((n) => [
          { time: n.on, rank: 2, send: () => instrument.noteOn(n.note, n.velocity, n.on) },
          { time: n.off, rank: 0, send: () => instrument.noteOff(n.note, n.off) },
        ]),
        ...(spec.bends ?? []).map((b) => ({
          time: b.at,
          rank: 1,
          send: () => instrument.bend(b.semitones, b.at, b.ramp),
        })),
      ]
      events.sort((x, y) => x.time - y.time || x.rank - y.rank)
      const send = () => {
        for (const e of events) e.send()
      }
      if (spec.lfoRestartAt !== undefined) instrument.restartLfo(spec.lfoRestartAt)
      if (spec.bendScale) instrument.setBendScale(spec.bendScale, 0, 0)
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

export interface GrooveRenderSpec {
  /** A groove id from src/grooves/library.ts, at its own key and tempo. */
  groove: string
  /** One window per bar, in order. */
  bars: number
  /** The mixer, with the split on (so "you play bass" applies); all channels flat when unset. */
  mixer?: MixerSettings
  /** Starts with the count-in bar (window 0) when true. */
  countIn?: boolean
}

/** Renders a groove offline through the engine's mixer buses and master; peak per bar, and its dropouts. */
export async function renderGroove(
  spec: GrooveRenderSpec,
): Promise<{ peak: number; bars: number[]; dropouts: number }> {
  const groove = GROOVES.find((g) => g.id === spec.groove)
  if (!groove) throw new Error(`Unknown groove ${spec.groove}`)
  const bar = (BEATS_PER_BAR * 60) / groove.tempo
  const buffer = await Tone.Offline(
    () => {
      const master = createMaster()
      const buses = createMixBuses(master.input, channelGains(spec.mixer ?? DEFAULT_MIXER, true))
      const build = (id: PresetId, bus: Tone.Gain) =>
        createInstrument(getPreset(id), defaultKnobs(getPreset(id)), bus)
      createGroovePlayer({
        bass: build(GROOVE_BASS, buses.channels.bass),
        chords: build('ep-keys', buses.channels.chords),
        destination: buses.channels.drums,
        click: buses.groove,
        onStart() {},
      }).play(
        {
          groove,
          tonic: groove.key.tonic,
          bpm: groove.tempo,
          loop: true,
          countIn: spec.countIn ?? false,
        },
        () => {},
      )
    },
    spec.bars * bar + 0.2,
    1,
  )
  const samples = buffer.getChannelData(0)
  const rate = buffer.sampleRate
  const bars = Array.from(
    { length: spec.bars },
    (_, i) => windowStats(samples, rate, i * bar, (i + 1) * bar).peak,
  )
  return { peak: Math.max(...bars), bars, dropouts: dropouts(samples, rate) }
}
