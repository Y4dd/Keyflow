// The saved settings and the one place that reads them back. Whatever is in IndexedDB may come
// from an older version or be damaged, so parseSettings checks every field and falls back to
// its default one field at a time. No Dexie here; src/storage/db.ts reads and writes.

import {
  DEFAULT_EXPRESSION,
  MAX_BEND_TIME_MS,
  type ExpressionSettings,
} from '../audio/expression.ts'
import { CHANNELS, clampLevel, DEFAULT_MIXER, type MixerSettings } from '../audio/mixer.ts'
import { defaultKnobs, PRESETS } from '../audio/presets/index.ts'
import type { KnobValues, PresetId } from '../audio/presets/types.ts'
import {
  clampOctave,
  clampSplitNote,
  DEFAULT_LAYOUT,
  type KeyboardLayout,
  type ZoneSound,
} from '../audio/zones.ts'
import { BEND_KEYS, DEFAULT_BEND_KEY } from '../input/computer/bend.ts'
import { LOOKS, type Look } from '../ui/canvas/keys.ts'

export interface Settings {
  layout: KeyboardLayout
  knobs: Record<PresetId, KnobValues>
  expression: ExpressionSettings
  /** Mixer levels, mutes and "you play bass" (P1-T6). */
  mixer: MixerSettings
  invertPedal: boolean
  /** KeyboardEvent.code, or null when the bend key is off. */
  bendKey: string | null
  /** The chosen MIDI input's port id; null = every input. */
  deviceId: string | null
  /** The last usable tap test (P0-T8); the lead is null when it used the fallback clock pair. */
  calibration: { offsetMs: number; outputTimestampLeadMs: number | null } | null
  /** The computer-key letters on the canvas keys (P1-T4b). */
  keyLetters: boolean
  /** Jam mode's highlighting look (P1-T4b). */
  look: Look
  /** Sound was started on an earlier visit, so the page can say a click brings it back. */
  audioStarted: boolean
}

const DEFAULT_KNOBS = Object.fromEntries(PRESETS.map((p) => [p.id, defaultKnobs(p)])) as Record<
  PresetId,
  KnobValues
>

export const DEFAULT_SETTINGS: Settings = {
  layout: DEFAULT_LAYOUT,
  knobs: DEFAULT_KNOBS,
  expression: DEFAULT_EXPRESSION,
  mixer: DEFAULT_MIXER,
  invertPedal: false,
  bendKey: DEFAULT_BEND_KEY,
  deviceId: null,
  calibration: null,
  keyLetters: true,
  look: 'tags',
  audioStarted: false,
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The parts of `value` that differ from `base`, leaf by leaf; undefined when nothing does. */
function diff(value: unknown, base: unknown): unknown {
  if (!isObj(value) || !isObj(base)) return Object.is(value, base) ? undefined : value
  const out: Obj = {}
  for (const [k, v] of Object.entries(value)) {
    const d = diff(v, base[k])
    if (d !== undefined) out[k] = d
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * What to store: only the settings, and the fields inside them, that differ from the defaults.
 * A default the user never changed isn't frozen, so a new default in a later version reaches
 * them; parseSettings fills every missing field back in. A setting absent here is stored as no
 * row at all.
 */
export function toStored(settings: Settings): Partial<Record<keyof Settings, unknown>> {
  const out: Partial<Record<keyof Settings, unknown>> = {}
  for (const key of Object.keys(settings) as (keyof Settings)[]) {
    const d = diff(settings[key], DEFAULT_SETTINGS[key])
    if (d !== undefined) out[key] = d
  }
  return out
}
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)

function zoneSound(v: unknown, fallback: ZoneSound): ZoneSound {
  if (!isObj(v)) return fallback
  const preset = PRESETS.find((p) => p.id === v.presetId)
  return {
    presetId: preset ? preset.id : fallback.presetId,
    octave: num(v.octave) ? clampOctave(v.octave) : fallback.octave,
  }
}

function layout(v: unknown): KeyboardLayout {
  const d = DEFAULT_LAYOUT
  if (!isObj(v)) return d
  return {
    split: bool(v.split, d.split),
    splitNote: num(v.splitNote) ? clampSplitNote(v.splitNote) : d.splitNote,
    main: zoneSound(v.main, d.main),
    left: zoneSound(v.left, d.left),
  }
}

/** Each preset's own knobs, clamped to their range; unknown knobs are dropped. */
function knobs(v: unknown): Record<PresetId, KnobValues> {
  const saved = isObj(v) ? v : {}
  const out = {} as Record<PresetId, KnobValues>
  for (const preset of PRESETS) {
    const values = isObj(saved[preset.id]) ? (saved[preset.id] as Obj) : {}
    out[preset.id] = Object.fromEntries(
      Object.entries(preset.knobs).map(([id, spec]) => {
        const x = values[id]
        if (!num(x)) return [id, spec.default]
        const v = Math.min(spec.max, Math.max(spec.min, x))
        return [id, spec.unit === 'choice' ? Math.round(v) : v]
      }),
    )
  }
  return out
}

function expression(v: unknown): ExpressionSettings {
  const d = DEFAULT_EXPRESSION
  if (!isObj(v)) return d
  return {
    pedalMode:
      v.pedalMode === 'sustain' || v.pedalMode === 'bend' || v.pedalMode === 'glideHold'
        ? v.pedalMode
        : d.pedalMode,
    bendSemitones:
      v.bendSemitones === 1 || v.bendSemitones === 2 || v.bendSemitones === 'scale'
        ? v.bendSemitones
        : d.bendSemitones,
    bendTimeMs: num(v.bendTimeMs)
      ? Math.min(MAX_BEND_TIME_MS, Math.max(0, v.bendTimeMs))
      : d.bendTimeMs,
  }
}

function mixer(v: unknown): MixerSettings {
  const d = DEFAULT_MIXER
  if (!isObj(v)) return d
  const saved = isObj(v.channels) ? v.channels : {}
  const channels = Object.fromEntries(
    CHANNELS.map((c) => {
      const x = isObj(saved[c]) ? saved[c] : {}
      return [
        c,
        {
          db: num(x.db) ? clampLevel(x.db) : d.channels[c].db,
          muted: bool(x.muted, d.channels[c].muted),
        },
      ]
    }),
  ) as MixerSettings['channels']
  return { channels, youPlayBass: bool(v.youPlayBass, d.youPlayBass) }
}

function calibration(v: unknown): Settings['calibration'] {
  if (!isObj(v) || !num(v.offsetMs)) return null
  return {
    offsetMs: v.offsetMs,
    outputTimestampLeadMs: num(v.outputTimestampLeadMs) ? v.outputTimestampLeadMs : null,
  }
}

/**
 * Loaded settings, under any change made while they loaded: a setting that changed since
 * startup (`atStart` → `now`) keeps its new value, so a slow first IndexedDB open can't undo a
 * click made meanwhile. The rest comes from storage.
 */
export function mergeLoaded(atStart: Settings, now: Settings, loaded: Settings): Settings {
  const out: Record<string, unknown> = { ...loaded }
  for (const key of Object.keys(now) as (keyof Settings)[]) {
    if (JSON.stringify(now[key]) !== JSON.stringify(atStart[key])) out[key] = now[key]
  }
  return out as unknown as Settings
}

/** Reads stored settings (an object of setting → value); anything invalid becomes its default. */
export function parseSettings(raw: unknown): Settings {
  const v = isObj(raw) ? raw : {}
  const d = DEFAULT_SETTINGS
  return {
    layout: layout(v.layout),
    knobs: knobs(v.knobs),
    expression: expression(v.expression),
    mixer: mixer(v.mixer),
    invertPedal: bool(v.invertPedal, d.invertPedal),
    // null is a choice (the bend key is off), so only a missing or unknown key falls back.
    bendKey:
      v.bendKey === null || BEND_KEYS.some((k) => k.code === v.bendKey)
        ? (v.bendKey as string | null)
        : d.bendKey,
    deviceId: typeof v.deviceId === 'string' ? v.deviceId : d.deviceId,
    calibration: calibration(v.calibration),
    keyLetters: bool(v.keyLetters, d.keyLetters),
    look: LOOKS.find((l) => l === v.look) ?? d.look,
    audioStarted: bool(v.audioStarted, d.audioStarted),
  }
}
