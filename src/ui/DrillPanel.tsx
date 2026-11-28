import { GROOVES } from '../grooves/library.ts'
import { pretty } from '../music/spelling.ts'
import type { DrillKind } from '../practice/drills.ts'
import { useCalibrationStore } from '../state/calibration.ts'
import { drills, useDrillStore } from '../state/drills.ts'
import { session, useDrillStage, useSessionStore } from '../state/session.ts'

const KINDS: { kind: DrillKind; label: string }[] = [
  { kind: 'note', label: 'Find the note' },
  { kind: 'chord', label: 'Play the chord' },
  { kind: 'scale', label: 'Play the scale' },
  { kind: 'chordInKey', label: 'Chord in key' },
  { kind: 'build', label: 'Build it' },
]

const RATINGS = ['', 'Again', 'Hard', 'Good', 'Easy']

const check = (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
  </svg>
)

/**
 * Drills: today's session (P2-T6), or one type at a time (behind "Practice by type" until the
 * library's Drill this replaces it, P2-T10). With nothing open, a card with the one Start; with a
 * drill open, the stage at the bottom of the view, right over the pinned keys (P2-T13). Answer the
 * prompt on the keys. A stalled answer gets hints in steps (the keys they mark are on the canvas
 * keyboard), and the right one its rating. Re-renders on a new drill, a new feedback line, a hint
 * or the right answer, never per note.
 */
export function DrillPanel() {
  const { drill, done, ms, say, hint, rating } = useDrillStore()
  const calibrated = useCalibrationStore((s) => s.offsetMs != null)
  const { status, at, total, jam } = useSessionStore()
  const stage = useDrillStage()
  const inSession = status === 'on'
  const kind = inSession ? null : (drill?.kind ?? null)

  const typeChips = (
    <div className="chips" role="radiogroup" aria-label="Drill type">
      {KINDS.map((k) => (
        <label key={k.kind} className="chip">
          <input
            type="radio"
            name="drill-kind"
            value={k.kind}
            checked={k.kind === kind}
            onChange={() => {
              session.leave()
              drills.pick(k.kind)
            }}
          />
          {k.label}
        </label>
      ))}
    </div>
  )

  if (!stage)
    return (
      <section className="card drills" aria-labelledby="drills-tab" data-testid="drills">
        <h2 className="tab" id="drills-tab">
          Drills
        </h2>
        <div className="actions">
          <button
            type="button"
            className="primary"
            disabled={status === 'building'}
            onClick={() => void session.start()}
          >
            Start today’s session
          </button>
        </div>
        <p className="blurb drill-empty">
          About five minutes: what’s due, mixed with a few new things. Answer on the keys; any
          octave counts unless the prompt names an inversion.
        </p>
        <details className="by-type">
          <summary>Practice by type</summary>
          {typeChips}
        </details>
      </section>
    )

  return (
    <section className="drill-stage" aria-labelledby="drills-tab" data-testid="drills">
      <h2 className="visually-hidden" id="drills-tab">
        Drills
      </h2>
      {drill && (
        <div className="stage-bar">
          {inSession ? (
            <div className="session-progress">
              <ol className="session-dots" aria-hidden="true">
                {Array.from({ length: total }, (_, i) => (
                  <li key={i} data-at={i + 1 < at ? 'past' : i + 1 === at ? 'now' : 'next'} />
                ))}
              </ol>
              <span className="drill-step" data-testid="session-count">
                Session: {at} of {total}
              </span>
            </div>
          ) : (
            typeChips
          )}
          <div className="actions">
            <button
              type="button"
              onClick={() => (inSession ? session.next() : drills.pick(drill.kind))}
            >
              {done ? 'Next' : 'Skip'}
            </button>
            <button
              type="button"
              onClick={() => {
                session.leave()
                drills.stop()
              }}
            >
              Close drills
            </button>
          </div>
        </div>
      )}
      {!drill ? (
        <div className="drill" data-testid="session-done">
          <p className="drill-prompt">
            {total === 0 ? 'Nothing is due right now.' : 'That’s today’s session.'}
          </p>
          {total === 0 && (
            <p className="drill-detail">New items come as the ones you have settle in.</p>
          )}
          <div className="actions">
            {jam && (
              <button type="button" className="primary" onClick={session.jam}>
                Jam: {pretty(jam.root)} {jam.scale} over the{' '}
                {GROOVES.find((g) => g.id === jam.grooveId)?.name.toLowerCase()}
              </button>
            )}
            <button type="button" onClick={session.leave}>
              Back to progress
            </button>
          </div>
        </div>
      ) : (
        <div className="drill" data-state={done ? 'done' : 'now'} data-item={drill.item}>
          <p className="drill-prompt" data-testid="drill-prompt">
            {drill.prompt}
          </p>
          {drill.detail && <p className="drill-detail">{drill.detail}</p>}
          {drill.kind === 'scale' && drill.bpm !== null && !calibrated && (
            <p className="hint" data-testid="timing-offer">
              This one is in time. For fair timing, <a href="#/setup">calibrate Timing in Setup</a>{' '}
              first; it takes one short tap test.
            </p>
          )}
          <div className="drill-result" aria-live="polite" data-testid="drill-result">
            {done ? (
              <>
                <span className="sticker drill-check">{check}</span>
                <span>
                  <strong>Right</strong>, in {((ms ?? 0) / 1000).toFixed(1)} s
                  {drill.kind === 'chordInKey' && `: ${drill.chordName}`}
                </span>
                {rating !== null && (
                  <span className="drill-rating" data-testid="drill-rating">
                    {RATINGS[rating]}
                  </span>
                )}
                {say && <span className="muted">{say}</span>}
              </>
            ) : (
              <span className="muted">{say ?? ' '}</span>
            )}
          </div>
          <p className="drill-hint" data-testid="drill-hint" data-level={hint?.level}>
            {hint && (
              <>
                <span className="drill-step">Hint {hint.level}</span> {hint.say}
              </>
            )}
          </p>
        </div>
      )}
    </section>
  )
}
