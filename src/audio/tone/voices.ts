// Tone.js voice graphs, one per preset kind. Built in whatever context is current (the live
// one, or Tone.Offline's for renders), and driven only with explicit times: Param.value and
// rampTo() without a time go through Tone.now(), which adds the look-ahead (CLAUDE.md).

import * as Tone from 'tone'
import { dbToGain, fmIndex } from '../curves.ts'
import type { FmPreset, KnobValues, LeadPreset, WobblePreset } from '../presets/types.ts'

export interface MonoVoice {
  readonly output: Tone.ToneAudioNode
  /** Glide time for legato moves, s. */
  glide(): number
  /** Moves the pitch at `time`, sliding over `glide` seconds when it's > 0. */
  setPitch(hz: number, time: number, glide: number): void
  attack(time: number, gain: number): void
  release(time: number): void
  setKnob(id: string, value: number): void
  dispose(): void
}

export interface PolyVoice {
  start(hz: number, velocity: number, gain: number, time: number): void
  stop(time: number): void
  setKnob(id: string, value: number): void
  dispose(): void
}

function pitchSignal() {
  const freq = new Tone.Signal({ value: 220, units: 'frequency' })
  return {
    freq,
    set(hz: number, time: number, glide: number) {
      freq.cancelAndHoldAtTime(time)
      if (glide > 0) freq.exponentialRampToValueAtTime(hz, time + glide)
      else freq.setValueAtTime(hz, time)
    },
  }
}

/** Funk Lead: saw + square → 24 dB low-pass with its own envelope → amp envelope. */
export function createLeadVoice(p: LeadPreset, knobs: KnobValues): MonoVoice {
  const pitch = pitchSignal()
  // The oscillators run continuously; the envelopes gate them. No restart, so no phase clicks.
  const saw = new Tone.Oscillator({ type: 'sawtooth' })
  const square = new Tone.Oscillator({ type: 'square', detune: p.square.detuneCents })
  pitch.freq.connect(saw.frequency)
  pitch.freq.connect(square.frequency)
  const sawLevel = new Tone.Gain(p.saw.level)
  const squareLevel = new Tone.Gain(p.square.level)
  const filter = new Tone.Filter({ type: 'lowpass', rolloff: -24, Q: p.filter.q })
  // Connecting an envelope to filter.frequency overrides the param, so the cutoff knob sets
  // the envelope's base frequency instead.
  const filterEnv = new Tone.FrequencyEnvelope({
    ...p.filter.env,
    baseFrequency: knobs.cutoff,
    octaves: p.filter.envOctaves,
  })
  filterEnv.connect(filter.frequency)
  const amp = new Tone.AmplitudeEnvelope(p.amp)
  saw.chain(sawLevel, filter)
  square.chain(squareLevel, filter)
  filter.connect(amp)
  const t = Tone.immediate()
  saw.start(t)
  square.start(t)
  let glide = knobs.glide

  return {
    output: amp,
    glide: () => glide,
    setPitch: pitch.set,
    attack(time, gain) {
      filterEnv.triggerAttack(time)
      amp.triggerAttack(time, gain)
    },
    release(time) {
      filterEnv.triggerRelease(time)
      amp.triggerRelease(time)
    },
    setKnob(id, value) {
      if (id === 'cutoff') filterEnv.baseFrequency = value
      else if (id === 'glide') glide = value
    },
    dispose() {
      for (const node of [pitch.freq, saw, square, sawLevel, squareLevel, filter, filterEnv, amp]) {
        node.dispose()
      }
    },
  }
}

/**
 * Wobble Bass: two detuned saws → LFO low-pass → distortion (4× oversampled) → amp gate →
 * compressor, * plus a sine sub an octave down on its own clean path that rejoins after the compressor, so
 * neither the distortion nor the compressor's gain changes touch it.
 */
export function createWobbleVoice(p: WobblePreset, knobs: KnobValues): MonoVoice {
  const pitch = pitchSignal()
  const sawA = new Tone.Oscillator({ type: 'sawtooth', detune: -p.saws.detuneCents })
  const sawB = new Tone.Oscillator({ type: 'sawtooth', detune: p.saws.detuneCents })
  pitch.freq.connect(sawA.frequency)
  pitch.freq.connect(sawB.frequency)
  const octaveDown = new Tone.Multiply(0.5)
  const sub = new Tone.Oscillator({ type: 'sine' })
  pitch.freq.connect(octaveDown)
  octaveDown.connect(sub.frequency)

  const sawLevel = new Tone.Gain(p.saws.level)
  const filter = new Tone.Filter({ type: 'lowpass', rolloff: -24, Q: p.filter.q })
  // Free-running in Phase 0; tempo-synced once Phase 1 adds a transport. It overrides
  // filter.frequency, so the cutoff knob sets the sweep's top.
  const lfo = new Tone.LFO({
    type: 'sine',
    frequency: knobs.lfoRate,
    min: knobs.cutoff / p.filter.sweepRatio,
    max: knobs.cutoff,
  })
  lfo.connect(filter.frequency)
  const drive = new Tone.Distortion({ distortion: knobs.drive, oversample: '4x' })
  const comp = new Tone.Compressor({
    threshold: p.compressor.thresholdDb,
    ratio: p.compressor.ratio,
    attack: p.compressor.attack,
    release: p.compressor.release,
  })
  const subLevel = new Tone.Gain(p.sub.level)
  // One envelope drives both paths' gains (connecting it overrides their gain params). The saw
  // gate comes before the compressor: a DynamicsCompressor delays its output by about 6 ms
  // (P0-T5 Findings), so a gate after it opened on the previous note's pitch for 6 ms.
  const env = new Tone.Envelope(p.amp)
  const sawAmp = new Tone.Gain(0)
  const subAmp = new Tone.Gain(0)
  env.connect(sawAmp.gain)
  env.connect(subAmp.gain)
  const output = new Tone.Gain(1)

  sawA.connect(sawLevel)
  sawB.connect(sawLevel)
  sawLevel.chain(filter, drive, sawAmp, comp, output)
  sub.chain(subLevel, subAmp, output)
  const t = Tone.immediate()
  for (const osc of [sawA, sawB, sub]) osc.start(t)
  lfo.start(t)

  return {
    output,
    glide: () => p.glide,
    setPitch: pitch.set,
    attack: (time, gain) => env.triggerAttack(time, gain),
    release: (time) => env.triggerRelease(time),
    setKnob(id, value) {
      if (id === 'cutoff') {
        lfo.min = value / p.filter.sweepRatio
        lfo.max = value
      } else if (id === 'lfoRate') lfo.frequency.setValueAtTime(value, Tone.immediate())
      else if (id === 'drive') drive.distortion = value
    },
    dispose() {
      for (const node of [
        pitch.freq,
        sawA,
        sawB,
        octaveDown,
        sub,
        sawLevel,
        filter,
        lfo,
        drive,
        comp,
        subLevel,
        env,
        sawAmp,
        subAmp,
        output,
      ]) {
        node.dispose()
      }
    },
  }
}

// Tone's FMSynth plays its carrier and its modulator at -10 dB each (volume: -10 in
// ModulationSynth.js). Dividing by it makes fmIndex() the real peak index and keeps the
// preset's levelDb comparable with the other presets.
const FM_INTERNAL_GAIN = dbToGain(-10)

/** EP Keys: one two-operator FM voice. Velocity sets loudness and the modulation index. */
export function createFmVoice(
  p: FmPreset,
  knobs: KnobValues,
  destination: Tone.InputNode,
): PolyVoice {
  const synth = new Tone.FMSynth({
    harmonicity: p.harmonicity,
    modulationIndex: fmIndex(0.5, knobs.brightness) / FM_INTERNAL_GAIN,
    oscillator: { type: 'sine' },
    modulation: { type: 'sine' },
    envelope: p.amp,
    modulationEnvelope: p.modulation,
  })
  // Loudness is applied here, not through triggerAttack's velocity: that would also scale the
  // modulator, tying brightness to loudness. The 3 ms ramp avoids a step when a voice is stolen.
  const level = new Tone.Gain(0)
  synth.chain(level, destination)
  let brightness = knobs.brightness

  return {
    start(hz, velocity, gain, time) {
      synth.modulationIndex.setValueAtTime(fmIndex(velocity, brightness) / FM_INTERNAL_GAIN, time)
      level.gain.cancelAndHoldAtTime(time)
      level.gain.linearRampToValueAtTime(gain / FM_INTERNAL_GAIN, time + 0.003)
      synth.triggerAttack(hz, time, 1)
    },
    stop: (time) => void synth.triggerRelease(time),
    setKnob(id, value) {
      if (id === 'brightness') brightness = value
    },
    dispose() {
      synth.dispose()
      level.dispose()
    },
  }
}
