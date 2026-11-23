import { describe, expect, it } from 'vitest'
import type { InputEvent } from '../types.ts'
import {
  createMidiConnection,
  NO_INPUT_HINT_MS,
  type MidiAccessLike,
  type MidiEnv,
  type MidiInputPort,
  type MidiSnapshot,
} from './connection.ts'
import type { PermissionHint } from './onboarding.ts'

class FakePort implements MidiInputPort {
  state = 'connected'
  onmidimessage: MidiInputPort['onmidimessage'] = null
  openResult: Promise<unknown> = Promise.resolve()
  readonly id: string
  readonly name: string | null
  readonly manufacturer: string | null
  constructor(
    id: string,
    name: string | null = 'Digital Keyboard-1',
    manufacturer: string | null = 'Microsoft Corporation',
  ) {
    this.id = id
    this.name = name
    this.manufacturer = manufacturer
  }
  open() {
    return this.openResult
  }
  send(bytes: number[], timeStamp = 0) {
    this.onmidimessage?.({ data: Uint8Array.from(bytes), timeStamp })
  }
}

class FakeAccess implements MidiAccessLike {
  ports = new Map<string, FakePort>()
  onstatechange: MidiAccessLike['onstatechange'] = null
  inputs = { values: () => this.ports.values() }
  plug(port: FakePort) {
    port.state = 'connected'
    this.ports.set(port.id, port)
    this.onstatechange?.({})
  }
  unplug(id: string) {
    const port = this.ports.get(id)
    if (port) port.state = 'disconnected' // stays in the map, as browsers keep the port
    this.onstatechange?.({})
  }
}

interface Options {
  permission?: PermissionHint
  api?: boolean
  reject?: Error
}

function setup({ permission = 'prompt', api = true, reject }: Options = {}) {
  const access = new FakeAccess()
  const events: InputEvent[] = []
  const snapshots: MidiSnapshot[] = []
  const timers = new Map<number, () => void>()
  let nextTimer = 1
  let requests = 0
  const env: MidiEnv = {
    requestAccess: api
      ? async () => {
          requests++
          if (reject) throw reject
          return access
        }
      : null,
    queryPermission: async () => permission,
    now: () => 1000,
    setTimer(fn) {
      const id = nextTimer++
      timers.set(id, fn)
      return id
    },
    clearTimer(handle) {
      timers.delete(handle as number)
    },
  }
  const conn = createMidiConnection(
    env,
    (e) => events.push(e),
    (s) => snapshots.push(s),
  )
  const runTimers = () => {
    const pending = [...timers.values()]
    timers.clear()
    for (const fn of pending) fn()
  }
  return { access, conn, events, snapshots, runTimers, requests: () => requests }
}

describe('createMidiConnection: onboarding', () => {
  it('no Web MIDI API: unsupported', async () => {
    const { conn } = setup({ api: false })
    await conn.start()
    expect(conn.getSnapshot()).toMatchObject({ checking: false, status: 'unsupported' })
  })

  it('first visit: waits for the Connect button, then grants', async () => {
    const t = setup({ permission: 'prompt' })
    t.access.ports.set('a', new FakePort('a'))
    await t.conn.start()
    expect(t.conn.getSnapshot()).toMatchObject({ checking: false, status: 'needsPermission' })
    expect(t.requests()).toBe(0)

    const pending = t.conn.request()
    expect(t.conn.getSnapshot().status).toBe('waitingForAddon')
    await pending
    expect(t.conn.getSnapshot()).toMatchObject({
      status: 'granted',
      inputs: [{ id: 'a', name: 'Digital Keyboard-1', manufacturer: 'Microsoft Corporation' }],
    })
  })

  it('already granted: requests silently on start, never showing the prompt state', async () => {
    const t = setup({ permission: 'granted' })
    t.access.ports.set('a', new FakePort('a'))
    await t.conn.start()
    expect(t.requests()).toBe(1)
    expect(t.snapshots.map((s) => s.status)).not.toContain('waitingForAddon')
    expect(t.conn.getSnapshot()).toMatchObject({ checking: false, status: 'granted' })
  })

  it('rejected request: denied with the error name', async () => {
    const err = new Error('MIDI access was not allowed')
    err.name = 'SecurityError'
    const t = setup({ reject: err })
    await t.conn.start()
    await t.conn.request()
    expect(t.conn.getSnapshot()).toMatchObject({
      status: 'denied',
      error: 'SecurityError: MIDI access was not allowed',
    })
  })

  it('double-clicking Connect makes one request', async () => {
    const t = setup()
    await t.conn.start()
    await Promise.all([t.conn.request(), t.conn.request()])
    await t.conn.request()
    expect(t.requests()).toBe(1)
  })

  it('no device yet: noDevices, then granted when it is plugged in', async () => {
    const t = setup({ permission: 'granted' })
    await t.conn.start()
    expect(t.conn.getSnapshot().status).toBe('noDevices')
    t.access.plug(new FakePort('a'))
    expect(t.conn.getSnapshot().status).toBe('granted')
  })
})

describe('createMidiConnection: messages and hot-plug', () => {
  async function connected() {
    const t = setup({ permission: 'granted' })
    const port = new FakePort('a')
    t.access.ports.set('a', port)
    await t.conn.start()
    return { ...t, port }
  }

  it('parses messages onto the bus, using the event timestamp', async () => {
    const t = await connected()
    t.port.send([0xf8], 1)
    t.port.send([0x90, 60, 127], 2)
    t.port.send([0x90, 60, 0], 3)
    expect(t.events).toEqual([
      { kind: 'noteOn', note: 60, velocity: 1, time: 2, source: 'midi' },
      { kind: 'noteOff', note: 60, time: 3, source: 'midi' },
    ])
  })

  it('unplug: releases held notes and the pedal, detaches, and shows noDevices', async () => {
    const t = await connected()
    t.port.send([0x90, 60, 100])
    t.port.send([0xb0, 64, 127])
    t.events.length = 0
    t.access.unplug('a')
    expect(t.events).toEqual([
      { kind: 'noteOff', note: 60, time: 1000, source: 'midi' },
      { kind: 'pedal', down: false, time: 1000, source: 'midi' },
    ])
    expect(t.port.onmidimessage).toBeNull()
    expect(t.conn.getSnapshot()).toMatchObject({ status: 'noDevices', inputs: [] })
  })

  it('replug as the same port object: recovers', async () => {
    const t = await connected()
    t.access.unplug('a')
    t.access.plug(t.port)
    expect(t.conn.getSnapshot().status).toBe('granted')
    t.port.send([0x90, 62, 100])
    expect(t.events.at(-1)).toMatchObject({ kind: 'noteOn', note: 62 })
  })

  it('replug as a new port object with the same id: recovers on the new object', async () => {
    const t = await connected()
    t.access.unplug('a')
    const fresh = new FakePort('a')
    t.access.plug(fresh)
    expect(t.conn.getSnapshot().status).toBe('granted')
    fresh.send([0x90, 64, 100])
    expect(t.events.at(-1)).toMatchObject({ kind: 'noteOn', note: 64 })
  })

  it('a new port object replacing a still-connected one: releases the old one first', async () => {
    const t = await connected()
    t.port.send([0x90, 60, 100])
    t.events.length = 0
    const fresh = new FakePort('a')
    t.access.plug(fresh) // same id, no disconnect seen in between
    expect(t.events).toEqual([{ kind: 'noteOff', note: 60, time: 1000, source: 'midi' }])
    expect(t.port.onmidimessage).toBeNull()
    expect(fresh.onmidimessage).not.toBeNull()
  })

  it('select: only the chosen input reaches the bus; deselected held notes are released', async () => {
    const t = await connected()
    const other = new FakePort('b', 'Other', '')
    t.access.plug(other)
    other.send([0x90, 70, 100])
    t.conn.select('a')
    expect(t.events.at(-1)).toEqual({ kind: 'noteOff', note: 70, time: 1000, source: 'midi' })
    t.events.length = 0
    other.send([0x90, 71, 100])
    t.port.send([0x90, 72, 100])
    expect(t.events.map((e) => (e.kind === 'noteOn' ? e.note : null))).toEqual([72])
    t.conn.select(null)
    other.send([0x90, 73, 100])
    expect(t.events.at(-1)).toMatchObject({ kind: 'noteOn', note: 73 })
  })

  it('unplugging the selected input falls back to all inputs', async () => {
    const t = await connected()
    const other = new FakePort('b', 'Other', '')
    t.access.plug(other)
    t.conn.select('a')
    t.access.unplug('a')
    expect(t.conn.getSnapshot().selectedId).toBeNull()
    other.send([0x90, 74, 100])
    expect(t.events.at(-1)).toMatchObject({ kind: 'noteOn', note: 74 })
  })

  it('dispose: releases everything and detaches', async () => {
    const t = await connected()
    t.port.send([0x90, 60, 100])
    t.conn.dispose()
    expect(t.events.at(-1)).toMatchObject({ kind: 'noteOff', note: 60 })
    expect(t.port.onmidimessage).toBeNull()
    expect(t.access.onstatechange).toBeNull()
  })
})

describe('createMidiConnection: "no input yet" hint (device may be busy)', () => {
  it(`shows after ${NO_INPUT_HINT_MS} ms of silence, and clears on the first byte`, async () => {
    const t = setup({ permission: 'granted' })
    const port = new FakePort('a')
    t.access.ports.set('a', port)
    await t.conn.start()
    expect(t.conn.getSnapshot().noInputYet).toBe(false)
    t.runTimers()
    expect(t.conn.getSnapshot().noInputYet).toBe(true)
    port.send([0xfe]) // active sensing counts: the port is delivering
    expect(t.conn.getSnapshot().noInputYet).toBe(false)
  })

  it('never shows if a message arrives first', async () => {
    const t = setup({ permission: 'granted' })
    const port = new FakePort('a')
    t.access.ports.set('a', port)
    await t.conn.start()
    port.send([0xf8])
    t.runTimers()
    expect(t.conn.getSnapshot().noInputYet).toBe(false)
  })

  it('shows at once if the port fails to open', async () => {
    const t = setup({ permission: 'granted' })
    const port = new FakePort('a')
    port.openResult = Promise.reject(new Error('InvalidAccessError'))
    t.access.ports.set('a', port)
    await t.conn.start()
    await Promise.resolve()
    expect(t.conn.getSnapshot().noInputYet).toBe(true)
  })

  it('clears when the device is unplugged, and re-arms on replug', async () => {
    const t = setup({ permission: 'granted' })
    const port = new FakePort('a')
    t.access.ports.set('a', port)
    await t.conn.start()
    t.runTimers()
    t.access.unplug('a')
    expect(t.conn.getSnapshot().noInputYet).toBe(false)
    t.access.plug(port)
    t.runTimers()
    expect(t.conn.getSnapshot().noInputYet).toBe(true)
  })
})

describe('createMidiConnection: raw tap (fixture recording)', () => {
  it('hears every raw message from listened inputs, clock included, until unsubscribed', async () => {
    const t = setup({ permission: 'granted' })
    const a = new FakePort('a')
    const b = new FakePort('b', 'Other', '')
    t.access.ports.set('a', a)
    t.access.ports.set('b', b)
    await t.conn.start()
    const heard: [number[], number, string][] = []
    const untap = t.conn.tapRaw((data, time, name) => heard.push([[...data], time, name]))
    a.send([0xf8], 1)
    a.send([0x90, 60, 100], 2)
    t.conn.select('a')
    b.send([0x90, 62, 100], 3) // not listened to
    untap()
    a.send([0x90, 60, 0], 4)
    expect(heard).toEqual([
      [[0xf8], 1, 'Digital Keyboard-1'],
      [[0x90, 60, 100], 2, 'Digital Keyboard-1'],
    ])
    expect(t.events.filter((e) => e.kind === 'noteOn')).toHaveLength(1)
  })
})
