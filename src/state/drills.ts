// The drill being answered (P2-T3) and its grading (P2-T4). Listens to the input bus after the
// audio engine: notes are judged by the pure attempt in src/practice/drills.ts, and the store
// changes only when the feedback line, the hint or the done state does, never per note otherwise.
// A finished or abandoned attempt is rated (src/practice/grading.ts) and recorded once.

import type { Grade } from 'ts-fsrs'
import { create } from 'zustand'
import { createHeldNotes } from '../analysis/recognize.ts'
import type { InputEvent } from '../input/types.ts'
import {
  createAttempt,
  pickDrill,
  type Attempt,
  type AttemptState,
  type Drill,
  type DrillKind,
} from '../practice/drills.ts'
import {
  GRADING,
  hintDelays,
  hintsFor,
  rate,
  RATING,
  targetOf,
  type Hint,
} from '../practice/grading.ts'
import { loadItem } from '../storage/db.ts'
import { useAudioStore } from './audio.ts'

export interface DrillState {
  /** The drill on screen, or null when no drill type is chosen. */
  drill: Drill | null
  done: boolean
  /** Milliseconds to the right answer, once done. */
  ms: number | null
  /** One line about the last try (once done, a tip), or null. */
  say: string | null
  /** The hint step showing, or null. */
  hint: Hint | null
  /** The rating recorded for this drill, once it's done or given up. */
  rating: Grade | null
  /** Asked again unaided after the answer was shown (step 3); this answer isn't recorded. */
  retry: boolean
}

export const useDrillStore = create<DrillState>(() => ({
  drill: null,
  done: false,
  ms: null,
  say: null,
  hint: null,
  rating: null,
  retry: false,
}))

// Tracked from load, so a drill knows which keys were already down when it started.
const held = createHeldNotes(() => useAudioStore.getState().expression.pedalMode)
let attempt: Attempt | null = null
let run = 0 // the drill a pending stability load belongs to
let ladder: Hint[] = []
let next = 0 // the ladder step the timer shows next
let stability: number | null = null // null until the item's card is loaded
let timer = 0
let tried = false // a key went down since the prompt
let graded = false
let wrong = 0
// the attempt's last line: the store's can be a retry's own, which stays until the attempt speaks
let said: string | null = null

/** Waits for the next hint step, counting the stall from now. */
function schedule() {
  clearTimeout(timer)
  if (graded || stability === null || next >= ladder.length) return
  const delays = hintDelays(stability, GRADING.pacing.steady, ladder.length) // the P2-T4 pick
  timer = window.setTimeout(() => {
    useDrillStore.setState({ hint: ladder[next++]! })
    schedule()
  }, delays[next])
}

/** Rates the attempt and records it (FSRS card and log) in the background. */
function grade(drill: Drill, a: AttemptState): Grade {
  graded = true
  clearTimeout(timer)
  const result = {
    ms: a.done ? a.ms : null,
    hintLevel: useDrillStore.getState().hint?.level ?? 0,
    wrongNotes: a.wrongNotes,
  }
  const rating = rate({ done: a.done, ...result }, targetOf(drill))
  // on demand: state/items.ts loads the FSRS scheduler, which the app doesn't need at start
  import('./items.ts')
    .then((m) => m.recordAttempt(drill.item, rating, result))
    .catch((err: unknown) => console.error('Keyflow: could not save the attempt', err))
  return rating
}

/** Records an attempt left unanswered, once something was tried or a hint shown. */
function giveUp() {
  const { drill, done, retry, hint } = useDrillStore.getState()
  if (!drill || !attempt || graded || done || retry || (!tried && !hint)) return
  useDrillStore.setState({ rating: grade(drill, attempt.state()) })
}

export const drills = {
  /** The input-bus listener, subscribed in main.tsx after the audio engine's. */
  handle(e: InputEvent) {
    held.apply(e)
    if (!attempt || e.kind === 'bend') return
    attempt.apply(e, held.notes())
    const a = attempt.state()
    const s = useDrillStore.getState()
    const drill = s.drill!
    if (e.kind === 'noteOn') tried = true
    // a scale run going right isn't a stall
    if (!a.done && drill.kind === 'scale' && e.kind === 'noteOn' && a.wrongNotes === wrong)
      schedule()
    wrong = a.wrongNotes
    if (a.done) {
      if (s.done) return // input after the answer changes nothing
      if (s.retry)
        return useDrillStore.setState({ done: true, ms: a.ms, say: 'It comes back soon.' })
      const rating = grade(drill, a)
      if (s.hint?.level === 3) {
        // the answer was shown: ask for it once more, unaided (learning-design.md, step 3)
        attempt = createAttempt(drill, performance.now())
        wrong = 0
        said = null
        return useDrillStore.setState({
          hint: null,
          rating,
          retry: true,
          say: 'Right. Now once more, on your own.',
        })
      }
      const target = targetOf(drill)
      const slow = rating === RATING.hard && !s.hint
      return useDrillStore.setState({
        done: true,
        ms: a.ms,
        hint: null,
        rating,
        say: slow ? `Aim for under ${(target.ms / 1000).toFixed(1)} s.` : null,
      })
    }
    if (a.say === said) return
    said = a.say
    useDrillStore.setState({ say: said })
  },
  /** Shows a drill and starts timing it now; the one before, if left unanswered, is recorded. */
  start(drill: Drill) {
    giveUp()
    clearTimeout(timer)
    const r = ++run
    attempt = createAttempt(drill, performance.now())
    ladder = hintsFor(drill)
    next = 0
    stability = null
    tried = false
    graded = false
    wrong = 0
    said = null
    useDrillStore.setState({
      drill,
      done: false,
      ms: null,
      say: null,
      hint: null,
      rating: null,
      retry: false,
    })
    loadItem(drill.item)
      .catch(() => undefined) // database unavailable: hints at a new item's pace
      .then((item) => {
        if (r !== run) return
        stability = item?.card.stability ?? 0
        schedule()
      })
  },
  /** A new drill of a kind, never the item just shown. */
  pick(kind: DrillKind) {
    drills.start(pickDrill(kind, useDrillStore.getState().drill?.item ?? null))
  },
  stop() {
    giveUp()
    clearTimeout(timer)
    run++
    attempt = null
    useDrillStore.setState({
      drill: null,
      done: false,
      ms: null,
      say: null,
      hint: null,
      rating: null,
      retry: false,
    })
  },
}
