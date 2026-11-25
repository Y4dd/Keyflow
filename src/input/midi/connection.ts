// Web MIDI glue: access request, onboarding state, hot-plug, and per-input parsing onto the
// input bus. The browser is injected (MidiEnv) so this is testable with a fake MIDIAccess.

import type { InputEvent } from '../types.ts'
import {
  initialOnboardingState,
  nextOnboardingState,
  type OnboardingEvent,
  type OnboardingState,
  type PermissionHint,
} from './onboarding.ts'
import { createMidiParser, type MidiParser } from './parse.ts'

/** The parts of MIDIInput this module uses. */
export interface MidiInputPort {
  readonly id: string
  readonly name: string | null
  readonly manufacturer: string | null
  readonly state: string // 'connected' | 'disconnected'
  onmidimessage: ((event: { data: Uint8Array | null; timeStamp: number }) => void) | null
  open?(): Promise<unknown>
}

/** The parts of MIDIAccess this module uses. */
export interface MidiAccessLike {
  readonly inputs: { values(): Iterable<MidiInputPort> }
  onstatechange: ((event: unknown) => void) | null
}

export interface MidiEnv {
  /** Null when the browser has no Web MIDI API. */
  requestAccess: (() => Promise<MidiAccessLike>) | null
  queryPermission(): Promise<PermissionHint>
  now(): number
  setTimer(fn: () => void, ms: number): unknown
  clearTimer(handle: unknown): void
}

export interface MidiInputInfo {
  id: string
  name: string
  manufacturer: string
}

export interface MidiSnapshot {
  /** True until the initial permission check (and any silent request) has finished. */
  checking: boolean
  status: OnboardingState
  /** Connected inputs. */
  inputs: MidiInputInfo[]
  /** The input listened to alone; null = every input. Only ever a connected one. */
  selectedId: string | null
  /**
   * The user's choice of input (null = every input), kept while that input is unplugged so it
   * is listened to alone again when it comes back. Settings save this one.
   */
  preferredId: string | null
  /** Reversed pedal polarity, for every input. */
  invertPedal: boolean
  /**
   * Inputs are attached but nothing (not even clock) has arrived for NO_INPUT_HINT_MS, or the
   * port failed to open. On Windows another app may be holding the device.
   */
  noInputYet: boolean
  /** "Name: message" of the last rejected request. */
  error: string | null
}

export interface MidiConnection {
  /** Checks the permission; requests access silently if it is already granted. */
  start(): Promise<void>
  /** Requests access. Call from a user gesture (the Connect button). */
  request(): Promise<void>
  select(id: string | null): void
  setInvertPedal(invert: boolean): void
  getSnapshot(): MidiSnapshot
  /**
   * Hears every raw message from the listened inputs (clock included) before parsing. For the
   * dev inspector's fixture recorder. Returns an unsubscribe function.
   */
  tapRaw(listener: RawMidiListener): () => void
  dispose(): void
}

export type RawMidiListener = (data: Uint8Array, time: number, inputName: string) => void

export const NO_INPUT_HINT_MS = 4000

interface Attached {
  port: MidiInputPort
  parser: MidiParser
}

export function createMidiConnection(
  env: MidiEnv,
  emit: (event: InputEvent) => void,
  onChange: (snapshot: MidiSnapshot) => void,
): MidiConnection {
  let snap: MidiSnapshot = {
    checking: true,
    status: initialOnboardingState,
    inputs: [],
    selectedId: null,
    preferredId: null,
    invertPedal: false,
    noInputYet: false,
    error: null,
  }
  let access: MidiAccessLike | null = null
  let pending: Promise<void> | null = null
  const attached = new Map<string, Attached>()
  let heard = false
  let timer: unknown = null
  let rawTaps: readonly RawMidiListener[] = []

  function update(patch: Partial<MidiSnapshot>) {
    snap = { ...snap, ...patch }
    onChange(snap)
  }
  const next = (event: OnboardingEvent) => nextOnboardingState(snap.status, event)

  function markHeard() {
    heard = true
    if (timer !== null) {
      env.clearTimer(timer)
      timer = null
    }
    if (snap.noInputYet) update({ noInputYet: false })
  }

  function restartQuietTimer() {
    heard = false
    if (timer !== null) env.clearTimer(timer)
    timer = env.setTimer(() => {
      timer = null
      if (!heard && attached.size > 0) update({ noInputYet: true })
    }, NO_INPUT_HINT_MS)
  }

  function attach(port: MidiInputPort) {
    const parser = createMidiParser({ invertPedal: snap.invertPedal })
    attached.set(port.id, { port, parser })
    // Hot path: MIDI callback -> parser -> bus, nothing else.
    port.onmidimessage = (e) => {
      if (!heard) markHeard() // any byte, even clock, proves the port delivers
      if (e.data === null) return
      if (snap.selectedId !== null && snap.selectedId !== port.id) return
      if (rawTaps.length > 0) for (const tap of rawTaps) tap(e.data, e.timeStamp, port.name ?? '')
      const event = parser.parse(e.data, e.timeStamp)
      if (event !== null) emit(event)
    }
    // Setting onmidimessage opens the port implicitly; open() is called too, to learn if it fails.
    port.open?.().catch(() => {
      if (!heard) update({ noInputYet: true })
    })
  }

  function detach(entry: Attached, time: number) {
    entry.port.onmidimessage = null
    attached.delete(entry.port.id)
    for (const event of entry.parser.releaseAll(time)) emit(event)
  }

  // Attached = connected (refresh keeps them in sync).
  const connectedOrNull = (id: string | null) => (id !== null && attached.has(id) ? id : null)

  /** Syncs attached inputs with the connected ones. Returns the connected count. */
  function refresh(): number {
    if (access === null) return 0
    const connected = new Map<string, MidiInputPort>()
    for (const port of access.inputs.values()) {
      if (port.state === 'connected') connected.set(port.id, port)
    }
    const now = env.now()
    for (const entry of [...attached.values()]) {
      // A replugged device may come back as the same port object or a new one.
      if (connected.get(entry.port.id) !== entry.port) detach(entry, now)
    }
    let added = false
    for (const port of connected.values()) {
      if (!attached.has(port.id)) {
        attach(port)
        added = true
      }
    }
    if (added) restartQuietTimer()
    const inputs = [...connected.values()].map((p) => ({
      id: p.id,
      name: p.name || 'Unnamed MIDI input',
      manufacturer: p.manufacturer ?? '',
    }))
    // Selecting an input that isn't there would silently filter out every remaining one.
    const selectedId = connectedOrNull(snap.preferredId)
    if (selectedId !== snap.selectedId) releaseUnlistened(selectedId, now)
    snap = {
      ...snap,
      inputs,
      selectedId,
      noInputYet: connected.size === 0 ? false : snap.noInputYet,
    }
    return connected.size
  }

  /** Releases what's held on inputs that a new selection no longer listens to. */
  function releaseUnlistened(selectedId: string | null, now: number) {
    if (selectedId === null) return
    for (const entry of attached.values()) {
      if (entry.port.id !== selectedId)
        for (const event of entry.parser.releaseAll(now)) emit(event)
    }
  }

  async function doRequest(silent: boolean) {
    const requestAccess = env.requestAccess
    if (requestAccess === null || access !== null) return
    update({ status: next({ type: 'requestStarted', silent }), error: null })
    let result: MidiAccessLike
    try {
      result = await requestAccess()
    } catch (err) {
      const error = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      update({ checking: false, status: next({ type: 'requestFailed' }), error })
      return
    }
    access = result
    result.onstatechange = () => {
      const inputCount = refresh()
      update({ status: next({ type: 'inputsChanged', inputCount }) })
    }
    const inputCount = refresh()
    update({ checking: false, status: next({ type: 'requestSucceeded', inputCount }) })
  }

  function request(silent = false): Promise<void> {
    pending ??= doRequest(silent).finally(() => {
      pending = null
    })
    return pending
  }

  return {
    async start() {
      if (env.requestAccess === null) {
        update({ checking: false, status: next({ type: 'apiMissing' }) })
        return
      }
      const permission = await env.queryPermission()
      update({ status: next({ type: 'permissionKnown', permission }) })
      if (permission === 'granted') await request(true)
      else update({ checking: false })
    },
    request: () => request(false),
    select(id) {
      const selectedId = connectedOrNull(id)
      update({ selectedId, preferredId: id })
      releaseUnlistened(selectedId, env.now())
    },
    setInvertPedal(invert) {
      update({ invertPedal: invert })
      const now = env.now()
      for (const entry of attached.values()) {
        const event = entry.parser.setInvertPedal(invert, now)
        if (event !== null) emit(event)
      }
    },
    getSnapshot: () => snap,
    tapRaw(listener) {
      rawTaps = [...rawTaps, listener]
      return () => {
        rawTaps = rawTaps.filter((l) => l !== listener)
      }
    },
    dispose() {
      const now = env.now()
      for (const entry of [...attached.values()]) detach(entry, now)
      if (access !== null) access.onstatechange = null
      if (timer !== null) env.clearTimer(timer)
      timer = null
    },
  }
}
