import { describe, expect, it } from 'vitest'
import { nativeContextOf, readLatency } from './latency.ts'

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
