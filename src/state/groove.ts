// The groove transport the UI drives: which groove, its key and tempo, loop and count-in, and
// whether it's playing. No Tone import: the player lives in the engine (src/audio/tone/groove.ts),
// loaded with it. The store changes on control changes, never per beat.
// It also holds jam mode's solo scale and training-wheels level, which the canvas keyboard reads.
// shortcut: none of these choices are saved with the settings (P1-T4 didn't ask for it); save the
// groove, scale and training wheels once coming back to them matters (a "last jam" setting).

import { create } from 'zustand'
import { harmonyAt, previewTick, transpose, type Groove } from '../grooves/groove.ts'
import type { Wheels } from '../music/highlight.ts'
import { scalePcs, type HarmonyAt, type ScaleId } from '../music/harmony.ts'
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
  /** The solo scale the keyboard highlights: the groove's own or one of its alternatives. */
  scale: ScaleId
  wheels: Wheels
}

const first = GROOVES[0]!

export const useGrooveStore = create<GrooveState>(() => ({
  grooveId: first.id,
  tonic: first.key.tonic,
  bpm: first.tempo,
  loop: true,
  countIn: true,
  playing: false,
  scale: first.soloScale,
  // shortcut: full help by default (a taste step in the P1-T4 check); fade it per learner once
  // drills track progress (Phase 2).
  wheels: 3,
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

/** The scales the picker offers for a groove: its default first. */
export const scalesOf = (g: Groove): ScaleId[] => [g.soloScale, ...g.altScales]

/**
 * The harmony the keyboard shows (previewTick: half a beat ahead while playing, else the first
 * chord), in the chosen key and scale. Reads the player only while playing, since
 * `engine.groove()` builds it on first use.
 * shortcut: a key change shows at once, while the bars already scheduled (up to a bar and a half:
 * each bar goes in at the middle of the one before) still sound in the old key; follow the
 * player's own key if that reads wrong.
 */
export function shownTick(): number {
  return previewTick(get().playing ? (audio.engine()?.groove().ticks() ?? null) : null)
}

/** The chosen groove in the chosen key. */
export function shownGroove(): Groove {
  const g = grooveOf(get().grooveId)
  return transpose(g, get().tonic - g.key.tonic)
}

export const shownHarmony = (): HarmonyAt => harmonyAt(shownGroove(), shownTick(), get().scale)

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
  /**
   * Picks a groove at its own key and tempo. While playing it restarts from the top: the old
   * pattern's note-offs pair by ids the new one doesn't make, so swapping mid-bar could strand
   * a note.
   */
  setGroove(id: string) {
    const g = grooveOf(id)
    // Its own scale too: another groove's alternative may clash with its chords (P1-T3).
    set({ grooveId: g.id, tonic: g.key.tonic, bpm: g.tempo, scale: g.soloScale })
    if (get().playing) groove.play()
    else audio.engine()?.setTempo(g.tempo)
  },
  setTonic: (tonic: number) => change({ tonic: ((tonic % 12) + 12) % 12 }),
  setBpm(bpm: number) {
    const [min, max] = tempoRange(grooveOf(get().grooveId))
    change({ bpm: Math.min(max, Math.max(min, Math.round(bpm))) })
  },
  setLoop: (loop: boolean) => change({ loop }),
  setScale(scale: ScaleId) {
    if (scalesOf(grooveOf(get().grooveId)).includes(scale)) set({ scale })
  },
  setWheels: (wheels: Wheels) => set({ wheels }),
  /** Applies from the next play. */
  setCountIn: (countIn: boolean) => set({ countIn }),
}

// The engine stops the groove itself when the audio context stops running. When sound starts,
// the transport takes the shown tempo, for a synced wobble, and the engine the solo scale, for
// "to next scale tone" bends, which it takes again whenever the scale or key changes.
const soloScale = () => scalePcs(get().scale, get().tonic)
useAudioStore.subscribe((s, prev) => {
  if (s.status !== 'running' && get().playing) set({ playing: false })
  if (s.status === 'running' && prev.status !== 'running') {
    audio.engine()?.setTempo(get().bpm)
    audio.engine()?.setSoloScale(soloScale())
  }
})
useGrooveStore.subscribe((s, prev) => {
  if (s.scale !== prev.scale || s.tonic !== prev.tonic) audio.engine()?.setSoloScale(soloScale())
})
