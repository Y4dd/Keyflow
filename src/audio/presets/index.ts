// The three Phase 0 presets, as data. Original sounds; names describe the sound, not an artist.

import type { FmPreset, KnobValues, LeadPreset, Preset, PresetId, WobblePreset } from './types.ts'

export const FUNK_LEAD: LeadPreset = {
  id: 'funk-lead',
  name: 'Funk Lead',
  description: 'Saw and square through a snappy filter. Glides when you play legato.',
  kind: 'lead',
  voice: 'mono',
  levelDb: -8,
  velocityRangeDb: 12,
  saw: { level: 0.5 },
  square: { level: 0.35, detuneCents: 7 },
  filter: {
    q: 3,
    envOctaves: 2.5,
    env: { attack: 0.003, decay: 0.25, sustain: 0.35, release: 0.25 },
  },
  amp: { attack: 0.004, decay: 0.15, sustain: 0.85, release: 0.18 },
  knobs: {
    cutoff: { label: 'Cutoff', min: 200, max: 6000, default: 1200, curve: 'log', unit: 'Hz' },
    glide: { label: 'Glide time', min: 0, max: 0.3, default: 0.06, curve: 'linear', unit: 's' },
  },
}

export const WOBBLE_BASS: WobblePreset = {
  id: 'wobble-bass',
  name: 'Wobble Bass',
  description: 'Detuned saws with a wobbling filter and grit, over a clean sub an octave down.',
  kind: 'wobble',
  voice: 'mono',
  levelDb: -10,
  velocityRangeDb: 9,
  saws: { level: 0.4, detuneCents: 12 },
  sub: { level: 0.6 },
  filter: { q: 5, sweepRatio: 6 },
  compressor: { thresholdDb: -18, ratio: 4, attack: 0.005, release: 0.1 },
  glide: 0.03,
  amp: { attack: 0.004, decay: 0.1, sustain: 1, release: 0.1 },
  knobs: {
    cutoff: { label: 'Cutoff', min: 150, max: 3000, default: 900, curve: 'log', unit: 'Hz' },
    lfoRate: { label: 'Wobble rate', min: 0.25, max: 10, default: 2, curve: 'log', unit: 'Hz' },
    drive: { label: 'Drive', min: 0, max: 1, default: 0.4, curve: 'linear', unit: '%' },
  },
}

export const EP_KEYS: FmPreset = {
  id: 'ep-keys',
  name: 'EP Keys',
  description: 'Electric-piano-like FM keys for chords. Play harder for a brighter tone.',
  kind: 'fm',
  voice: 'poly',
  levelDb: -6,
  velocityRangeDb: 18,
  voices: 10,
  harmonicity: 1,
  amp: { attack: 0.003, decay: 3, sustain: 0.15, release: 0.6 },
  modulation: { attack: 0.003, decay: 0.5, sustain: 0.2, release: 0.5 },
  knobs: {
    brightness: { label: 'Brightness', min: 0, max: 1, default: 0.5, curve: 'linear', unit: '%' },
  },
}

export const PRESETS: readonly Preset[] = [FUNK_LEAD, WOBBLE_BASS, EP_KEYS]

export function getPreset(id: PresetId): Preset {
  const preset = PRESETS.find((p) => p.id === id)
  if (!preset) throw new Error(`Unknown preset ${id}`)
  return preset
}

export function defaultKnobs(preset: Preset): KnobValues {
  const values: KnobValues = {}
  for (const [id, spec] of Object.entries(preset.knobs)) values[id] = spec.default
  return values
}
