// The groove's drum kit, synthesized (no samples, so no assets or licenses), plus the count-in
// click. Every hit is a one-shot at a scheduled time.
// shortcut: one simple patch per voice, no hat choke or clap bursts; upgrade when P1-T3's
// grooves need more punch (CC0 samples are the open question in the Phase 1 file).

import * as Tone from 'tone'
import type { DrumVoice } from '../../grooves/groove.ts'

export interface DrumKit {
  hit(voice: DrumVoice, velocity: number, time: number): void
  click(accent: boolean, time: number): void
}

export function createDrumKit(destination: Tone.InputNode): DrumKit {
  // Its own context: inside an offline render the global one is the live context again.
  const context = Tone.getContext()
  const membrane = (
    hz: number,
    decay: number,
    options: { pitchDecay: number; octaves: number; volume: number },
  ) => {
    const synth = new Tone.MembraneSynth({
      ...options,
      envelope: { attack: 0.001, decay, sustain: 0, release: 0.02 },
    }).connect(destination)
    return (velocity: number, time: number) => synth.triggerAttackRelease(hz, decay, time, velocity)
  }
  const noise = (
    type: 'white' | 'pink',
    filter: Partial<Tone.FilterOptions>,
    decay: number,
    volume: number,
  ) => {
    const f = new Tone.Filter(filter).connect(destination)
    const synth = new Tone.NoiseSynth({
      noise: { type },
      envelope: { attack: 0.001, decay, sustain: 0, release: 0.01 },
      volume,
    }).connect(f)
    return (velocity: number, time: number) => synth.triggerAttackRelease(decay, time, velocity)
  }

  const kick = membrane(45, 0.35, { pitchDecay: 0.04, octaves: 6, volume: -2 })
  const snareBody = membrane(190, 0.1, { pitchDecay: 0.01, octaves: 1.5, volume: -10 })
  const snareNoise = noise('white', { type: 'highpass', frequency: 1200 }, 0.16, -10)
  const voices: Record<DrumVoice, (velocity: number, time: number) => void> = {
    kick,
    snare: (v, t) => {
      snareBody(v, t)
      snareNoise(v, t)
    },
    clap: noise('pink', { type: 'bandpass', frequency: 1300, Q: 1.2 }, 0.12, -8),
    hat: noise('white', { type: 'highpass', frequency: 7500 }, 0.04, -16),
    openHat: noise('white', { type: 'highpass', frequency: 7000 }, 0.3, -18),
    rim: membrane(420, 0.05, { pitchDecay: 0.006, octaves: 2, volume: -12 }),
  }
  // Tone throws when a one-shot restarts at or before its last start. It first moves a past
  // time up to the clock, so after a main-thread stall two late hits can land on the same
  // time; a play pressed right after a stop could too. So a hit starts at least 1 ms after
  // the last one really started (the clock read after the call is never earlier, as in the
  // EP voice).
  const last = new Map<DrumVoice | 'click', number>()
  const at = (voice: DrumVoice | 'click', time: number, trigger: (t: number) => void) => {
    const t = Math.max(time, (last.get(voice) ?? -Infinity) + 0.001)
    trigger(t)
    last.set(voice, Math.max(t, context.immediate()))
  }

  const click = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
    volume: -10,
  }).connect(destination)

  return {
    hit: (voice, velocity, time) => at(voice, time, (t) => voices[voice](velocity, t)),
    click: (accent, time) =>
      at('click', time, (t) => click.triggerAttackRelease(accent ? 1760 : 880, 0.03, t)),
  }
}
