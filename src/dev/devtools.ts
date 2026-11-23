// Dev-only: loaded only when __KEYFLOW_DEV_TOOLS__ is true (dev server, Playwright build).
// The production build doesn't contain this module; CI checks for "__keyflow" in dist.

import { inputBus } from '../input/bus.ts'
import { fixtureToSimEvents, parseFixture } from '../input/sim/fixture.ts'
import { createSimPlayer } from '../input/sim/player.ts'
import { chord, sequence, type SimEvent } from '../input/sim/script.ts'
import { audio } from '../state/audio.ts'
import type { LatencyReadout } from '../audio/latency.ts'
import type { RenderResult, RenderSpec } from './render.ts'

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
  audio: {
    /** Pitches the current instrument holds; 0 before audio starts. */
    heldCount(): number
    /** The audio context's clock, s, or null before audio starts. */
    currentTime(): number | null
    latency(): LatencyReadout | null
  }
  /** Renders a preset offline and measures it (src/dev/render.ts). Loads Tone.js. */
  render(spec: RenderSpec): Promise<RenderResult>
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
    audio: {
      heldCount: () => audio.engine()?.heldCount() ?? 0,
      currentTime: () => audio.engine()?.currentTime() ?? null,
      latency: () => audio.engine()?.latency() ?? null,
    },
    // Imported on demand: importing Tone creates the AudioContext, which must wait for a click.
    render: (spec) => import('./render.ts').then((m) => m.renderPreset(spec)),
  }
}
