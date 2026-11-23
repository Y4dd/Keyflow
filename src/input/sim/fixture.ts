// MIDI fixtures: raw messages recorded from a real keyboard with the dev inspector, saved as
// JSON under tests/fixtures/, and replayed through the real parser. Raw bytes (not parsed
// InputEvents) are stored so a fixture keeps channels and ignored messages, and so it tests the
// parser itself. Pure: no DOM.

import { createMidiParser } from '../midi/parse.ts'
import type { SimEvent } from './script.ts'

export const FIXTURE_FORMAT = 'keyflow-midi-fixture'

export interface FixtureMessage {
  /** ms since the recording started. */
  t: number
  /** One complete MIDI message. */
  data: number[]
}

export interface MidiFixture {
  format: typeof FIXTURE_FORMAT
  version: 1
  /** What was played, written by whoever recorded it. Synthetic fixtures must say so here. */
  description: string
  /** MIDI input names, e.g. ["Digital Keyboard-1"]. */
  devices: string[]
  browser: string
  /** ISO date. */
  recordedAt: string
  durationMs: number
  /** System realtime messages seen but not stored: they're constant and the parser drops them. */
  dropped: { clock: number; activeSensing: number; otherRealtime: number }
  messages: FixtureMessage[]
}

export interface FixtureMeta {
  description: string
  devices: string[]
  browser: string
  recordedAt: string
}

export interface FixtureRecorder {
  /** Call for every raw MIDI message, clock included. */
  add(data: ArrayLike<number>, time: number): void
  messageCount(): number
  finish(meta: FixtureMeta, endTime: number): MidiFixture
}

const round = (ms: number) => Math.round(ms * 10) / 10

export function createFixtureRecorder(startTime: number): FixtureRecorder {
  const messages: FixtureMessage[] = []
  let last = 0
  const dropped = { clock: 0, activeSensing: 0, otherRealtime: 0 }
  return {
    add(data, time) {
      const status = data[0]
      if (status === 0xf8) dropped.clock++
      else if (status === 0xfe) dropped.activeSensing++
      else if (status >= 0xf8) dropped.otherRealtime++
      else {
        // Arrival order is what the parser saw; keep t from going backwards if two inputs'
        // timestamps interleave.
        last = Math.max(last, round(time - startTime))
        messages.push({ t: last, data: Array.from(data) })
      }
    },
    messageCount: () => messages.length,
    finish(meta, endTime) {
      return {
        format: FIXTURE_FORMAT,
        version: 1,
        ...meta,
        durationMs: round(Math.max(0, endTime - startTime)),
        dropped: { ...dropped },
        messages: [...messages],
      }
    },
  }
}

/** Validates parsed JSON as a fixture. Throws an Error naming the first problem. */
export function parseFixture(json: unknown): MidiFixture {
  const fail = (why: string): never => {
    throw new Error(`Not a Keyflow MIDI fixture: ${why}`)
  }
  if (typeof json !== 'object' || json === null) fail('not an object')
  const f = json as Record<string, unknown>
  if (f.format !== FIXTURE_FORMAT) fail(`format must be "${FIXTURE_FORMAT}"`)
  if (f.version !== 1) fail(`unsupported version ${String(f.version)}`)
  for (const key of ['description', 'browser', 'recordedAt'] as const) {
    if (typeof f[key] !== 'string') fail(`${key} must be a string`)
  }
  if (!Array.isArray(f.devices) || !f.devices.every((d) => typeof d === 'string')) {
    fail('devices must be a list of names')
  }
  if (typeof f.durationMs !== 'number') fail('durationMs must be a number')
  const d = f.dropped as Record<string, unknown> | undefined
  if (
    typeof d !== 'object' ||
    d === null ||
    typeof d.clock !== 'number' ||
    typeof d.activeSensing !== 'number' ||
    typeof d.otherRealtime !== 'number'
  ) {
    fail('dropped must have clock, activeSensing and otherRealtime counts')
  }
  if (!Array.isArray(f.messages)) fail('messages must be a list')
  let last = 0
  ;(f.messages as unknown[]).forEach((m, i) => {
    const msg = m as Record<string, unknown>
    if (typeof msg?.t !== 'number' || msg.t < last) fail(`message ${i}: t must not go backwards`)
    if (
      !Array.isArray(msg.data) ||
      msg.data.length === 0 ||
      !msg.data.every((b) => Number.isInteger(b) && b >= 0 && b <= 255)
    ) {
      fail(`message ${i}: data must be a list of bytes`)
    }
    last = msg.t as number
  })
  return json as MidiFixture
}

/**
 * Runs the fixture through the real MIDI parser and returns sim events timed from the first
 * recorded moment (t = 0). Anything still held at the end is released at the last message.
 */
export function fixtureToSimEvents(fixture: MidiFixture): SimEvent[] {
  const parser = createMidiParser()
  const events: SimEvent[] = []
  const toSim = (e: NonNullable<ReturnType<typeof parser.parse>>): SimEvent => {
    switch (e.kind) {
      case 'noteOn':
        return { kind: 'noteOn', note: e.note, velocity: e.velocity, at: e.time }
      case 'noteOff':
        return { kind: 'noteOff', note: e.note, at: e.time }
      case 'pedal':
        return { kind: 'pedal', down: e.down, at: e.time }
      case 'bend':
        return { kind: 'bend', semitones: e.semitones, at: e.time }
    }
  }
  for (const m of fixture.messages) {
    const event = parser.parse(m.data, m.t)
    if (event !== null) events.push(toSim(event))
  }
  const end = fixture.messages.at(-1)?.t ?? 0
  for (const event of parser.releaseAll(end)) events.push(toSim(event))
  return events
}

export interface FixtureAnalysis {
  messages: number
  /** Note-ons (velocity > 0) per channel, index 0 = channel 1. */
  noteOnsByChannel: number[]
  /** CC64 messages per channel. */
  pedalByChannel: number[]
  /** Messages the parser ignores (other CCs, program change, ...), excluding realtime. */
  ignored: number
  /** Note-ons for a pitch already held on a different channel (the P0-T3 open question). */
  samePitchOnTwoChannels: number
  /** Pitches still held on some channel when the recording ends. */
  heldAtEnd: number[]
}

export function analyzeFixture(fixture: MidiFixture): FixtureAnalysis {
  const noteOnsByChannel = new Array<number>(16).fill(0)
  const pedalByChannel = new Array<number>(16).fill(0)
  // held[note] = bitmask of channels holding it
  const held = new Uint16Array(128)
  let ignored = 0
  let samePitchOnTwoChannels = 0
  for (const { data } of fixture.messages) {
    const status = data[0]
    const type = status & 0xf0
    const ch = status & 0x0f
    if (data.length >= 3 && (type === 0x90 || type === 0x80)) {
      const note = data[1] & 0x7f
      const bit = 1 << ch
      if (type === 0x90 && data[2] > 0) {
        noteOnsByChannel[ch]++
        if ((held[note] & ~bit) !== 0) samePitchOnTwoChannels++
        held[note] |= bit
      } else {
        held[note] &= ~bit
      }
    } else if (data.length >= 3 && type === 0xb0 && data[1] === 64) {
      pedalByChannel[ch]++
    } else {
      ignored++
    }
  }
  const heldAtEnd: number[] = []
  for (let note = 0; note < 128; note++) if (held[note] !== 0) heldAtEnd.push(note)
  return {
    messages: fixture.messages.length,
    noteOnsByChannel,
    pedalByChannel,
    ignored,
    samePitchOnTwoChannels,
    heldAtEnd,
  }
}

/** JSON with one message per line, so fixtures stay readable and diff well. */
export function stringifyFixture(fixture: MidiFixture): string {
  const { messages, ...header } = fixture
  const head = JSON.stringify(header, null, 2).slice(0, -2) // drop the closing "\n}"
  const lines = messages.map((m) => `    ${JSON.stringify(m)}`).join(',\n')
  return `${head},\n  "messages": [${lines ? `\n${lines}\n  ` : ''}]\n}\n`
}
