// Dev-only: loaded only when __KEYFLOW_DEV_TOOLS__ is true (dev server, Playwright build).
// The production build doesn't contain this module; CI checks for "__keyflow" in dist.

import { inputBus } from '../input/bus.ts'
import { fixtureToSimEvents, parseFixture } from '../input/sim/fixture.ts'
import { createSimPlayer } from '../input/sim/player.ts'
import { chord, sequence, type SimEvent } from '../input/sim/script.ts'
import { audio } from '../state/audio.ts'
import { calibration } from '../state/calibration.ts'
import { flushSettings } from '../state/settings.ts'
import { BLACK_KEY, WHITE_KEY, ZONE_STRIP } from '../ui/canvas/keyboard.ts'
import { keyPoint, keyRects } from '../ui/canvas/keys.ts'
import type { ExpressionTargets } from '../audio/expression.ts'
import type { LatencyReadout } from '../audio/latency.ts'
import type { ZoneId } from '../audio/zones.ts'
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
    /** Notes the engine holds, both zones together; 0 before audio starts. */
    heldCount(): number
    /** Notes each zone holds (split keyboard, src/audio/zones.ts). */
    heldByZone(): Record<ZoneId, number>
    /** The audio context's clock, s, or null before audio starts. */
    currentTime(): number | null
    latency(): LatencyReadout | null
    /** What the pedal and bends are doing now (src/audio/expression.ts); null before audio. */
    expression(): ExpressionTargets | null
  }
  /** Renders a preset offline and measures it (src/dev/render.ts). Loads Tone.js. */
  render(spec: RenderSpec): Promise<RenderResult>
  /** The running tap test's clicks (performance ms, audio-clock s), or null (P0-T8). */
  calibrationClicks(): { perf: number[]; context: number[] } | null
  /** Writes pending settings to IndexedDB now, so a test can reload (P0-T9). */
  flushSettings(): Promise<void>
  /**
   * A key of the canvas keyboard: a point on it in client px (to click), and whether it's drawn
   * lit (its pixel there isn't the idle key colour). Null if the note isn't on the keyboard.
   */
  pianoKey(note: number): { x: number; y: number; lit: boolean } | null
}

function pianoKey(note: number) {
  const canvas = document.querySelector<HTMLCanvasElement>('canvas.piano-canvas')
  const rect = canvas?.getBoundingClientRect()
  const key = rect && keyRects(rect.width, rect.height, ZONE_STRIP).find((k) => k.note === note)
  if (!canvas || !rect || !key) return null
  const p = keyPoint(key)
  const dpr = canvas.width / rect.width
  const pixel = canvas
    .getContext('2d')!
    .getImageData(Math.floor(p.x * dpr), Math.floor(p.y * dpr), 1, 1).data
  const idle = key.black ? BLACK_KEY : WHITE_KEY
  return {
    x: rect.left + p.x,
    y: rect.top + p.y,
    lit: idle.some((c, i) => c !== pixel[i]),
  }
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
      heldCount: () => {
        const e = audio.engine()
        return e ? e.heldCount('main') + e.heldCount('left') : 0
      },
      heldByZone: () => {
        const e = audio.engine()
        return { main: e?.heldCount('main') ?? 0, left: e?.heldCount('left') ?? 0 }
      },
      currentTime: () => audio.engine()?.currentTime() ?? null,
      latency: () => audio.engine()?.latency() ?? null,
      expression: () => audio.engine()?.expression() ?? null,
    },
    // Imported on demand: importing Tone creates the AudioContext, which must wait for a click.
    render: (spec) => import('./render.ts').then((m) => m.renderPreset(spec)),
    calibrationClicks: () => calibration.clicks(),
    flushSettings,
    pianoKey,
  }
}
