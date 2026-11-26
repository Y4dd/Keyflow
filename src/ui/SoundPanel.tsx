import { knobToPosition, positionToKnob } from '../audio/curves.ts'
import { useSyncExternalStore, type ChangeEvent } from 'react'
import { Note } from 'tonal'
import { MAX_BEND_TIME_MS, type PedalMode } from '../audio/expression.ts'
import { getPreset, PRESETS } from '../audio/presets/index.ts'
import type { KnobSpec, PresetId } from '../audio/presets/types.ts'
import { GLIDE_HOLD_MIN_S } from '../audio/voices.ts'
import { MAX_OCTAVE, MIN_OCTAVE, type ZoneId } from '../audio/zones.ts'
import { BEND_KEYS } from '../input/computer/bend.ts'
import { audio, useAudioStore } from '../state/audio.ts'
import { laptopBend } from '../state/input.ts'
import { midi, useMidiStore } from '../state/midi.ts'

const SLIDER_STEPS = 1000

function formatKnob(value: number, spec: KnobSpec): string {
  switch (spec.unit) {
    case 'Hz':
      return value >= 1000 ? `${(value / 1000).toFixed(1)} kHz` : `${Math.round(value)} Hz`
    case 's':
      return `${Math.round(value * 1000)} ms`
    case '%':
      return `${Math.round(value * 100)}%`
  }
}

const ms = (v: number) => `${Math.round(v)} ms`

function StatusLine() {
  const { status, error, notesWaiting, latency, startedBefore } = useAudioStore()
  const start = () => void audio.start()
  switch (status) {
    case 'unsupported':
      return <p>This browser can't play audio from web pages. Use Firefox or Chrome.</p>
    case 'off':
    case 'starting':
      // One branch for both, and nothing appears or disappears until sound runs: pressing the
      // button starts audio on pointerdown (attachAudioUnlock), so the layout must not shift
      // under the pointer before its click.
      return (
        <>
          {notesWaiting && (
            <p className="hint" role="status">
              Your keyboard is playing, but sound is off. Click anywhere on the page to hear it.
            </p>
          )}
          <p role="status">
            {status === 'starting'
              ? 'Starting audio...'
              : startedBefore
                ? 'Your sound settings are back. Click anywhere or press a key to turn sound on.'
                : 'Browsers start sound only after a click or key press on the page.'}
          </p>
          <button type="button" onClick={start}>
            Start audio
          </button>
        </>
      )
    case 'suspended':
      return (
        <>
          <p className="hint" role="status">
            The browser paused the sound. Click anywhere on the page to turn it back on.
          </p>
          <button type="button" onClick={start}>
            Resume audio
          </button>
        </>
      )
    case 'failed':
      return (
        <>
          <p className="hint" role="alert">
            Sound couldn't start{error ? `: ${error}` : ''}. Reload the page and try again.
          </p>
          <button type="button" onClick={start}>
            Try again
          </button>
        </>
      )
    case 'running':
      return (
        <p data-testid="audio-latency">
          Sound is on. Output latency:{' '}
          {latency?.outputLatencyMs != null
            ? `${ms(latency.outputLatencyMs)} (the browser's estimate)`
            : 'not reported by this browser'}
          .
        </p>
      )
  }
}

// Split points offered in the menu: every key of the 61 but the lowest (C2 + 1 to C7). A
// point set by pressing a key outside that range is added to the menu.
const SPLIT_MENU_LOW = 37
const SPLIT_MENU_HIGH = 96

const name = (note: number) => Note.fromMidiSharps(note)

// A focused menu takes the computer keys (type-ahead: A would pick A2), so let go after a choice.
const blur = (e: ChangeEvent<HTMLSelectElement>) => e.currentTarget.blur()
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')

function SplitControls() {
  const split = useAudioStore((s) => s.layout.split)
  const splitNote = useAudioStore((s) => s.layout.splitNote)
  const learning = useAudioStore((s) => s.learningSplit)
  const notes: number[] = []
  for (let n = SPLIT_MENU_LOW; n <= SPLIT_MENU_HIGH; n++) notes.push(n)
  if (!notes.includes(splitNote)) notes.push(splitNote)
  notes.sort((a, b) => a - b)

  return (
    <fieldset className="split">
      <legend>Keyboard</legend>
      <label className="check">
        <input type="checkbox" checked={split} onChange={(e) => audio.setSplit(e.target.checked)} />
        Split keyboard
      </label>
      {split && (
        <>
          <div className="split-point">
            <label>
              Split point{' '}
              <select
                value={splitNote}
                onChange={(e) => {
                  audio.setSplitNote(Number(e.target.value))
                  blur(e)
                }}
              >
                {notes.map((n) => (
                  <option key={n} value={n}>
                    {name(n)}
                  </option>
                ))}
              </select>
            </label>
            {learning ? (
              <>
                <span className="hint" role="status">
                  Press the lowest key for the main sound.
                </span>
                <button type="button" onClick={() => audio.learnSplit(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" onClick={() => audio.learnSplit(true)}>
                Set by pressing a key
              </button>
            )}
          </div>
          <p className="muted" data-testid="split-summary">
            Keys below {name(splitNote)} play the left sound; {name(splitNote)} and up play the main
            sound.
          </p>
        </>
      )}
    </fieldset>
  )
}

function Knobs({ presetId }: { presetId: PresetId }) {
  const knobs = useAudioStore((s) => s.knobs[presetId])
  const preset = getPreset(presetId)
  return (
    <div className="knobs">
      {Object.entries(preset.knobs).map(([id, spec]: [string, KnobSpec]) => {
        const value = knobs[id] ?? spec.default
        return (
          <label key={`${presetId}-${id}`} className="knob">
            <span>{spec.label}</span>
            <input
              type="range"
              min={0}
              max={SLIDER_STEPS}
              value={Math.round(
                knobToPosition(value, spec.min, spec.max, spec.curve) * SLIDER_STEPS,
              )}
              onChange={(e) =>
                audio.setKnob(
                  presetId,
                  id,
                  positionToKnob(
                    Number(e.target.value) / SLIDER_STEPS,
                    spec.min,
                    spec.max,
                    spec.curve,
                  ),
                )
              }
            />
            <output>{formatKnob(value, spec)}</output>
          </label>
        )
      })}
    </div>
  )
}

const OCTAVES: number[] = []
for (let o = MIN_OCTAVE; o <= MAX_OCTAVE; o++) OCTAVES.push(o)

function ZoneControls({ zone, title, keys }: { zone: ZoneId; title: string; keys: string }) {
  const { presetId, octave } = useAudioStore((s) => s.layout[zone])
  return (
    <fieldset className="zone">
      <legend>
        {title} <span className="muted">{keys}</span>
      </legend>
      <div className="presets" role="radiogroup" aria-label={`${title} preset`}>
        {PRESETS.map((p) => (
          <label key={p.id} className="preset">
            <input
              type="radio"
              name={`preset-${zone}`}
              value={p.id}
              checked={p.id === presetId}
              onChange={() => audio.setZonePreset(zone, p.id)}
            />
            <span>
              <strong>{p.name}</strong> <span className="muted">{p.description}</span>
            </span>
          </label>
        ))}
      </div>
      <label className="octave">
        Octave{' '}
        <select
          value={octave}
          onChange={(e) => {
            audio.setZoneOctave(zone, Number(e.target.value))
            blur(e)
          }}
        >
          {OCTAVES.map((o) => (
            <option key={o} value={o}>
              {signed(o)}
            </option>
          ))}
        </select>
      </label>
      <Knobs presetId={presetId} />
    </fieldset>
  )
}

const PEDAL_MODES: { mode: PedalMode; label: string; text: string }[] = [
  { mode: 'sustain', label: 'Sustain', text: 'holds the notes you lift until the pedal comes up.' },
  { mode: 'bend', label: 'Bend', text: 'bends the main sound up while the pedal is down.' },
  {
    mode: 'glideHold',
    label: 'Glide-hold',
    text: `the main sound glides into every note while the pedal is down, at its glide time but at least ${GLIDE_HOLD_MIN_S * 1000} ms (Funk Lead's Glide time knob, a fixed glide on Wobble Bass, none on EP Keys).`,
  },
]

function PedalControls() {
  const { pedalMode, bendSemitones, bendTimeMs } = useAudioStore((s) => s.expression)
  const invert = useMidiStore((s) => s.invertPedal)
  const bendKey = useSyncExternalStore(laptopBend.subscribe, laptopBend.getKey)

  return (
    <fieldset className="pedal">
      <legend>Pedal and bend</legend>
      <div className="presets" role="radiogroup" aria-label="Pedal">
        {PEDAL_MODES.map(({ mode, label, text }) => (
          <label key={mode} className="preset">
            <input
              type="radio"
              name="pedal-mode"
              value={mode}
              checked={mode === pedalMode}
              onChange={() => audio.setExpression({ pedalMode: mode })}
            />
            <span>
              <strong>{label}</strong> <span className="muted">{text}</span>
            </span>
          </label>
        ))}
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={invert}
          onChange={(e) => midi.setInvertPedal(e.target.checked)}
        />
        Invert pedal <span className="muted">(if the Play panel shows it down when it's up)</span>
      </label>
      <div className="split-point">
        <label>
          Bend amount{' '}
          <select
            value={bendSemitones}
            onChange={(e) => {
              audio.setExpression({ bendSemitones: e.target.value === '1' ? 1 : 2 })
              blur(e)
            }}
          >
            <option value={1}>1 semitone</option>
            <option value={2}>2 semitones</option>
          </select>
        </label>
        <label>
          Bend key{' '}
          <select
            value={bendKey ?? ''}
            onChange={(e) => {
              laptopBend.setKey(e.target.value || null, performance.now())
              blur(e)
            }}
          >
            {BEND_KEYS.map((k) => (
              <option key={k.code} value={k.code}>
                {k.label}
              </option>
            ))}
            <option value="">Off</option>
          </select>
        </label>
      </div>
      <div className="knobs">
        <label className="knob">
          <span>Bend time</span>
          <input
            type="range"
            min={0}
            max={MAX_BEND_TIME_MS}
            step={10}
            value={bendTimeMs}
            onChange={(e) => audio.setExpression({ bendTimeMs: Number(e.target.value) })}
          />
          <output>{bendTimeMs} ms</output>
        </label>
      </div>
      <p className="muted">
        Bends move the main sound. Hold the bend key, or scroll over the on-screen keys for a bend
        that springs back when you stop.
      </p>
    </fieldset>
  )
}

export function SoundPanel() {
  const status = useAudioStore((s) => s.status)
  const split = useAudioStore((s) => s.layout.split)
  const splitNote = useAudioStore((s) => s.layout.splitNote)

  return (
    <section className="panel" aria-label="Sound">
      <h2>Sound</h2>
      <div data-testid="audio-status" data-status={status}>
        <StatusLine />
      </div>
      <SplitControls />
      <PedalControls />
      <div className="zones">
        {split && <ZoneControls zone="left" title="Left sound" keys={`below ${name(splitNote)}`} />}
        <ZoneControls
          zone="main"
          title="Main sound"
          keys={split ? `${name(splitNote)} and up` : 'whole keyboard'}
        />
      </div>
    </section>
  )
}
