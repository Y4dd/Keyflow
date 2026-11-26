// Pure measurements on rendered audio, for automated sound checks (nobody can listen in CI).

export interface WindowStats {
  /** Largest absolute sample. 1 is full scale; above it clips. */
  peak: number
  /** RMS level in dBFS; -Infinity for silence. */
  rmsDb: number
  /**
   * Brightness proxy: RMS of the sample-to-sample difference over the RMS of the signal.
   * Rises with high-frequency content; 0 for silence.
   */
  hf: number
}

export function windowStats(
  samples: ArrayLike<number>,
  sampleRate: number,
  from: number,
  to: number,
): WindowStats {
  const start = Math.max(0, Math.floor(from * sampleRate))
  const end = Math.min(samples.length, Math.floor(to * sampleRate))
  let peak = 0
  let sum = 0
  let diffSum = 0
  for (let i = start; i < end; i++) {
    const x = samples[i]
    const a = Math.abs(x)
    if (a > peak) peak = a
    sum += x * x
    if (i > start) {
      const d = x - samples[i - 1]
      diffSum += d * d
    }
  }
  const n = end - start
  const rms = n > 0 ? Math.sqrt(sum / n) : 0
  return {
    peak,
    rmsDb: rms > 0 ? 20 * Math.log10(rms) : -Infinity,
    hf: sum > 0 ? Math.sqrt(diffSum / sum) : 0,
  }
}

/** Time (s) of the first sample whose magnitude exceeds `threshold`, or null. */
export function onsetTime(samples: ArrayLike<number>, sampleRate: number, threshold: number) {
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) > threshold) return i / sampleRate
  }
  return null
}

/**
 * The fundamental frequency over [from, to] s by autocorrelation, searching minHz to maxHz.
 * Keep the range under an octave, so a multiple of the period can't win. Null for silence or
 * a window shorter than the longest period searched.
 */
export function pitchHz(
  samples: ArrayLike<number>,
  sampleRate: number,
  from: number,
  to: number,
  minHz: number,
  maxHz: number,
): number | null {
  const start = Math.max(0, Math.floor(from * sampleRate))
  const end = Math.min(samples.length, Math.floor(to * sampleRate))
  const minLag = Math.floor(sampleRate / maxHz)
  const maxLag = Math.ceil(sampleRate / minHz)
  const n = end - start - maxLag - 1
  if (n <= 0) return null
  // The same number of products at every lag, so no lag is favoured.
  const corr = (lag: number) => {
    let sum = 0
    for (let i = start; i < start + n; i++) sum += samples[i] * samples[i + lag]
    return sum
  }
  let bestLag = -1
  let best = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    const c = corr(lag)
    if (c > best) {
      best = c
      bestLag = lag
    }
  }
  if (bestLag === -1) return null
  // Parabolic interpolation between neighbouring lags, for better than whole-sample precision.
  const a = corr(bestLag - 1)
  const c = corr(bestLag + 1)
  const denom = a - 2 * best + c
  const shift = denom < 0 ? (a - c) / (2 * denom) : 0
  return sampleRate / (bestLag + shift)
}

/**
 * Gaps of exact silence between sounds lasting 1 to 20 ms: a dropout, heard as a click. A rest in
 * the music is longer (the soul groove's is about 110 ms).
 */
export function dropouts(samples: Float32Array, rate: number): number {
  const [min, max] = [0.001 * rate, 0.02 * rate]
  let count = 0
  let silentFrom = -1
  let sounded = false
  for (let i = 0; i < samples.length; i++) {
    if (samples[i] === 0) {
      if (silentFrom < 0) silentFrom = i
    } else {
      const gap = i - silentFrom
      if (sounded && silentFrom >= 0 && gap >= min && gap < max) count++
      silentFrom = -1
      sounded = true
    }
  }
  return count
}
