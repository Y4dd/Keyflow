import { knobToPosition, positionToKnob } from '../audio/curves.ts'
import { getPreset, PRESETS } from '../audio/presets/index.ts'
import type { KnobSpec } from '../audio/presets/types.ts'
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

export function SoundPanel() {
  const status = useAudioStore((s) => s.status)
  const presetId = useAudioStore((s) => s.presetId)
  const knobs = useAudioStore((s) => s.knobs[presetId])
  const preset = getPreset(presetId)

  return (
    <section className="panel" aria-label="Sound">
      <h2>Sound</h2>
      <div data-testid="audio-status" data-status={status}>
        <StatusLine />
      </div>

      <fieldset className="presets">
        <legend>Preset</legend>
        {PRESETS.map((p) => (
          <label key={p.id} className="preset">
            <input
              type="radio"
              name="preset"
              value={p.id}
              checked={p.id === presetId}
              onChange={() => audio.setPreset(p.id)}
            />
            <span>
              <strong>{p.name}</strong> <span className="muted">{p.description}</span>
            </span>
          </label>
        ))}
      </fieldset>

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
    </section>
  )
}
