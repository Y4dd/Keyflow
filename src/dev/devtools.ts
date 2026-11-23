// Dev-only: loaded only when __KEYFLOW_DEV_TOOLS__ is true (dev server, Playwright build).
// The production build doesn't contain this module; CI checks for "__keyflow" in dist.

import { inputBus } from '../input/bus.ts'
import { fixtureToSimEvents, parseFixture } from '../input/sim/fixture.ts'
import { createSimPlayer } from '../input/sim/player.ts'
import { chord, sequence, type SimEvent } from '../input/sim/script.ts'

export const simPlayer = createSimPlayer(
  {
    now: () => performance.now(),
    setTimer: (fn, ms) => window.setTimeout(fn, ms),
    clearTimer: (handle) => window.clearTimeout(handle as number),
  },
  inputBus.emit,
)

export interface KeyflowDevApi {
  /** Emits sim events onto the input bus; see SimEvent. Resolves after the last one. */
  inject(events: SimEvent[]): Promise<void>
  /** Replays a fixture object (parsed JSON from tests/fixtures/) through the MIDI parser. */
  replay(fixture: unknown): Promise<void>
  /** Cancels pending sim events and releases what the sim holds. */
  stop(): void
  heldNotes(): number[]
  chord: typeof chord
  sequence: typeof sequence
}

declare global {
  interface Window {
    __keyflow?: KeyflowDevApi
  }
}

export function installDevTools() {
  window.__keyflow = {
    inject: (events) => simPlayer.play(events),
    replay: (fixture) => simPlayer.play(fixtureToSimEvents(parseFixture(fixture))),
    stop: () => simPlayer.stop(),
    heldNotes: () => simPlayer.heldNotes(),
    chord,
    sequence,
  }
}
