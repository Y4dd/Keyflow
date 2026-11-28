// The Learn view's library (P2-T10): the keys it marks on the canvas keyboard, and Hear it.
// Hear it plays through the input bus like any source, so the engine triggers each note with
// Tone.immediate() and the keyboard lights what sounds. Changes on a click, never per note.

import { create } from 'zustand'
import { inputBus } from '../input/bus.ts'
import { createSimPlayer, type SimPlayer } from '../input/sim/player.ts'
import type { SimEvent } from '../input/sim/script.ts'
import type { Pick } from '../practice/library.ts'
import { audio } from './audio.ts'

export const useLibraryStore = create<{
  /** What Learn shows; kept here so it's still there after Drill this and back. */
  pick: Pick
  /** Keys to mark (note → label, a note name over its degree), or null outside Learn. */
  marks: ReadonlyMap<number, string> | null
  hearing: boolean
}>(() => ({
  pick: { root: 'D', type: 'chord', quality: 'min', inversion: 0 },
  marks: null,
  hearing: false,
}))

let player: SimPlayer | null = null
let run = 0

// shortcut: a take being recorded in Jam would capture Hear it's notes too; filter by source
// in takes.ts if recording ever spans views.
export const library = {
  /** Plays the events (stopping what plays now); resolves when they're done or stopped. */
  hear(events: readonly SimEvent[]) {
    library.stop()
    player ??= createSimPlayer(
      {
        now: () => performance.now(),
        setTimer: (fn, ms) => window.setTimeout(fn, ms),
        clearTimer: (handle) => window.clearTimeout(handle as number),
      },
      inputBus.emit,
    )
    const r = ++run
    const p = player
    useLibraryStore.setState({ hearing: true })
    // audio.start may never settle without a gesture, so wait for it a moment at most
    void Promise.race([audio.start(), new Promise((ok) => setTimeout(ok, 400))])
      .then(() => (r === run ? p.play(events) : undefined))
      .finally(() => r === run && useLibraryStore.setState({ hearing: false }))
  },
  /** Stops Hear it and releases its notes. */
  stop() {
    run++
    player?.stop()
    useLibraryStore.setState({ hearing: false })
  },
}
