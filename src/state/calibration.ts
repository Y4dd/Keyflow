// The latency tap test (P0-T8). Clicks are scheduled on the audio clock up front; taps are
// the input events' own timestamps, collected off the input bus. The store changes when a run
// starts and ends, never per tap. Math: src/audio/calibration.ts.

import { create } from 'zustand'
import { computeCalibration, TAP_TEST, type CalibrationResult } from '../audio/calibration.ts'
import { contextToPerfMs } from '../audio/latency.ts'
import { inputBus } from '../input/bus.ts'
import { audio, useAudioStore } from './audio.ts'

export interface CalibrationState {
  running: boolean
  /** The latest run's result, usable or not. */
  last: CalibrationResult | null
  /**
   * The offset in use (ms, positive = taps land after the click): the last usable run's.
   * shortcut: not saved, so a reload forgets it; P0-T9 persists it with the other settings.
   */
  offsetMs: number | null
  /**
   * The clock mapping's getOutputTimestamp lead (ms) when the offset in use was measured, null
   * if it used the fallback pair. Kept with the offset: the two mappings differ by this, so
   * grading can tell which one the offset came from. P0-T9 must save it with the offset.
   */
  outputTimestampLeadMs: number | null
}

export const useCalibrationStore = create<CalibrationState>(() => ({
  running: false,
  last: null,
  offsetMs: null,
  outputTimestampLeadMs: null,
}))

const set = useCalibrationStore.setState

const BEAT_S = 60 / TAP_TEST.bpm
// Time from pressing the button to the first click.
const LEAD_S = 0.5
const BEATS_PER_BAR = 4 // the accented click

let run: {
  clicks: number[]
  contextTimes: number[]
  taps: number[]
  lead: number | null
  stop: () => void
} | null = null

function end() {
  run?.stop()
  run = null
}

export const calibration = {
  /** Starts a run; does nothing unless sound is running. */
  start() {
    const engine = audio.engine()
    if (run || !engine || engine.state() !== 'running') return
    const clock = engine.clock()
    const first = engine.currentTime() + LEAD_S
    const contextTimes = Array.from({ length: TAP_TEST.beats }, (_, i) => first + i * BEAT_S)
    const clicks = contextTimes.map((t) => contextToPerfMs(clock, t))
    const taps: number[] = []
    const stopClicks = engine.playClicks(contextTimes, BEATS_PER_BAR)
    const unsubscribe = inputBus.subscribe((e) => {
      if (e.kind === 'noteOn') taps.push(e.time)
    })
    // Half a beat after the last click, the last tap is in.
    const timer = window.setTimeout(
      () => {
        const done = run
        end()
        if (!done) return
        const last = computeCalibration(done.clicks, done.taps)
        set(
          last.verdict === 'ok'
            ? { running: false, last, offsetMs: last.offsetMs, outputTimestampLeadMs: done.lead }
            : { running: false, last },
        )
      },
      clicks[clicks.length - 1] + (BEAT_S * 1000) / 2 - performance.now(),
    )
    run = {
      clicks,
      contextTimes,
      taps,
      lead: clock.outputTimestampLeadMs,
      stop() {
        window.clearTimeout(timer)
        unsubscribe()
        stopClicks()
      },
    }
    set({ running: true })
  },

  cancel() {
    if (!run) return
    end()
    set({ running: false })
  },

  /** Dev tools: the running test's clicks, in performance ms and audio-clock s. */
  clicks: () => (run ? { perf: run.clicks, context: run.contextTimes } : null),
}

// Sound stopping mid-run (the browser paused it) stops the test; its clicks would be wrong.
useAudioStore.subscribe((s) => {
  if (s.status !== 'running') calibration.cancel()
})
