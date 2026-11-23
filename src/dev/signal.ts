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
