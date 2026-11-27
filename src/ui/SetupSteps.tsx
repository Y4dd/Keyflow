import { useContext } from 'react'
import { NowStep, useSetupSteps, type StepId } from '../state/setup.ts'

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
  const states = useSetupSteps()
  const forced = useContext(NowStep)
  const now = forced
    ? forced === props.step && states[props.step] !== 'done'
    : states[props.step] === 'now'
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

/** One setup step as a sticker pill: a check when done, its number otherwise. */
export function Step({ id, current }: { id: StepId; current?: boolean }) {
  const state = useSetupSteps()[id]
  const i = STEPS.findIndex((s) => s.id === id)
  const { done, todo } = STEPS[i]!
  // In the walk-through the screen shown is the current step, whatever comes first.
  const shown = state === 'done' ? 'done' : current === undefined ? state : current ? 'now' : 'todo'
  return (
    <span className="step" data-state={shown}>
      <span className="sticker" aria-hidden="true">
        {state === 'done' ? check : i + 1}
      </span>
      {state === 'done' ? done : todo}
      {shown === 'now' && <span className="visually-hidden"> (next step)</span>}
    </span>
  )
}

/**
 * The top bar's setup sticker: the next of Keyboard and Sound, linking to Setup, shown only
 * while one of them isn't done. Timing is offered before the first timed drill instead.
 */
export function SetupSticker() {
  const states = useSetupSteps()
  const next = (['keyboard', 'sound'] as const).find((id) => states[id] !== 'done')
  if (!next) return null
  return (
    <a
      className="step-link"
      href="#/setup"
      aria-label={`Setup: ${STEPS.find((s) => s.id === next)!.todo}`}
    >
      <Step id={next} />
    </a>
  )
}
