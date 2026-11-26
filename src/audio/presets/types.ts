// Preset shapes. Presets are plain JSON-serializable data (no functions, no Tone objects), so
// later phases can store, copy and edit them. Each `kind` has its own Tone.js graph in
// src/audio/tone/.

import type { KnobCurve } from '../curves.ts'

export interface Envelope {
  attack: number // s
  decay: number // s
  sustain: number // 0..1
  release: number // s
}

export interface KnobSpec {
  label: string
  min: number
  max: number
  default: number
  curve: KnobCurve
  /** 'choice': the value is an index into `choices`, picked with chips instead of a slider. */
  unit: 'Hz' | 's' | '%' | 'choice'
  choices?: readonly string[]
}

interface PresetBase<K extends string> {
  id: PresetId
  name: string
  /** One line for the preset picker. */
  description: string
  voice: 'poly' | 'mono'
  /** Preset output level before the master chain, dB. */
  levelDb: number
  /** How far below full level a velocity-0 note sits, dB (see velocityToGain). */
  velocityRangeDb: number
  knobs: Record<K, KnobSpec>
}

/**
 * Funk Lead and the clean basses: saw + square through a low-pass filter with its own envelope,
 * plus an optional sine at the played pitch that skips the filter; legato glide.
 */
export interface LeadPreset extends PresetBase<'cutoff' | 'glide'> {
  kind: 'lead'
  voice: 'mono'
  saw: { level: number }
  square: { level: number; detuneCents: number }
  sine?: { level: number }
  filter: { q: number; envOctaves: number; env: Envelope }
  amp: Envelope
}

/** Wobble Bass: two detuned saws through an LFO filter and distortion, plus a clean sub. */
export interface WobblePreset extends PresetBase<'cutoff' | 'lfoSync' | 'lfoRate' | 'drive'> {
  kind: 'wobble'
  voice: 'mono'
  saws: { level: number; detuneCents: number }
  sub: { level: number }
  /** The LFO sweeps the filter from cutoff / sweepRatio up to cutoff. */
  filter: { q: number; sweepRatio: number }
  compressor: { thresholdDb: number; ratio: number; attack: number; release: number }
  /** Legato-only glide time, like the lead's. Fixed in Phase 0 (no knob). */
  glide: number
  amp: Envelope
}

/** EP Keys: two-operator FM per voice; velocity raises the modulation index (brightness). */
export interface FmPreset extends PresetBase<'brightness'> {
  kind: 'fm'
  voice: 'poly'
  voices: number
  harmonicity: number
  amp: Envelope
  modulation: Envelope
}

/**
 * Warm Tines: EP Keys' FM voice, then a low-mid boost and a low-pass (the Tone knob) for warmth,
 * and a tremolo (a level swung by an LFO), as on a vintage electric piano.
 */
export interface TinesPreset extends PresetBase<'brightness' | 'tremolo' | 'tone'> {
  kind: 'tines'
  voice: 'poly'
  voices: number
  harmonicity: number
  amp: Envelope
  modulation: Envelope
  /** A gentle low-mid boost for a fuller body. */
  body: { hz: number; db: number }
  tremoloHz: number
}

export type Preset = LeadPreset | WobblePreset | FmPreset | TinesPreset
export type PresetId = 'funk-lead' | 'wobble-bass' | 'ep-keys' | 'round-bass' | 'warm-tines'
export type KnobValues = Record<string, number>
