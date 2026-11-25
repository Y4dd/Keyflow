import { describe, expect, it } from 'vitest'
import { contextToPerfMs, nativeContextOf, readClock, readLatency } from './latency.ts'

const native = {
  currentTime: 1.5,
  destination: {},
  outputLatency: 0.04,
  getOutputTimestamp: () => ({ contextTime: 1.4, performanceTime: 1000 }),
}

describe('readLatency', () => {
  it('reads base latency from the wrapper and output latency from the native context', () => {
    const wrapped = { baseLatency: 0.01, sampleRate: 48000, _nativeAudioContext: native }
    expect(readLatency(wrapped)).toEqual({
      baseLatencyMs: 10,
      outputLatencyMs: 40,
      outputTimestamp: true,
      sampleRate: 48000,
    })
  })

  it('returns nulls, not errors, when the private field is missing or changes shape', () => {
    const expected = {
      baseLatencyMs: 0,
      outputLatencyMs: null,
      outputTimestamp: false,
      sampleRate: 44100,
    }
    expect(readLatency({ baseLatency: 0, sampleRate: 44100 })).toEqual(expected)
    expect(readLatency({ baseLatency: 0, sampleRate: 44100, _nativeAudioContext: 5 })).toEqual(
      expected,
    )
    expect(
      readLatency({ baseLatency: 0, sampleRate: 44100, _nativeAudioContext: { foo: 1 } }),
    ).toEqual(expected)
    expect(readLatency(null)).toEqual({
      baseLatencyMs: null,
      outputLatencyMs: null,
      outputTimestamp: false,
      sampleRate: null,
    })
  })

  it('treats a non-finite outputLatency as not reported', () => {
    const wrapped = { _nativeAudioContext: { ...native, outputLatency: Number.NaN } }
    expect(readLatency(wrapped).outputLatencyMs).toBeNull()
  })
})

describe('nativeContextOf', () => {
  it('finds the native context only when it looks like one', () => {
    expect(nativeContextOf({ _nativeAudioContext: native })).toBe(native)
    expect(nativeContextOf({ _nativeAudioContext: { currentTime: 0 } })).toBeNull()
    expect(nativeContextOf(undefined)).toBeNull()
  })
})

describe('readClock', () => {
  const at = (ts: unknown) => ({
    _nativeAudioContext: { currentTime: 0, destination: {}, getOutputTimestamp: () => ts },
  })

  it('pairs the clocks from getOutputTimestamp and reports its lead', () => {
    // currentTime 2.0 s at perf 5000 ms; the timestamp says 1.99 s leaves at 5030 ms.
    const clock = readClock(at({ contextTime: 1.99, performanceTime: 5030 }), 5000, 2.0)
    expect(clock.contextTime).toBe(1.99)
    expect(clock.outputTimestampLeadMs).toBeCloseTo(40)
    expect(contextToPerfMs(clock, 2.5)).toBeCloseTo(5540)
  })

  it('falls back to currentTime and performance.now() when the timestamp is missing or off', () => {
    const fallback = { contextTime: 2, performanceTime: 5000, outputTimestampLeadMs: null }
    expect(readClock({}, 5000, 2)).toEqual(fallback)
    expect(readClock(at({ contextTime: 0, performanceTime: 0 }), 5000, 2)).toEqual(fallback)
    expect(readClock(at({ contextTime: 1.9 }), 5000, 2)).toEqual(fallback)
    expect(readClock(at({ contextTime: 2, performanceTime: 9000 }), 5000, 2)).toEqual(fallback)
    expect(contextToPerfMs(fallback, 2.6)).toBeCloseTo(5600)
  })
})
