// Scale-aware bend (P1-T5), pure: how far a note bends to reach the next tone of the solo
// scale. Pentatonic and blues scales have 3-semitone gaps, so a step is 1 to 3 semitones.

import { pc } from './harmony.ts'

/** Semitones from `note` to the nearest scale tone strictly above (dir 1) or below (dir -1). */
export function scaleStep(note: number, scale: readonly number[], dir: 1 | -1): number {
  for (let s = 1; s < 12; s++) if (scale.includes(pc(note + dir * s))) return s
  return 12 // a one-note scale reaches its octave
}

/** A bend of `amount` steps (-1 to 1) on `note`, in semitones. */
export const scaleBend = (note: number, amount: number, scale: readonly number[]): number =>
  amount * scaleStep(note, scale, amount < 0 ? -1 : 1)
