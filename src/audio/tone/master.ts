// Master chain: gain → limiter → safety clip → speakers.
//
// The limiter is a DynamicsCompressor (20:1, 1 ms attack). On its own it is not a ceiling:
// renders of a ten-note full-velocity EP chord peaked at 1.16 through it (P0-T5). The safety
// clip after it is a WaveShaper that is exactly linear up to SAFETY_KNEE and bends smoothly
// toward a maximum below full scale, so the output can't clip. It adds no delay. Normal
// playing stays in its linear part; e2e renders check both.

import * as Tone from 'tone'
import { dbToGain, safetyClip } from '../curves.ts'

export const MASTER_GAIN_DB = -3
export const LIMITER = { threshold: -6, ratio: 20, knee: 0, attack: 0.001, release: 0.1 }

export interface Master {
  readonly input: Tone.Gain
  dispose(): void
}

/**
 * Built in the current context and connected to its destination. `limiter: false` leaves the
 * compressor out (the 6 ms question in the Phase 0 open questions; used by dev renders).
 */
export function createMaster({ limiter: withLimiter = true } = {}): Master {
  const input = new Tone.Gain(dbToGain(MASTER_GAIN_DB))
  const limiter = withLimiter ? new Tone.Compressor(LIMITER) : new Tone.Gain(1)
  // A fixed input channel count: left to follow its inputs as voices start and stop, Firefox's
  // compressor cut 6 ms of silence into every groove dozens of times a bar, heard as ticks in
  // time (renders in tests/e2e/groove.spec.ts).
  limiter.channelCountMode = 'explicit'
  limiter.channelCount = 2
  // Odd length, so 0 maps exactly to 0. Inputs beyond ±1 take the curve's end values.
  const clip = new Tone.WaveShaper(safetyClip, 4097)
  input.chain(limiter, clip, Tone.getDestination())
  return {
    input,
    dispose() {
      input.dispose()
      limiter.dispose()
      clip.dispose()
    },
  }
}
