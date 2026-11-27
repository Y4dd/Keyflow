// Note and key names for display, spelled by key. Pure: no DOM, no Tone. Pitches stay numbers
// everywhere else; this is the display boundary (CLAUDE.md).

import { Key as TonalKey, Note, Scale } from 'tonal'
import type { HarmonyAt, Key, ScaleId } from './harmony.ts'

// Each key as its key signature spells it (the fewest accidentals for the mode).
// shortcut: fixed spellings; the flats-or-sharps question is open in the Phase 1 file.
const TONICS = {
  major: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],
  minor: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'],
}

/** A note name with ♭ and ♯ for b and #. */
export const pretty = (n: string) => n[0] + n.slice(1).replaceAll('b', '♭').replaceAll('#', '♯')

/** "E♭", "C♯": the key's tonic as its key signature spells it. */
export const keyName = (key: Key): string => pretty(TONICS[key.mode][key.tonic]!)

/**
 * The name of each pitch class (index 0..11) in a key with a solo scale: the scale's own
 * spelling first (E minor blues has B♭), then the key's, then flats in a flat key and sharps
 * otherwise. Double accidentals become their plain enharmonic (E♭ minor blues shows A).
 */
export function noteNames(key: Key, scale: ScaleId): string[] {
  const tonic = TONICS[key.mode][key.tonic]!
  const k = key.mode === 'major' ? TonalKey.majorKey(tonic) : TonalKey.minorKey(tonic)
  const keyScale = 'natural' in k ? k.natural.scale : k.scale
  const names = Array.from({ length: 12 }, (_, p) =>
    Note.pitchClass(k.alteration < 0 ? Note.fromMidi(p) : Note.fromMidiSharps(p)),
  )
  for (const n of [...keyScale, ...Scale.get(`${tonic} ${scale}`).notes])
    names[Note.chroma(n)!] = /bb|##/.test(n) ? Note.simplify(n) : n
  return names.map(pretty)
}

/**
 * A chord symbol ("Fm9", "D♭maj7", "Bm7♭5") from a harmony, its root named from `names` (from
 * noteNames). A plain major triad is the root alone.
 */
export const chordSymbol = (h: HarmonyAt, names: readonly string[]): string =>
  names[h.chordRoot]! +
  (h.chordQuality === 'M' ? '' : h.chordQuality.replaceAll('b', '♭').replaceAll('#', '♯'))
