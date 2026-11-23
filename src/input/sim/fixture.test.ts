import { describe, expect, it } from 'vitest'
import {
  analyzeFixture,
  createFixtureRecorder,
  fixtureToSimEvents,
  parseFixture,
  stringifyFixture,
  type MidiFixture,
} from './fixture.ts'

const meta = {
  description: 'test',
  devices: ['Digital Keyboard-1'],
  browser: 'chromium',
  recordedAt: '2026-11-23T10:00:00.000Z',
}

function fixtureOf(messages: [number, number[]][]): MidiFixture {
  const r = createFixtureRecorder(0)
  for (const [t, data] of messages) r.add(data, t)
  return r.finish(meta, messages.at(-1)?.[0] ?? 0)
}

describe('createFixtureRecorder', () => {
  it('stores messages relative to the start, and only counts realtime ones', () => {
    const r = createFixtureRecorder(1000)
    r.add([0xf8], 1001)
    r.add([0x90, 60, 100], 1010.04)
    r.add([0xfe], 1011)
    r.add([0xf8], 1012)
    r.add([0xfa], 1013)
    r.add(new Uint8Array([0x90, 60, 0]), 1250.56)
    expect(r.messageCount()).toBe(2)
    const f = r.finish(meta, 3000)
    expect(f.messages).toEqual([
      { t: 10, data: [0x90, 60, 100] },
      { t: 250.6, data: [0x90, 60, 0] },
    ])
    expect(f.dropped).toEqual({ clock: 2, activeSensing: 1, otherRealtime: 1 })
    expect(f.durationMs).toBe(2000)
    expect(f).toMatchObject({ format: 'keyflow-midi-fixture', version: 1, ...meta })
  })
})

describe('createFixtureRecorder: ordering', () => {
  it('never lets t go backwards, so what it writes always parses', () => {
    const r = createFixtureRecorder(100)
    r.add([0x90, 60, 90], 150)
    r.add([0x91, 62, 90], 140) // an earlier timestamp arriving later
    r.add([0x90, 60, 0], 50) // before the recording started
    const f = r.finish(meta, 200)
    expect(f.messages.map((m) => m.t)).toEqual([50, 50, 50])
    expect(() => parseFixture(JSON.parse(stringifyFixture(f)))).not.toThrow()
  })
})

describe('parseFixture', () => {
  const valid = () => JSON.parse(stringifyFixture(fixtureOf([[0, [0x90, 60, 1]]]))) as unknown

  it('accepts what the recorder writes', () => {
    expect(parseFixture(valid())).toMatchObject({ version: 1 })
  })

  it('names the problem', () => {
    const bad = (patch: Record<string, unknown>) => ({ ...(valid() as object), ...patch })
    expect(() => parseFixture(null)).toThrow(/not an object/)
    expect(() => parseFixture(bad({ format: 'x' }))).toThrow(/format/)
    expect(() => parseFixture(bad({ version: 2 }))).toThrow(/version/)
    expect(() => parseFixture(bad({ devices: 'x' }))).toThrow(/devices/)
    expect(() => parseFixture(bad({ dropped: {} }))).toThrow(/dropped/)
    expect(() =>
      parseFixture(
        bad({
          messages: [
            { t: 5, data: [1] },
            { t: 4, data: [1] },
          ],
        }),
      ),
    ).toThrow(/message 1: t/)
    expect(() => parseFixture(bad({ messages: [{ t: 0, data: [300] }] }))).toThrow(/bytes/)
  })
})

describe('fixtureToSimEvents', () => {
  it('replays through the real parser: velocity-0 note-offs, any-channel pedal', () => {
    const f = fixtureOf([
      [0, [0xb0, 0, 0]], // bank select: ignored
      [10, [0x90, 60, 127]],
      [20, [0xb0, 64, 127]],
      [20, [0xb1, 64, 127]],
      [20, [0xb2, 64, 0]],
      [30, [0x90, 60, 0]],
      [40, [0xb0, 64, 0]],
      [40, [0xb1, 64, 0]],
      [40, [0xb2, 64, 0]],
    ])
    expect(fixtureToSimEvents(f)).toEqual([
      { kind: 'noteOn', note: 60, velocity: 1, at: 10 },
      { kind: 'pedal', down: true, at: 20 },
      { kind: 'noteOff', note: 60, at: 30 },
      { kind: 'pedal', down: false, at: 40 },
    ])
  })

  it('releases anything still held at the last message', () => {
    const f = fixtureOf([
      [10, [0x90, 60, 90]],
      [20, [0xb0, 64, 127]],
    ])
    expect(fixtureToSimEvents(f).slice(2)).toEqual([
      { kind: 'noteOff', note: 60, at: 20 },
      { kind: 'pedal', down: false, at: 20 },
    ])
  })
})

describe('analyzeFixture', () => {
  it('counts note-ons and pedal messages per channel and finds cross-channel doubles', () => {
    const a = analyzeFixture(
      fixtureOf([
        [0, [0xc0, 5]],
        [1, [0x90, 60, 90]],
        [2, [0x91, 60, 90]], // same pitch, other channel, while ch 1 holds it
        [3, [0x90, 60, 0]],
        [4, [0x91, 60, 0]],
        [5, [0x92, 64, 90]],
        [6, [0xb0, 64, 127]],
        [7, [0xb2, 64, 0]],
      ]),
    )
    expect(a.noteOnsByChannel.slice(0, 3)).toEqual([1, 1, 1])
    expect(a.pedalByChannel.slice(0, 3)).toEqual([1, 0, 1])
    expect(a.samePitchOnTwoChannels).toBe(1)
    expect(a.heldAtEnd).toEqual([64])
    expect(a.ignored).toBe(1)
    expect(a.messages).toBe(8)
  })

  it('does not count a repeated note on the same channel as a double', () => {
    const a = analyzeFixture(
      fixtureOf([
        [1, [0x90, 60, 90]],
        [2, [0x90, 60, 90]],
      ]),
    )
    expect(a.samePitchOnTwoChannels).toBe(0)
  })
})

describe('stringifyFixture', () => {
  it('round-trips through JSON.parse with one message per line', () => {
    const f = fixtureOf([
      [0, [0x90, 60, 90]],
      [5, [0x90, 60, 0]],
    ])
    const text = stringifyFixture(f)
    expect(JSON.parse(text)).toEqual(f)
    expect(text).toContain('\n    {"t":0,"data":[144,60,90]},\n')
    expect(JSON.parse(stringifyFixture(fixtureOf([])))).toMatchObject({ messages: [] })
  })
})

// Every committed fixture must stay valid and replay cleanly through the current parser.
const files = import.meta.glob<unknown>('../../../tests/fixtures/*.json', {
  eager: true,
  import: 'default',
})

describe('tests/fixtures', () => {
  it('has at least one fixture', () => {
    expect(Object.keys(files).length).toBeGreaterThan(0)
  })

  for (const [path, json] of Object.entries(files)) {
    it(`${path.split('/').at(-1)} parses and replays with nothing left held`, () => {
      const fixture = parseFixture(json)
      const events = fixtureToSimEvents(fixture)
      const held = new Set<number>()
      let pedal = false
      let last = 0
      for (const e of events) {
        expect(e.at).toBeGreaterThanOrEqual(last)
        last = e.at ?? 0
        if (e.kind === 'noteOn') held.add(e.note)
        else if (e.kind === 'noteOff') held.delete(e.note)
        else if (e.kind === 'pedal') pedal = e.down
      }
      expect([...held]).toEqual([])
      expect(pedal).toBe(false)
    })
  }

  it('the synthetic fixture says it is synthetic and decodes as written', () => {
    const json = Object.entries(files).find(([p]) => p.endsWith('synthetic-chord-and-pedal.json'))
    const fixture = parseFixture(json?.[1])
    expect(fixture.description).toMatch(/^SYNTHETIC/)
    const kinds = fixtureToSimEvents(fixture).map((e) => e.kind)
    expect(kinds).toEqual([
      'noteOn',
      'noteOn',
      'noteOn',
      'pedal',
      'noteOff',
      'noteOff',
      'noteOff',
      'noteOn',
      'noteOff',
      'pedal',
    ])
    expect(analyzeFixture(fixture).ignored).toBe(4)
  })
})
