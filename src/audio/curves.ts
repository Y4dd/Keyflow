// Small pure conversions shared by the audio engine and its UI. No Tone.js, no DOM.

/** Equal temperament, A4 (MIDI 69) = 440 Hz. */
export function midiToHz(note: number): number {
  return 440 * 2 ** ((note - 69) / 12)
}

export function dbToGain(db: number): number {
  return 10 ** (db / 20)
}

/**
 * Note velocity (0..1) to an amplitude factor. Full velocity is 0 dB; velocity 0 is
 * `rangeDb` below it, so a preset's velocity sensitivity is one number.
 */
export function velocityToGain(velocity: number, rangeDb: number): number {
  const v = Math.min(1, Math.max(0, velocity))
  return dbToGain(-rangeDb * (1 - v))
}

/**
 * EP Keys: the FM modulation index for a note. Harder notes get a higher index, so they sound
 * brighter; `brightness` (0..1, the preset's knob) scales the whole range.
 */
export function fmIndex(velocity: number, brightness: number): number {
  const v = Math.min(1, Math.max(0, velocity))
  const b = Math.min(1, Math.max(0, brightness))
  return (0.5 + 6 * b) * (0.15 + 0.85 * v)
}

/** Where the master's safety clip stops being linear. */
export const SAFETY_KNEE = 0.9

/**
 * The master's safety clip: identity up to ±SAFETY_KNEE, then a tanh bend. At the WaveShaper's
 * input limit (±1) it reaches ±0.976, so the output never reaches full scale.
 */
export function safetyClip(x: number): number {
  const a = Math.abs(x)
  if (a <= SAFETY_KNEE) return x
  const headroom = 1 - SAFETY_KNEE
  return Math.sign(x) * (SAFETY_KNEE + headroom * Math.tanh((a - SAFETY_KNEE) / headroom))
}

export type KnobCurve = 'linear' | 'log'

/** A knob value to a slider position in 0..1. Log knobs (cutoff, rate) spread octaves evenly. */
export function knobToPosition(value: number, min: number, max: number, curve: KnobCurve): number {
  const v = Math.min(max, Math.max(min, value))
  const p = curve === 'log' ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min || 1)
  return Math.min(1, Math.max(0, p))
}

export function positionToKnob(position: number, min: number, max: number, curve: KnobCurve) {
  const p = Math.min(1, Math.max(0, position))
  return curve === 'log' ? min * (max / min) ** p : min + (max - min) * p
}
