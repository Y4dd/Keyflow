// Which keys light up in jam mode, and how strongly: chord tones, scale tones, other notes.
// Pure: no DOM, no Tone. The canvas keyboard draws the tiers (src/ui/canvas/keyboard.ts).

import { pc, type HarmonyAt } from './harmony.ts'

/** Chord tones strong, scale tones soft, other notes dimmed (never red). */
export type Tier = 'chord' | 'scale' | 'other'

/** Training wheels: 3 all tiers plus note names, 2 all tiers, 1 chord tones only, 0 off. */
export type Wheels = 0 | 1 | 2 | 3

/** A key's tier under a harmony, or null when the level leaves it unmarked. */
export function tierOf(note: number, harmony: HarmonyAt, wheels: Wheels): Tier | null {
  if (wheels === 0) return null
  const p = pc(note)
  if (harmony.chordTones.includes(p)) return 'chord'
  if (wheels === 1) return null
  return harmony.soloScale.includes(p) ? 'scale' : 'other'
}
