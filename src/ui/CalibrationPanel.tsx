import { TAP_TEST } from '../audio/calibration.ts'
import { useAudioStore } from '../state/audio.ts'
import { calibration, useCalibrationStore } from '../state/calibration.ts'
import { useSetupSteps } from '../state/setup.ts'
import { StepAction } from './SetupSteps.tsx'

const ms = (v: number) => `${Math.round(v)} ms`
const signedMs = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${ms(Math.abs(v))}`

function Result() {
  const { last, offsetMs } = useCalibrationStore()
  if (!last) {
    return offsetMs == null ? null : (
      <p className="muted" data-testid="calibration-saved">
        Using your saved calibration, {signedMs(offsetMs)}.
      </p>
    )
  }
  const counted = `${last.used} of ${last.beats} beats`
  return (
    <div data-testid="calibration-result" data-verdict={last.verdict}>
      {last.verdict === 'ok' && last.offsetMs != null && last.spreadMs != null && (
        <p role="status">
          Calibrated: your taps land <strong>{signedMs(last.offsetMs)}</strong> from the click
          (spread ±{ms(last.spreadMs)}, {counted}).
        </p>
      )}
      {last.verdict === 'tooNoisy' && last.spreadMs != null && (
        <p className="hint" role="status">
          Your taps were spread ±{ms(last.spreadMs)}, too uneven to use. Try again, and let the
          click lead: tap with it, not ahead of it.
        </p>
      )}
      {last.verdict === 'tooFewTaps' && (
        <p className="hint" role="status">
          Only {counted} had a tap. Try again, and tap on every click after the first{' '}
          {TAP_TEST.countIn}.
        </p>
      )}
      {last.verdict !== 'ok' && offsetMs != null && (
        <p className="muted">Still using the last calibration, {signedMs(offsetMs)}.</p>
      )}
    </div>
  )
}

export function CalibrationPanel() {
  const status = useAudioStore((s) => s.status)
  const outputLatencyMs = useAudioStore((s) => s.latency?.outputLatencyMs)
  const running = useCalibrationStore((s) => s.running)
  const lead = useCalibrationStore((s) => s.outputTimestampLeadMs)
  const state = useSetupSteps().timing

  return (
    <section className="card" id="timing" aria-label="Timing" data-state={state}>
      <h2 className="tab">Timing</h2>
      <p>
        Calibrate once in each browser, so later timing feedback is fair. A click plays{' '}
        {TAP_TEST.beats} beats; listen to the first {TAP_TEST.countIn}, then tap any key on each
        click.
      </p>
      <ul className="muted small">
        <li>Use wired headphones in the laptop; Bluetooth adds delay.</li>
        <li>
          Turn the keyboard&apos;s Local Control off so its own sound doesn&apos;t double the
          app&apos;s.
        </li>
        <li>Close other music apps.</li>
      </ul>
      {status === 'running' ? (
        <p className="muted small" data-testid="calibration-latency">
          Output latency:{' '}
          {outputLatencyMs != null
            ? `${ms(outputLatencyMs)} (the browser's estimate)`
            : 'not reported by this browser'}
          {lead != null && `; output timestamp ${signedMs(lead)}`}.
        </p>
      ) : (
        <p className="muted small">Start audio to calibrate.</p>
      )}
      {running ? (
        <>
          <p role="status" className="title" style={{ marginTop: 16 }}>
            Listen to {TAP_TEST.countIn} clicks, then tap along.
          </p>
          <div className="actions">
            <button type="button" onClick={calibration.cancel}>
              Stop
            </button>
          </div>
        </>
      ) : (
        <StepAction
          step="timing"
          label="Calibrate"
          disabled={status !== 'running'}
          onClick={calibration.start}
        />
      )}
      <Result />
    </section>
  )
}
