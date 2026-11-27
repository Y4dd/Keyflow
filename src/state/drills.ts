// The drill being answered (P2-T3). Listens to the input bus after the audio engine: notes are
// judged by the pure attempt in src/practice/drills.ts, and the store changes only when the
// feedback line or the done state does, never per note otherwise.

import { create } from 'zustand'
import { createHeldNotes } from '../analysis/recognize.ts'
import type { InputEvent } from '../input/types.ts'
import {
  createAttempt,
  pickDrill,
  type Attempt,
  type Drill,
  type DrillKind,
} from '../practice/drills.ts'
import { useAudioStore } from './audio.ts'

export interface DrillState {
  /** The drill on screen, or null when no drill type is chosen. */
  drill: Drill | null
  done: boolean
  /** Milliseconds to the right answer, once done. */
  ms: number | null
  /** One line about the last try, or null. */
  say: string | null
}

export const useDrillStore = create<DrillState>(() => ({
  drill: null,
  done: false,
  ms: null,
  say: null,
}))

// Tracked from load, so a drill knows which keys were already down when it started.
const held = createHeldNotes(() => useAudioStore.getState().expression.pedalMode)
let attempt: Attempt | null = null

export const drills = {
  /** The input-bus listener, subscribed in main.tsx after the audio engine's. */
  handle(e: InputEvent) {
    held.apply(e)
    if (!attempt || e.kind === 'bend') return
    attempt.apply(e, held.notes())
    const { done, ms, say } = attempt.state()
    const s = useDrillStore.getState()
    if (done !== s.done || say !== s.say) useDrillStore.setState({ done, ms, say })
  },
  /** Shows a drill and starts timing it now. */
  start(drill: Drill) {
    attempt = createAttempt(drill, performance.now())
    useDrillStore.setState({ drill, done: false, ms: null, say: null })
  },
  /** A new drill of a kind, never the item just shown. */
  pick(kind: DrillKind) {
    drills.start(pickDrill(kind, useDrillStore.getState().drill?.item ?? null))
  },
  stop() {
    attempt = null
    useDrillStore.setState({ drill: null, done: false, ms: null, say: null })
  },
}
