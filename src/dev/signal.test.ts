import { describe, expect, it } from 'vitest'
import { dropouts, onsetTime, pitchHz, windowStats } from './signal.ts'

const RATE = 1000
const sine = (hz: number, amp: number, seconds: number) =>
  Float32Array.from(
    { length: seconds * RATE },
    (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / RATE),
  )

describe('windowStats', () => {
  it('measures peak and RMS', () => {
    const s = windowStats(sine(10, 0.5, 1), RATE, 0, 1)
    expect(s.peak).toBeCloseTo(0.5, 2)
    expect(s.rmsDb).toBeCloseTo(20 * Math.log10(0.5 / Math.SQRT2), 1)
  })

  it('reads -Infinity dB and 0 hf for silence', () => {
    expect(windowStats(new Float32Array(100), RATE, 0, 0.1)).toEqual({
      peak: 0,
      rmsDb: -Infinity,
      hf: 0,
    })
  })

  it('hf rises with frequency', () => {
    const low = windowStats(sine(10, 0.5, 1), RATE, 0, 1).hf
    const high = windowStats(sine(100, 0.5, 1), RATE, 0, 1).hf
    expect(high).toBeGreaterThan(low * 5)
  })

  it('looks only inside the window, clamped to the buffer', () => {
    const x = new Float32Array(1000)
    x[900] = 0.9
    expect(windowStats(x, RATE, 0, 0.5).peak).toBe(0)
    expect(windowStats(x, RATE, 0.5, 5).peak).toBeCloseTo(0.9)
  })
})

describe('onsetTime', () => {
  it('finds the first sample above the threshold', () => {
    const x = new Float32Array(1000)
    x[250] = -0.01
    expect(onsetTime(x, RATE, 0.001)).toBe(0.25)
    expect(onsetTime(new Float32Array(10), RATE, 0.001)).toBeNull()
  })
})

describe('pitchHz', () => {
  const rate = 48000
  const tone = (hz: number, shape: (phase: number) => number) =>
    Float32Array.from({ length: rate / 2 }, (_, i) => shape(((hz * i) / rate) % 1))

  it('finds the fundamental of a sine and a sawtooth within a few cents', () => {
    for (const hz of [220, 246.94]) {
      for (const shape of [(p: number) => Math.sin(2 * Math.PI * p), (p: number) => 2 * p - 1]) {
        const found = pitchHz(tone(hz, shape), rate, 0.1, 0.3, 180, 300)
        expect(Math.abs(1200 * Math.log2(found! / hz))).toBeLessThan(5)
      }
    }
  })

  it('returns null for silence or a window too short to search', () => {
    expect(pitchHz(new Float32Array(rate), rate, 0, 0.5, 180, 300)).toBeNull()
    expect(pitchHz(tone(220, Math.sin), rate, 0, 0.001, 180, 300)).toBeNull()
  })
})

describe('dropouts', () => {
  const run = (...parts: [number, number][]) =>
    Float32Array.from(parts.flatMap(([value, n]) => Array<number>(n).fill(value)))
  it('counts short gaps of exact silence between sounds', () => {
    expect(dropouts(run([0.5, 10], [0, 6], [0.5, 10], [0, 6], [0.5, 1]), RATE)).toBe(2)
  })
  it('ignores silence before the first sound and after the last, and rests', () => {
    expect(dropouts(run([0, 6], [0.5, 10], [0, 6]), RATE)).toBe(0)
    expect(dropouts(run([0.5, 10], [0, 114], [0.5, 10]), RATE)).toBe(0)
  })
})
