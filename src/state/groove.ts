// The groove transport the UI drives: which groove, its key and tempo, loop and count-in, and
// whether it's playing. No Tone import: the player lives in the engine (src/audio/tone/groove.ts),
// loaded with it. The store changes on control changes, never per beat.
// shortcut: these choices aren't saved with the settings; save them when jam mode (P1-T4) has
// a groove picker worth coming back to.

import { create } from 'zustand'
import type { Groove } from '../grooves/groove.ts'
import { GROOVES } from '../grooves/library.ts'
import type { GrooveSettings } from '../audio/tone/groove.ts'
import { audio, useAudioStore } from './audio.ts'

/** The tempo slider's reach either side of the groove's own tempo. */
export const TEMPO_RANGE = 0.3

export interface GrooveState {
  grooveId: string
  /** Key tonic, pitch class. */
  tonic: number
  bpm: number
  loop: boolean
  countIn: boolean
  playing: boolean
}

const first = GROOVES[0]!

export const useGrooveStore = create<GrooveState>(() => ({
  grooveId: first.id,
  tonic: first.key.tonic,
  bpm: first.tempo,
  loop: true,
  countIn: true,
  playing: false,
}))

const set = useGrooveStore.setState
const get = useGrooveStore.getState

export const grooveOf = (id: string): Groove => GROOVES.find((g) => g.id === id) ?? first

/** The BPM range the tempo control offers for a groove: its tempo ±30%, whole BPM. */
export const tempoRange = (groove: Groove): [number, number] => [
  Math.round(groove.tempo * (1 - TEMPO_RANGE)),
  Math.round(groove.tempo * (1 + TEMPO_RANGE)),
]

function settings(): GrooveSettings {
  const s = get()
  return {
    groove: grooveOf(s.grooveId),
    tonic: s.tonic,
    bpm: s.bpm,
    loop: s.loop,
    countIn: s.countIn,
  }
}

/** Sends a control change to the player while it plays, and the tempo even when it doesn't. */
function change(patch: Partial<GrooveState>) {
  set(patch)
  const engine = audio.engine()
  if (get().playing) engine?.groove().update(settings())
  else engine?.setTempo(get().bpm)
}

export const groove = {
  /** Plays from the top; does nothing unless sound is running. */
  play() {
    const engine = audio.engine()
    if (!engine || engine.state() !== 'running') return
    engine.groove().play(settings(), () => set({ playing: false }))
    set({ playing: true })
  },
  stop() {
    audio.engine()?.groove().stop()
    set({ playing: false })
  },
  setTonic: (tonic: number) => change({ tonic: ((tonic % 12) + 12) % 12 }),
  setBpm(bpm: number) {
    const [min, max] = tempoRange(grooveOf(get().grooveId))
    change({ bpm: Math.min(max, Math.max(min, Math.round(bpm))) })
  },
  setLoop: (loop: boolean) => change({ loop }),
  /** Applies from the next play. */
  setCountIn: (countIn: boolean) => set({ countIn }),
}

// The engine stops the groove itself when the audio context stops running. When sound starts,
// the transport takes the shown tempo, for a synced wobble.
useAudioStore.subscribe((s, prev) => {
  if (s.status !== 'running' && get().playing) set({ playing: false })
  if (s.status === 'running' && prev.status !== 'running') audio.engine()?.setTempo(get().bpm)
})
