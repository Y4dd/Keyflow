// Reading the output latency through Tone.js's context.
//
// Tone wraps the browser's AudioContext in standardized-audio-context (25.3.77 here). The
// wrapper has baseLatency but neither outputLatency nor getOutputTimestamp, and exports no way
// to reach the native context; Tone.setContext(nativeContext) throws "param must be an
// AudioParam" in Firefox (P0-T2). So this reads the wrapper's private _nativeAudioContext
// field: the one place that does, feature-checked, returning nulls if the field ever changes.
// An e2e test (tests/e2e/audio.spec.ts) asserts the readout in both browsers, so a library
// upgrade that breaks this fails CI. Decision logged in PLAN.md (2026-11-23).

export interface NativeTiming {
  outputLatency?: number
  getOutputTimestamp?: () => { contextTime?: number; performanceTime?: number }
}

export interface LatencyReadout {
  /** Seconds-to-ms of the context's baseLatency, or null if not reported. */
  baseLatencyMs: number | null
  /** The browser's estimate of output (device) latency, ms, or null if unreachable. */
  outputLatencyMs: number | null
  /** Whether getOutputTimestamp() is callable (P0-T8 maps input to audio time with it). */
  outputTimestamp: boolean
  sampleRate: number | null
}

/** The native AudioContext behind a standardized-audio-context wrapper, or null. */
export function nativeContextOf(wrapped: unknown): NativeTiming | null {
  if (typeof wrapped !== 'object' || wrapped === null) return null
  const native = (wrapped as { _nativeAudioContext?: unknown })._nativeAudioContext
  if (typeof native !== 'object' || native === null) return null
  // Duck-typed so it also works on test fakes; a real one has both.
  if (!('currentTime' in native) || !('destination' in native)) return null
  return native as NativeTiming
}

const ms = (seconds: unknown) =>
  typeof seconds === 'number' && Number.isFinite(seconds) ? seconds * 1000 : null

export function readLatency(wrapped: unknown): LatencyReadout {
  const w = (typeof wrapped === 'object' && wrapped !== null ? wrapped : {}) as {
    baseLatency?: unknown
    sampleRate?: unknown
  }
  const native = nativeContextOf(wrapped)
  return {
    baseLatencyMs: ms(w.baseLatency),
    outputLatencyMs: ms(native?.outputLatency),
    outputTimestamp: typeof native?.getOutputTimestamp === 'function',
    sampleRate: typeof w.sampleRate === 'number' ? w.sampleRate : null,
  }
}

/** One moment read on both clocks: the audio clock (s) and performance time (ms). */
export interface ClockPair {
  contextTime: number
  performanceTime: number
  /**
   * How much later getOutputTimestamp() puts a sound than reading currentTime and
   * performance.now() together does, ms; null when that pair was used (no sane timestamp).
   */
  outputTimestampLeadMs: number | null
}

// A getOutputTimestamp() reading further than this from currentTime and performance.now() is
// taken as broken (a guard against zero or stale readings; none observed yet).
const SANE_LEAD_MS = 500

/**
 * Pairs the clocks: getOutputTimestamp() when it reads sane, else `currentTime` (s) and
 * `perfNow` (ms) read together by the caller. Calibration and grading must both map with this.
 */
export function readClock(wrapped: unknown, perfNow: number, currentTime: number): ClockPair {
  const fallback = {
    contextTime: currentTime,
    performanceTime: perfNow,
    outputTimestampLeadMs: null,
  }
  const ts = nativeContextOf(wrapped)?.getOutputTimestamp?.()
  const { contextTime, performanceTime } = ts ?? {}
  if (
    typeof contextTime !== 'number' ||
    typeof performanceTime !== 'number' ||
    !(contextTime > 0) ||
    !(performanceTime > 0)
  )
    return fallback
  const lead = performanceTime - perfNow + (currentTime - contextTime) * 1000
  if (!Number.isFinite(lead) || Math.abs(lead) > SANE_LEAD_MS) return fallback
  return { contextTime, performanceTime, outputTimestampLeadMs: lead }
}

/** An audio-clock time (s) in performance time (ms). */
export const contextToPerfMs = (clock: ClockPair, contextTime: number) =>
  clock.performanceTime + (contextTime - clock.contextTime) * 1000
