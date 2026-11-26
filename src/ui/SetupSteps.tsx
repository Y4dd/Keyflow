import { useSetupSteps, type StepId } from '../state/setup.ts'

/**
 * A card's action button: yellow (primary) only while its step is the next one, so there's one
 * yellow action at a time. Only the class changes (same border width), so the button never moves
 * under the pointer (Start audio starts sound on pointerdown).
 */
export function StepAction(props: {
  step: StepId
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  const now = useSetupSteps()[props.step] === 'now'
  return (
    <div className="actions">
      <button
        type="button"
        className={now ? 'primary' : undefined}
        disabled={props.disabled}
        onClick={props.onClick}
      >
        {props.label}
      </button>
    </div>
  )
}

const STEPS: { id: StepId; done: string; todo: string }[] = [
  { id: 'keyboard', done: 'Keyboard connected', todo: 'Connect keyboard' },
  { id: 'sound', done: 'Sound on', todo: 'Turn sound on' },
  { id: 'timing', done: 'Timing calibrated', todo: 'Calibrate timing' },
]

const check = (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
  </svg>
)

/** The three setup steps as stickers in the header; each links to its card. */
export function SetupSteps() {
  const states = useSetupSteps()
  return (
    <ol className="steps" aria-label="Setup">
      {STEPS.map(({ id, done, todo }, i) => {
        const state = states[id]
        return (
          <li key={id}>
            <a className="step" href={`#${id}`} data-state={state}>
              <span className="sticker" aria-hidden="true">
                {state === 'done' ? check : i + 1}
              </span>
              {state === 'done' ? done : todo}
              {state === 'now' && <span className="visually-hidden"> (next step)</span>}
            </a>
          </li>
        )
      })}
    </ol>
  )
}
