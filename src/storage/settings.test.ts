import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  mergeLoaded,
  parseSettings,
  toStored,
  type Settings,
} from './settings.ts'

const CHANGED: Settings = {
  layout: {
    split: false,
    splitNote: 48,
    main: { presetId: 'ep-keys', octave: 1 },
    left: { presetId: 'funk-lead', octave: -1 },
  },
  knobs: {
    ...DEFAULT_SETTINGS.knobs,
    'funk-lead': { cutoff: 3000, glide: 0.1 },
    'wobble-bass': { cutoff: 500, lfoSync: 2, lfoRate: 4, drive: 0.8 },
    'ep-keys': { brightness: 0.2 },
  },
  expression: { pedalMode: 'bend', bendSemitones: 1, bendTimeMs: 250 },
  mixer: {
    channels: {
      drums: { db: -6, muted: false },
      bass: { db: 0, muted: true },
      chords: { db: 3, muted: false },
      you: { db: -12, muted: false },
    },
    youPlayBass: true,
  },
  invertPedal: true,
  bendKey: null,
  deviceId: 'input-1',
  calibration: { offsetMs: 41.5, outputTimestampLeadMs: -12 },
  keyLetters: false,
  look: 'spotlight',
  audioStarted: true,
}

describe('toStored', () => {
  it('keeps only what differs from the defaults, so changed defaults still reach the user', () => {
    expect(toStored(DEFAULT_SETTINGS)).toEqual({})
    const s = parseSettings({ layout: { splitNote: 48 }, expression: { bendTimeMs: 200 } })
    expect(toStored(s)).toEqual({ layout: { splitNote: 48 }, expression: { bendTimeMs: 200 } })
    expect(toStored({ ...DEFAULT_SETTINGS, bendKey: null })).toEqual({ bendKey: null })
  })

  it('what it keeps reads back as the same settings', () => {
    expect(parseSettings(JSON.parse(JSON.stringify(toStored(CHANGED))))).toEqual(CHANGED)
    const oneKnob = parseSettings({ knobs: { 'ep-keys': { brightness: 0.9 } } })
    expect(toStored(oneKnob)).toEqual({ knobs: { 'ep-keys': { brightness: 0.9 } } })
    expect(parseSettings(toStored(oneKnob))).toEqual(oneKnob)
  })
})

describe('mergeLoaded', () => {
  it('a setting changed while storage loaded keeps the change; the rest is loaded', () => {
    const now = { ...DEFAULT_SETTINGS, invertPedal: true }
    expect(mergeLoaded(DEFAULT_SETTINGS, now, CHANGED)).toEqual({ ...CHANGED, invertPedal: true })
    const pedal = {
      ...DEFAULT_SETTINGS,
      expression: { ...DEFAULT_SETTINGS.expression, bendTimeMs: 50 },
    }
    expect(mergeLoaded(DEFAULT_SETTINGS, pedal, CHANGED).expression.bendTimeMs).toBe(50)
    expect(mergeLoaded(DEFAULT_SETTINGS, DEFAULT_SETTINGS, CHANGED)).toEqual(CHANGED)
  })
})

describe('parseSettings', () => {
  it('round-trips every setting through JSON (what IndexedDB stores)', () => {
    expect(parseSettings(JSON.parse(JSON.stringify(CHANGED)))).toEqual(CHANGED)
    expect(parseSettings(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)))).toEqual(DEFAULT_SETTINGS)
    const two = { ...CHANGED, expression: { ...CHANGED.expression, bendSemitones: 2 } }
    expect(parseSettings(JSON.parse(JSON.stringify(two)))).toEqual(two)
  })

  it('nothing stored, or not an object: defaults', () => {
    expect(parseSettings({})).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('garbage')).toEqual(DEFAULT_SETTINGS)
  })

  it('a calibration without the output timestamp lead keeps the offset (lead null)', () => {
    const s = parseSettings({ calibration: { offsetMs: 30, outputTimestampLeadMs: null } })
    expect(s.calibration).toEqual({ offsetMs: 30, outputTimestampLeadMs: null })
    expect(parseSettings({ calibration: { offsetMs: 'x' } }).calibration).toBeNull()
  })

  it('invalid fields fall back one by one, and the valid ones are kept', () => {
    const s = parseSettings({
      layout: {
        split: 'yes',
        splitNote: 500,
        main: { presetId: 'gone-preset', octave: 9 },
        left: { presetId: 'ep-keys', octave: -1 },
      },
      knobs: { 'funk-lead': { cutoff: 1e9, glide: 0.1, extra: 3 }, 'ep-keys': 'x' },
      expression: { pedalMode: 'wah', bendSemitones: 3, bendTimeMs: 9999 },
      mixer: {
        channels: { drums: { db: -99, muted: 'x' }, bass: 'loud', you: { db: 2 } },
        youPlayBass: 1,
      },
      invertPedal: 1,
      bendKey: 'KeyQ',
      deviceId: 42,
      keyLetters: 'no',
      look: 'tape',
      audioStarted: 'true',
    })
    expect(s.layout).toEqual({
      split: true,
      splitNote: 127,
      main: { presetId: 'funk-lead', octave: 2 }, // getPreset would throw on the unknown id
      left: { presetId: 'ep-keys', octave: -1 },
    })
    expect(s.knobs['funk-lead']).toEqual({ cutoff: 6000, glide: 0.1 })
    expect(s.knobs['ep-keys']).toEqual(DEFAULT_SETTINGS.knobs['ep-keys'])
    expect(s.expression).toEqual({ pedalMode: 'sustain', bendSemitones: 'scale', bendTimeMs: 400 })
    expect(s.mixer).toEqual({
      channels: {
        drums: { db: -24, muted: false },
        bass: { db: 0, muted: false },
        chords: { db: 0, muted: false },
        you: { db: 2, muted: false },
      },
      youPlayBass: false,
    })
    expect(s).toMatchObject({
      invertPedal: false,
      bendKey: 'Space',
      deviceId: null,
      keyLetters: true,
      look: 'tags',
      audioStarted: false,
    })
  })
})
