import type { DrillKind } from '../practice/drills.ts'
import { drills, useDrillStore } from '../state/drills.ts'

const KINDS: { kind: DrillKind; label: string }[] = [
  { kind: 'note', label: 'Find the note' },
  { kind: 'chord', label: 'Play the chord' },
  { kind: 'scale', label: 'Play the scale' },
  { kind: 'chordInKey', label: 'Chord in key' },
  { kind: 'build', label: 'Build it' },
]

const check = (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
  </svg>
)

/**
 * Drills: pick a type, answer the prompt on the keys. Re-renders on a new drill, a new feedback
 * line or the right answer, never per note.
 */
export function DrillPanel() {
  const { drill, done, ms, say } = useDrillStore()
  const kind = drill?.kind ?? null

  return (
    <section className="card drills" aria-labelledby="drills-tab" data-testid="drills">
      <h2 className="tab" id="drills-tab">
        Drills
      </h2>
      <div className="chips" role="radiogroup" aria-label="Drill type">
        {KINDS.map((k) => (
          <label key={k.kind} className="chip">
            <input
              type="radio"
              name="drill-kind"
              value={k.kind}
              checked={k.kind === kind}
              onChange={() => drills.pick(k.kind)}
            />
            {k.label}
          </label>
        ))}
      </div>
      {!drill ? (
        <p className="blurb drill-empty">
          Pick a drill and answer on the keys. Any octave counts unless the prompt names an
          inversion. The keyboard’s highlighting stays off while a drill is open.
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
              </>
            ) : (
              <span className="muted">{say ?? ' '}</span>
            )}
          </div>
          <div className="actions">
            <button type="button" onClick={() => drills.pick(drill.kind)}>
              {done ? 'Next' : 'Skip'}
            </button>
            <button type="button" onClick={drills.stop}>
              Close drills
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
