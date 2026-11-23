import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { InputEvent } from '../input/types.ts'

// A fake engine in place of the Tone.js one (vitest runs in node, with no Web Audio).
const fake = vi.hoisted(() => ({
  handled: [] as unknown[],
  state: 'running' as 'running' | 'suspended' | 'closed',
  onStateChange: null as null | ((s: 'running' | 'suspended' | 'closed') => void),
  presets: [] as string[],
  knobs: [] as unknown[],
  fail: false,
  resumes: 0,
}))

vi.mock('../audio/tone/engine.ts', () => ({
  createEngine: (o: { onStateChange: (s: 'running' | 'suspended' | 'closed') => void }) => {
    if (fake.fail) throw new Error('no audio device')
    fake.onStateChange = o.onStateChange
    return {
      // Like the real engine: note-ons are dropped while the context isn't running.
      handle: (e: InputEvent) => {
        if (e.kind !== 'noteOn' || fake.state === 'running') fake.handled.push(e)
      },
      state: () => fake.state,
      resume: async () => {
        fake.resumes++
      },
      setPreset: (id: string) => fake.presets.push(id),
      setKnob: (...args: unknown[]) => fake.knobs.push(args),
      releaseAll: () => {},
      latency: () => ({
        baseLatencyMs: 10,
        outputLatencyMs: 40,
        outputTimestamp: true,
        sampleRate: 48000,
      }),
      latencyHint: () => 'interactive',
      heldCount: () => 0,
      currentTime: () => 0,
    }
  },
}))

// The store decides "unsupported" from window.AudioContext at import.
vi.stubGlobal('window', { AudioContext: function AudioContext() {} })

const on = (note: number, velocity = 0.8): InputEvent => ({
  kind: 'noteOn',
  note,
  velocity,
  time: 0,
  source: 'midi',
})
const off = (note: number): InputEvent => ({ kind: 'noteOff', note, time: 0, source: 'midi' })

async function load() {
  vi.resetModules()
  return import('./audio.ts')
}

beforeEach(() => {
  fake.handled = []
  fake.state = 'running'
  fake.presets = []
  fake.knobs = []
  fake.fail = false
  fake.resumes = 0
})

describe('audio controller', () => {
  it('starts off; a note while off asks the user to click, once', async () => {
    const { audio, useAudioStore } = await load()
    expect(useAudioStore.getState().status).toBe('off')
    const seen: boolean[] = []
    useAudioStore.subscribe((s) => seen.push(s.notesWaiting))
    audio.handle(on(60))
    audio.handle(on(62))
    expect(useAudioStore.getState().notesWaiting).toBe(true)
    expect(seen).toEqual([true]) // one store change, not one per note
  })

  it('start() runs the engine and reports latency; notes then go to the engine', async () => {
    const { audio, useAudioStore } = await load()
    audio.handle(on(60)) // while off: dropped
    const starting = audio.start()
    expect(useAudioStore.getState().status).toBe('starting')
    expect(audio.start()).toBe(starting) // idempotent
    await starting
    const s = useAudioStore.getState()
    expect(s.status).toBe('running')
    expect(s.notesWaiting).toBe(false)
    expect(s.latency?.outputLatencyMs).toBe(40)
    expect(s.latencyHint).toBe('interactive')
    audio.handle(on(64))
    expect(fake.handled).toEqual([on(64)])
  })

  it('plays notes pressed while loading if they are still held when it is ready', async () => {
    const { audio } = await load()
    const starting = audio.start()
    audio.handle(on(60, 0.5))
    audio.handle(on(62))
    audio.handle(off(62))
    await starting
    expect(fake.handled).toEqual([
      { kind: 'noteOn', note: 60, velocity: 0.5, time: expect.any(Number), source: 'onscreen' },
    ])
  })

  it("a start without user activation can't lock audio out: later gestures resume it", async () => {
    const { audio, useAudioStore } = await load()
    fake.state = 'suspended' // the browser hasn't let the context run (e.g. a held touch)
    await audio.start()
    expect(useAudioStore.getState().status).toBe('starting')
    audio.handle(on(60)) // held while waiting
    void audio.start() // the next gesture
    void audio.start()
    expect(fake.resumes).toBe(2)
    fake.state = 'running'
    fake.onStateChange?.('running')
    expect(useAudioStore.getState().status).toBe('running')
    expect(fake.handled).toEqual([
      { kind: 'noteOn', note: 60, velocity: 0.8, time: expect.any(Number), source: 'onscreen' },
    ])
  })

  it('follows the context: suspended, then running again', async () => {
    const { audio, useAudioStore } = await load()
    await audio.start()
    fake.state = 'suspended'
    fake.onStateChange?.('suspended')
    expect(useAudioStore.getState().status).toBe('suspended')
    audio.handle(on(60))
    expect(useAudioStore.getState().notesWaiting).toBe(true)
    fake.state = 'running'
    fake.onStateChange?.('running')
    expect(useAudioStore.getState()).toMatchObject({ status: 'running', notesWaiting: false })
  })

  it('reports a failed start and can try again', async () => {
    const { audio, useAudioStore } = await load()
    fake.fail = true
    await audio.start()
    expect(useAudioStore.getState()).toMatchObject({ status: 'failed', error: 'no audio device' })
    fake.fail = false
    await audio.start()
    expect(useAudioStore.getState().status).toBe('running')
  })

  it('keeps preset and knob choices before and after the engine exists', async () => {
    const { audio, useAudioStore } = await load()
    expect(useAudioStore.getState().presetId).toBe('funk-lead')
    audio.setPreset('ep-keys')
    audio.setKnob('funk-lead', 'cutoff', 2000)
    expect(useAudioStore.getState().knobs['funk-lead'].cutoff).toBe(2000)
    expect(useAudioStore.getState().knobs['funk-lead'].glide).toBe(0.06)
    await audio.start()
    audio.setPreset('wobble-bass')
    audio.setKnob('wobble-bass', 'drive', 0.9)
    expect(fake.presets).toEqual(['wobble-bass'])
    expect(fake.knobs).toEqual([['wobble-bass', 'drive', 0.9]])
    expect(() => audio.setPreset('nope' as 'ep-keys')).toThrow(/Unknown preset/)
  })
})
