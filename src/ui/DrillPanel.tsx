import { GROOVES } from '../grooves/library.ts'
import { pretty } from '../music/spelling.ts'
import type { DrillKind } from '../practice/drills.ts'
import type { PacingId } from '../practice/grading.ts'
import { drills, useDrillStore } from '../state/drills.ts'
import { session, useSessionStore } from '../state/session.ts'

const KINDS: { kind: DrillKind; label: string }[] = [
  { kind: 'note', label: 'Find the note' },
  { kind: 'chord', label: 'Play the chord' },
  { kind: 'scale', label: 'Play the scale' },
  { kind: 'chordInKey', label: 'Chord in key' },
  { kind: 'build', label: 'Build it' },
]

// shortcut: temporary pace chips until P2-T4's audition picks a default, then removed.
const PACES: { id: PacingId; label: string }[] = [
  { id: 'quick', label: 'Quick' },
  { id: 'steady', label: 'Steady' },
  { id: 'patient', label: 'Patient' },
]

const RATINGS = ['', 'Again', 'Hard', 'Good', 'Easy']

const check = (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
  </svg>
)

/**
 * Drills: today's session (P2-T6), or one type at a time. Pick a type, answer the prompt on the keys. A stalled answer gets hints in steps (the
 * keys they mark are on the canvas keyboard), and the right one its rating. Re-renders on a new
 * drill, a new feedback line, a hint or the right answer, never per note.
 */
export function DrillPanel() {
  const { drill, done, ms, say, hint, rating, pacing } = useDrillStore()
  const { status, at, total, jam } = useSessionStore()
  const inSession = status === 'on'
  const kind = inSession ? null : (drill?.kind ?? null)

  return (
    <section className="card drills" aria-labelledby="drills-tab" data-testid="drills">
      <h2 className="tab" id="drills-tab">
        Drills
      </h2>
      <div className="actions">
        {inSession ? (
          <span className="drill-step" data-testid="session-count">
            Session: {at} of {total}
          </span>
        ) : (
          <button
            type="button"
            className="primary"
            disabled={status === 'building'}
            onClick={() => void session.start()}
          >
            Start today’s session
          </button>
        )}
      </div>
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
      {!drill && status === 'done' ? (
        <div className="drill" data-testid="session-done">
          <p className="blurb">
            {total === 0
              ? 'Nothing is due right now. New items come as the ones you have settle in.'
              : 'That’s today’s session.'}
          </p>
          {jam && (
            <div className="actions">
              <button type="button" className="primary" onClick={session.jam}>
                Jam: {pretty(jam.root)} {jam.scale} over the{' '}
                {GROOVES.find((g) => g.id === jam.grooveId)?.name.toLowerCase()}
              </button>
            </div>
          )}
        </div>
      ) : !drill ? (
        <p className="blurb drill-empty">
          Today’s session mixes what’s due with a few new things, about five minutes. Or pick one
          type. Answer on the keys. Any octave counts unless the prompt names an inversion. The
          keyboard’s highlighting stays off while a drill is open.
        </p>
      ) : (
        <div className="drill" data-state={done ? 'done' : 'now'} data-item={drill.item}>
          <p className="drill-prompt" data-testid="drill-prompt">
            {drill.prompt}
          </p>
          {drill.detail && <p className="drill-detail">{drill.detail}</p>}
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
          <div className="chips drill-pace" role="radiogroup" aria-label="Hint pace">
            {PACES.map((p) => (
              <label key={p.id} className="chip">
                <input
                  type="radio"
                  name="hint-pace"
                  value={p.id}
                  checked={p.id === pacing}
                  onChange={() => drills.pace(p.id)}
                />
                Hints: {p.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
