// P0-T2 hardware and browser check. Throwaway spike: delete once P0-T3 lands the real MIDI layer.
// Deliberately standalone (no React, no shared modules) so it can't leak into the app.
import * as Tone from 'tone'
import { Note } from 'tonal'
import '../index.css'
import './hardware.css'

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id)
  if (!node) throw new Error(`#${id} is missing from hardware.html`)
  return node as T
}

const isFirefox = /firefox/i.test(navigator.userAgent)
if (isFirefox) el('firefox-only').hidden = false

const midiToHz = (n: number) => 440 * 2 ** ((n - 69) / 12)
const noteLabel = (n: number) => `${n} (${Note.fromMidi(n)})`
const hex = (data: ArrayLike<number>) =>
  Array.from(data, (b) => b.toString(16).padStart(2, '0')).join(' ')
const round = (x: number, digits = 2) => Math.round(x * 10 ** digits) / 10 ** digits

// ---------------------------------------------------------------- state

type RequestResult = {
  startedAt: string
  elapsedMs: number | null
  outcome: 'pending' | 'granted' | 'rejected'
  error?: { name: string; message: string }
}

const report = {
  spike: 'P0-T2',
  generatedAt: '',
  browser: {
    userAgent: navigator.userAgent,
    isFirefox,
    secureContext: window.isSecureContext,
    origin: location.origin,
  },
  audio: {
    started: false,
    toneOnNativeContext: null as null | 'ok' | string,
    sampleRate: null as number | null,
    baseLatencyMs: null as number | null,
    outputLatencyMs: null as number | null,
    outputLatencyMsSamples: [] as number[],
    getOutputTimestampSupported: null as boolean | null,
    outputTimestampSample: null as null | { contextTime: number; performanceTime: number },
  },
  midi: {
    apiAvailable: 'requestMIDIAccess' in navigator,
    permissionBefore: null as string | null,
    permissionAfter: null as string | null,
    requests: [] as RequestResult[],
    inputs: [] as Record<string, string | null>[],
    outputs: [] as Record<string, string | null>[],
    stateChanges: [] as string[],
  },
  played: {
    noteOns: 0,
    noteOffs0x80: 0,
    noteOnVelocity0: 0,
    lowest: null as string | null,
    highest: null as string | null,
    velocityMin: null as number | null,
    velocityMax: null as number | null,
    cc64Values: [] as number[],
    cc64Events: 0,
    otherControllers: {} as Record<string, number>,
    channels: [] as number[],
    clockMessages: 0,
    activeSensingMessages: 0,
    otherMessages: {} as Record<string, number>,
    handlerDelayMs: null as null | { count: number; min: number; median: number; max: number },
  },
  manual: {} as Record<string, string>,
}

let lowest = Infinity
let highest = -Infinity
const cc64 = new Set<number>()
const channels = new Set<number>()
const delays: number[] = []
const logLines: string[] = []

// ---------------------------------------------------------------- rendering (batched per frame)

let dirty = false
function invalidate() {
  if (dirty) return
  dirty = true
  requestAnimationFrame(render)
}

function facts(target: HTMLElement, rows: [string, unknown][]) {
  target.replaceChildren(
    ...rows.flatMap(([k, v]) => {
      const dt = document.createElement('dt')
      dt.textContent = k
      const dd = document.createElement('dd')
      dd.textContent = v === null || v === undefined ? '-' : String(v)
      return [dt, dd]
    }),
  )
}

function render() {
  dirty = false
  const a = report.audio
  facts(el('audio-info'), [
    ['Started', a.started],
    ['Tone on native context', a.toneOnNativeContext],
    ['Sample rate', a.sampleRate],
    ['baseLatency (ms)', a.baseLatencyMs],
    ['outputLatency (ms)', a.outputLatencyMs],
    ['getOutputTimestamp', a.getOutputTimestampSupported],
  ])
  const p = report.played
  facts(el('stats'), [
    ['Note-ons', p.noteOns],
    ['Note-offs (0x80 / note-on vel 0)', `${p.noteOffs0x80} / ${p.noteOnVelocity0}`],
    ['Lowest / highest note', `${p.lowest ?? '-'} / ${p.highest ?? '-'}`],
    ['Velocity min / max', `${p.velocityMin ?? '-'} / ${p.velocityMax ?? '-'}`],
    ['Pedal (CC64) values seen', p.cc64Values.join(', ') || '-'],
    ['Channels', p.channels.join(', ') || '-'],
    [
      'Handler delay ms (min / median / max)',
      p.handlerDelayMs
        ? `${p.handlerDelayMs.min} / ${p.handlerDelayMs.median} / ${p.handlerDelayMs.max}`
        : '-',
    ],
    ['Clock / active-sensing messages', `${p.clockMessages} / ${p.activeSensingMessages}`],
  ])
  el('log').textContent = logLines.join('\n')
  report.generatedAt = new Date().toISOString()
  report.manual = readManual()
  el('report').textContent = JSON.stringify(report, null, 2)
}

function log(line: string) {
  logLines.unshift(`${(performance.now() / 1000).toFixed(3)}s  ${line}`)
  if (logLines.length > 200) logLines.length = 200
  invalidate()
}

// ---------------------------------------------------------------- audio

let ctx: AudioContext | null = null
let synth: Tone.PolySynth | null = null

function sampleLatency() {
  if (!ctx) return
  const a = report.audio
  a.baseLatencyMs = typeof ctx.baseLatency === 'number' ? round(ctx.baseLatency * 1000) : null
  if (typeof ctx.outputLatency === 'number') {
    a.outputLatencyMs = round(ctx.outputLatency * 1000)
    if (a.outputLatencyMsSamples.length < 30) a.outputLatencyMsSamples.push(a.outputLatencyMs)
  }
  a.getOutputTimestampSupported = typeof ctx.getOutputTimestamp === 'function'
  if (a.getOutputTimestampSupported) {
    const ts = ctx.getOutputTimestamp()
    a.outputTimestampSample = {
      contextTime: round(ts.contextTime ?? NaN, 4),
      performanceTime: round(ts.performanceTime ?? NaN, 1),
    }
  }
  invalidate()
}

el('start-audio').addEventListener('click', async () => {
  if (ctx) return
  // A native context, so the readouts are the browser's own values rather than a wrapper's.
  ctx = new AudioContext({ latencyHint: 'interactive' })
  report.audio.sampleRate = ctx.sampleRate
  try {
    Tone.setContext(ctx)
    await Tone.start()
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.003, decay: 0.1, sustain: 0.8, release: 0.25 },
    }).toDestination()
    synth.volume.value = -10
    report.audio.toneOnNativeContext = 'ok'
  } catch (err) {
    report.audio.toneOnNativeContext = err instanceof Error ? err.message : String(err)
    await ctx.resume()
  }
  report.audio.started = ctx.state === 'running'
  el<HTMLButtonElement>('start-audio').disabled = true
  sampleLatency()
  // outputLatency can change once audio is actually flowing, so keep sampling for a while.
  const timer = setInterval(sampleLatency, 1000)
  setTimeout(() => clearInterval(timer), 30_000)
  log(`audio started, state=${ctx.state}`)
})

el('panic').addEventListener('click', () => {
  synth?.releaseAll(Tone.immediate())
  log('all notes released')
})

// ---------------------------------------------------------------- MIDI

function handleMessage(data: Uint8Array, eventTime: number) {
  const delay = performance.now() - eventTime
  if (data.length === 0) return
  const status = data[0]
  if (status === 0xf8) {
    report.played.clockMessages++
    return invalidate()
  }
  if (status === 0xfe) {
    report.played.activeSensingMessages++
    return invalidate()
  }

  delays.push(delay)
  if (delays.length > 500) delays.shift()
  const sorted = [...delays].sort((x, y) => x - y)
  report.played.handlerDelayMs = {
    count: delays.length,
    min: round(sorted[0]),
    median: round(sorted[Math.floor(sorted.length / 2)]),
    max: round(sorted[sorted.length - 1]),
  }

  const type = status & 0xf0
  const channel = (status & 0x0f) + 1
  const [, d1 = 0, d2 = 0] = data
  const p = report.played
  if (status < 0xf0) {
    channels.add(channel)
    p.channels = [...channels].sort((x, y) => x - y)
  }

  if (type === 0x90 && d2 > 0) {
    p.noteOns++
    if (d1 < lowest) {
      lowest = d1
      p.lowest = noteLabel(d1)
    }
    if (d1 > highest) {
      highest = d1
      p.highest = noteLabel(d1)
    }
    p.velocityMin = Math.min(p.velocityMin ?? 127, d2)
    p.velocityMax = Math.max(p.velocityMax ?? 0, d2)
    synth?.triggerAttack(midiToHz(d1), Tone.immediate(), d2 / 127)
    log(`[${hex(data)}] note-on  ${noteLabel(d1)} vel ${d2} ch ${channel}`)
  } else if (type === 0x80 || type === 0x90) {
    if (type === 0x80) p.noteOffs0x80++
    else p.noteOnVelocity0++
    synth?.triggerRelease(midiToHz(d1), Tone.immediate())
    const how = type === 0x80 ? '0x80' : 'note-on vel 0'
    log(`[${hex(data)}] note-off ${noteLabel(d1)} (${how}) ch ${channel}`)
  } else if (type === 0xb0) {
    if (d1 === 64) {
      p.cc64Events++
      cc64.add(d2)
      p.cc64Values = [...cc64].sort((x, y) => x - y)
      log(`[${hex(data)}] pedal CC64 = ${d2} ch ${channel}`)
    } else {
      p.otherControllers[d1] = (p.otherControllers[d1] ?? 0) + 1
      log(`[${hex(data)}] CC${d1} = ${d2} ch ${channel}`)
    }
  } else {
    const key = status >= 0xf0 ? hex([status]) : hex([type])
    p.otherMessages[key] = (p.otherMessages[key] ?? 0) + 1
    log(`[${hex(data)}] other`)
  }
}

function describePort(port: MIDIPort): Record<string, string | null> {
  return {
    name: port.name,
    manufacturer: port.manufacturer,
    version: port.version,
    state: port.state,
    connection: port.connection,
  }
}

function attachInputs(access: MIDIAccess) {
  const list = el('inputs')
  list.replaceChildren()
  report.midi.inputs = []
  report.midi.outputs = [...access.outputs.values()].map(describePort)
  for (const input of access.inputs.values()) {
    report.midi.inputs.push(describePort(input))
    const li = document.createElement('li')
    li.textContent = `${input.name ?? '(no name)'} - ${input.manufacturer || 'unknown maker'} - ${input.state}`
    list.append(li)
    input.onmidimessage = (e) => {
      if (e.data) handleMessage(e.data, e.timeStamp)
    }
  }
  el('midi-status').textContent =
    access.inputs.size === 0
      ? 'Access granted, but no inputs. Is the keyboard on and plugged in? Is another app using it?'
      : `Access granted. ${access.inputs.size} input(s). Play something.`
  invalidate()
}

async function queryPermission(): Promise<string> {
  try {
    const status = await navigator.permissions.query({ name: 'midi' as PermissionName })
    return status.state
  } catch (err) {
    return `query failed: ${err instanceof Error ? err.message : String(err)}`
  }
}

el('request-midi').addEventListener('click', async () => {
  if (!report.midi.apiAvailable) {
    el('midi-status').textContent = 'This browser has no Web MIDI API.'
    return
  }
  report.midi.permissionBefore ??= await queryPermission()
  const result: RequestResult = {
    startedAt: new Date().toISOString(),
    elapsedMs: null,
    outcome: 'pending',
  }
  report.midi.requests.push(result)
  el('midi-status').textContent =
    'Requesting access... (Firefox may ask you to add a site permission)'
  const t0 = performance.now()
  try {
    const access = await navigator.requestMIDIAccess({ sysex: false })
    result.elapsedMs = Math.round(performance.now() - t0)
    result.outcome = 'granted'
    log(`MIDI access granted after ${result.elapsedMs} ms`)
    attachInputs(access)
    access.onstatechange = (e) => {
      const port = (e as MIDIConnectionEvent).port
      const line = port
        ? `${port.type} "${port.name}" ${port.state}/${port.connection}`
        : 'statechange without port'
      report.midi.stateChanges.push(`${new Date().toISOString()} ${line}`)
      log(`statechange: ${line}`)
      attachInputs(access)
    }
  } catch (err) {
    result.elapsedMs = Math.round(performance.now() - t0)
    result.outcome = 'rejected'
    result.error =
      err instanceof Error
        ? { name: err.name, message: err.message }
        : { name: 'unknown', message: String(err) }
    el('midi-status').textContent = `Rejected: ${result.error.name}: ${result.error.message}`
    log(`MIDI access rejected after ${result.elapsedMs} ms`)
  }
  report.midi.permissionAfter = await queryPermission()
  invalidate()
})

// ---------------------------------------------------------------- manual answers and report

function readManual(): Record<string, string> {
  const form = el<HTMLFormElement>('manual')
  const out: Record<string, string> = {}
  for (const [k, v] of new FormData(form)) if (typeof v === 'string' && v) out[k] = v
  return out
}

el('manual').addEventListener('input', invalidate)
el('manual').addEventListener('change', invalidate)

el('copy-report').addEventListener('click', async () => {
  render()
  const text = el('report').textContent ?? ''
  const status = el('copy-status')
  try {
    await navigator.clipboard.writeText(text)
    status.textContent = 'Copied. Paste it into the chat.'
  } catch {
    const range = document.createRange()
    range.selectNodeContents(el('report'))
    getSelection()?.removeAllRanges()
    getSelection()?.addRange(range)
    status.textContent = 'Clipboard blocked: the report is selected, press Ctrl+C.'
  }
})

// Dev only: lets the AI drive this page without a keyboard.
if (import.meta.env.DEV) {
  Object.assign(window, {
    __spike: { feed: (bytes: number[]) => handleMessage(new Uint8Array(bytes), performance.now()) },
  })
}

render()
