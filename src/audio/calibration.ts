// The latency tap test (P0-T8): a click plays, the user taps any key on the beat, and the
// median tap offset becomes the calibration offset. Pure: times in, numbers out.
//
// Offset = tap time (the input event's `time`, performance ms) minus the click's time mapped
// to performance ms with contextToPerfMs (src/audio/latency.ts). Positive = taps land after
// the click. Grading must map beats with the same function and subtract this offset.

export const TAP_TEST = {
  bpm: 100,
  /** Clicks in all, count-in included (the spec asks for 8 to 16). */
  beats: 16,
  /** Clicks to settle in on; taps on them don't count. */
  countIn: 4,
}

// shortcut: thresholds are guesses, not measured on the learner; tune them from the P0-T8
// manual check's numbers.
export const MIN_TAPS = 8
export const MAX_SPREAD_MS = 30
/** Taps within this of the median are never outliers, so a very even run can't reject itself. */
export const OUTLIER_FLOOR_MS = 40
const MAD_K = 3 * 1.4826 // three standard deviations, estimated from the median deviation

export type CalibrationVerdict = 'ok' | 'tooFewTaps' | 'tooNoisy'

export interface CalibrationResult {
  /** Median offset of the kept taps, ms; null when no tap counted. */
  offsetMs: number | null
  /** Standard deviation of the kept taps, ms; null when no tap counted. */
  spreadMs: number | null
  /** Beats with a tap kept. */
  used: number
  /** Beats after the count-in. */
  beats: number
  verdict: CalibrationVerdict
}

function median(sorted: readonly number[]): number {
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Matches taps to clicks (both performance ms, clicks ascending) and grades the run. */
export function computeCalibration(
  clicks: readonly number[],
  taps: readonly number[],
  countIn = TAP_TEST.countIn,
): CalibrationResult {
  const beats = Math.max(0, clicks.length - countIn)
  // Each tap goes to its nearest click; each click keeps its closest tap. A tap more than half
  // the click spacing outside the run belongs to no click.
  const half = clicks.length > 1 ? (clicks[1] - clicks[0]) / 2 : Infinity
  const best: (number | undefined)[] = []
  for (const tap of taps) {
    let i = 0
    for (let j = 1; j < clicks.length; j++)
      if (Math.abs(tap - clicks[j]) < Math.abs(tap - clicks[i])) i = j
    const offset = tap - clicks[i]
    if (i < countIn || Math.abs(offset) > half) continue
    const kept = best[i]
    if (kept === undefined || Math.abs(offset) < Math.abs(kept)) best[i] = offset
  }
  const offsets = best.filter((o) => o !== undefined).sort((a, b) => a - b)
  if (offsets.length === 0)
    return { offsetMs: null, spreadMs: null, used: 0, beats, verdict: 'tooFewTaps' }

  const m = median(offsets)
  const mad = median(offsets.map((o) => Math.abs(o - m)).sort((a, b) => a - b))
  const limit = Math.max(MAD_K * mad, OUTLIER_FLOOR_MS)
  const kept = offsets.filter((o) => Math.abs(o - m) <= limit)
  const offsetMs = median(kept)
  const mean = kept.reduce((s, o) => s + o, 0) / kept.length
  const spreadMs = Math.sqrt(kept.reduce((s, o) => s + (o - mean) ** 2, 0) / kept.length)
  // Enough beats tapped but too many rejected is unevenness, not missing taps.
  const verdict =
    offsets.length < MIN_TAPS
      ? 'tooFewTaps'
      : kept.length < MIN_TAPS || spreadMs > MAX_SPREAD_MS
        ? 'tooNoisy'
        : 'ok'
  return { offsetMs, spreadMs, used: kept.length, beats, verdict }
}
