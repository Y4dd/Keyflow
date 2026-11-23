// Dev-only event inspector: a live log of InputEvents and a recorder that saves raw MIDI from
// the real keyboard as a fixture (tests/fixtures/). Loaded only when __KEYFLOW_DEV_TOOLS__.

import { useEffect, useRef, useState } from 'react'
import { inputBus } from '../input/bus.ts'
import { detectBrowser } from '../input/midi/browser.ts'
import {
  analyzeFixture,
  createFixtureRecorder,
  fixtureToSimEvents,
  parseFixture,
  stringifyFixture,
  type FixtureAnalysis,
  type FixtureRecorder,
  type MidiFixture,
} from '../input/sim/fixture.ts'
import type { InputEvent } from '../input/types.ts'
import { midi, useMidiStore } from '../state/midi.ts'
import { simPlayer } from './devtools.ts'

const LOG_SIZE = 30

function describe(e: InputEvent): string {
  const head = `${e.time.toFixed(1).padStart(10)}  ${e.source.padEnd(8)} ${e.kind.padEnd(7)}`
  switch (e.kind) {
    case 'noteOn':
      return `${head} ${e.note} vel ${e.velocity.toFixed(2)}`
    case 'noteOff':
      return `${head} ${e.note}`
    case 'pedal':
      return `${head} ${e.down ? 'down' : 'up'}`
    case 'bend':
      return `${head} ${e.semitones}`
  }
}

function perChannel(counts: number[]): string {
  const used = counts.flatMap((n, ch) => (n > 0 ? [`ch ${ch + 1}: ${n}`] : []))
  return used.length > 0 ? used.join(', ') : 'none'
}

function download(fixture: MidiFixture) {
  const stamp = fixture.recordedAt.slice(0, 19).replace(/[-:]/g, '').replace('T', '-')
  const url = URL.createObjectURL(
    new Blob([stringifyFixture(fixture)], { type: 'application/json' }),
  )
  const a = document.createElement('a')
  a.href = url
  a.download = `midi-fixture-${stamp}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function Inspector() {
  const status = useMidiStore((s) => s.status)
  const logRef = useRef<HTMLPreElement>(null)
  const recorderRef = useRef<{ recorder: FixtureRecorder; untap: () => void } | null>(null)
  const devicesRef = useRef(new Set<string>())
  const [recording, setRecording] = useState(false)
  const [count, setCount] = useState(0)
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [last, setLast] = useState<{ fixture: MidiFixture; analysis: FixtureAnalysis } | null>(null)

  useEffect(() => {
    const lines: string[] = []
    let frame = 0
    const render = () => {
      frame = 0
      if (logRef.current) logRef.current.textContent = lines.join('\n') || 'No events yet.'
    }
    render()
    const unsubscribe = inputBus.subscribe((event) => {
      lines.unshift(describe(event))
      if (lines.length > LOG_SIZE) lines.length = LOG_SIZE
      if (frame === 0) frame = requestAnimationFrame(render)
    })
    return () => {
      unsubscribe()
      cancelAnimationFrame(frame)
      recorderRef.current?.untap()
    }
  }, [])

  useEffect(() => {
    if (!recording) return
    const id = setInterval(() => setCount(recorderRef.current?.recorder.messageCount() ?? 0), 250)
    return () => clearInterval(id)
  }, [recording])

  const start = () => {
    const recorder = createFixtureRecorder(performance.now())
    devicesRef.current = new Set()
    const untap = midi.tapRaw((data, time, name) => {
      recorder.add(data, time)
      devicesRef.current.add(name)
    })
    recorderRef.current = { recorder, untap }
    setCount(0)
    setRecording(true)
  }

  const stop = () => {
    const current = recorderRef.current
    if (!current) return
    current.untap()
    recorderRef.current = null
    setRecording(false)
    const fixture = current.recorder.finish(
      {
        description: description.trim() || 'Recorded with the dev inspector.',
        devices: [...devicesRef.current],
        browser: detectBrowser(),
        recordedAt: new Date().toISOString(),
      },
      performance.now(),
    )
    setLast({ fixture, analysis: analyzeFixture(fixture) })
    // Check the file as the tests will read it; save it either way so nothing played is lost.
    try {
      parseFixture(JSON.parse(stringifyFixture(fixture)))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    download(fixture)
  }

  return (
    <section className="panel dev" aria-label="Dev inspector">
      <h2>Dev inspector</h2>
      <p className="muted">
        Dev builds only. Recording saves the raw MIDI messages (clock and active sensing are only
        counted) as a fixture file for <code>tests/fixtures/</code>.
      </p>
      <label className="dev-field">
        What you'll play{' '}
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. single notes, chords, a fast run, pedal holds, a voice change"
          disabled={recording}
        />
      </label>
      <div className="dev-actions">
        {recording ? (
          <button type="button" onClick={stop}>
            Stop and save ({count} messages)
          </button>
        ) : (
          <button type="button" onClick={start} disabled={status !== 'granted'}>
            Record MIDI
          </button>
        )}
        {last && !recording && (
          <button
            type="button"
            onClick={() => void simPlayer.play(fixtureToSimEvents(last.fixture))}
          >
            Replay recording
          </button>
        )}
        <button type="button" onClick={() => simPlayer.stop()}>
          Stop sim
        </button>
      </div>
      {status !== 'granted' && <p className="muted">Connect a MIDI keyboard to record.</p>}
      {error && (
        <p className="hint" role="alert">
          The saved file won't pass the fixture tests: {error}
        </p>
      )}
      {last && (
        <dl className="live">
          <dt>Saved</dt>
          <dd>
            {last.analysis.messages} messages, {(last.fixture.durationMs / 1000).toFixed(1)} s
          </dd>
          <dt>Note-ons</dt>
          <dd>{perChannel(last.analysis.noteOnsByChannel)}</dd>
          <dt>Pedal (CC64)</dt>
          <dd>{perChannel(last.analysis.pedalByChannel)}</dd>
          <dt>Same pitch on two channels</dt>
          <dd>{last.analysis.samePitchOnTwoChannels}</dd>
          <dt>Held at the end</dt>
          <dd>{last.analysis.heldAtEnd.join(' ') || 'none'}</dd>
          <dt>Ignored messages</dt>
          <dd>{last.analysis.ignored}</dd>
        </dl>
      )}
      <pre ref={logRef} className="dev-log" data-testid="event-log" />
    </section>
  )
}
