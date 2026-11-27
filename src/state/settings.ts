// Saves settings to IndexedDB and restores them on load. Imported by main.tsx and the dev tools
// only, so the stores stay free of Dexie. Saving starts only after the saved settings are
// applied, so defaults never overwrite them; if storage can't be read, the app runs on defaults
// and saves nothing. Only what differs from the defaults is stored (toStored).

import { loadSettings, saveSettings } from '../storage/db.ts'
import {
  DEFAULT_SETTINGS,
  mergeLoaded,
  parseSettings,
  toStored,
  type Settings,
} from '../storage/settings.ts'
import { audio, useAudioStore } from './audio.ts'
import { useCalibrationStore } from './calibration.ts'
import { laptopBend } from './input.ts'
import { midi, useMidiStore } from './midi.ts'
import { useViewStore, view } from './view.ts'

// Sliders change knobs many times a second; one write per pause.
const SAVE_DELAY_MS = 300

function collect(): Settings {
  const a = useAudioStore.getState()
  const m = useMidiStore.getState()
  const c = useCalibrationStore.getState()
  return {
    layout: a.layout,
    knobs: a.knobs,
    expression: a.expression,
    mixer: a.mixer,
    invertPedal: m.invertPedal,
    bendKey: laptopBend.getKey(),
    deviceId: m.preferredId,
    calibration:
      c.offsetMs === null
        ? null
        : { offsetMs: c.offsetMs, outputTimestampLeadMs: c.outputTimestampLeadMs },
    keyLetters: useViewStore.getState().keyLetters,
    look: useViewStore.getState().look,
    audioStarted: a.startedBefore || a.status === 'running',
  }
}

function apply(s: Settings) {
  audio.restore({
    layout: s.layout,
    knobs: s.knobs,
    expression: s.expression,
    mixer: s.mixer,
    startedBefore: s.audioStarted,
  })
  midi.setInvertPedal(s.invertPedal)
  midi.select(s.deviceId) // listened to alone once that input is connected
  laptopBend.setKey(s.bendKey, performance.now())
  if (s.calibration) useCalibrationStore.setState(s.calibration)
  view.setKeyLetters(s.keyLetters)
  view.setLook(s.look)
}

let timer = 0
let writing: Promise<void> = Promise.resolve()
// Each stored row's value as JSON, as last loaded or written. Only rows that change are written,
// so a status change in a second tab doesn't write its older settings over this tab's.
// shortcut: two tabs changing the same setting: the last write wins, and neither tab sees the
// other's change until a reload. Sync tabs (BroadcastChannel) if that ever confuses anyone.
const stored = new Map<string, string>()

function write() {
  window.clearTimeout(timer)
  timer = 0
  const next = toStored(collect())
  const put: { key: string; value: unknown }[] = []
  const remove: string[] = []
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const value = next[key]
    const json = value === undefined ? undefined : JSON.stringify(value)
    if (json === stored.get(key)) continue
    if (json === undefined) {
      stored.delete(key)
      remove.push(key)
    } else {
      stored.set(key, json)
      put.push({ key, value })
    }
  }
  if (put.length > 0 || remove.length > 0) {
    writing = writing
      .then(() => saveSettings(put, remove))
      .catch((err: unknown) => console.warn('Keyflow: settings not saved', err))
  }
  return writing
}

const schedule = () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(write, SAVE_DELAY_MS)
}

let started: Promise<boolean> | null = null

/** Loads and applies saved settings, then saves every change. Call once, at startup. */
export function startSettings(): Promise<boolean> {
  if (started) return started
  const atStart = collect()
  started = loadSettings()
    .then((raw) => {
      for (const [key, value] of Object.entries(raw)) stored.set(key, JSON.stringify(value))
      // The first IndexedDB open can take a while (seconds in a busy Firefox); keep what the
      // user changed meanwhile instead of applying the stored value over it.
      apply(mergeLoaded(atStart, collect(), parseSettings(raw)))
      useAudioStore.subscribe(schedule)
      useMidiStore.subscribe(schedule)
      useCalibrationStore.subscribe(schedule)
      useViewStore.subscribe(schedule)
      laptopBend.subscribe(schedule)
      schedule() // saves those changes
      // shortcut: a write started on pagehide isn't guaranteed to finish; the 300 ms debounce
      // makes losing more than the last change unlikely. Upgrade if users report lost settings.
      window.addEventListener('pagehide', () => {
        if (timer !== 0) void write()
      })
      return true
    })
    .catch((err: unknown) => {
      console.warn('Keyflow: saved settings unavailable, using defaults', err)
      return false
    })
  return started
}

/** Writes pending changes now (dev tools, so e2e can reload without waiting). */
export async function flushSettings(): Promise<void> {
  if (await startSettings()) await write()
}
