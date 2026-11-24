import { knobToPosition, positionToKnob } from '../audio/curves.ts'
import type { ChangeEvent } from 'react'
import { Note } from 'tonal'
import { getPreset, PRESETS } from '../audio/presets/index.ts'
import type { KnobSpec, PresetId } from '../audio/presets/types.ts'
import { MAX_OCTAVE, MIN_OCTAVE, type ZoneId } from '../audio/zones.ts'
import { audio, useAudioStore } from '../state/audio.ts'

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
  const { status, error, notesWaiting, latency } = useAudioStore()
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
            {status === 'off'
              ? 'Browsers start sound only after a click or key press on the page.'
              : 'Starting audio...'}
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
