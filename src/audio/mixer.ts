// The mixer (P1-T6): a level and a mute for the groove's drums, bass and chords and for your own
// synth (both zones), plus "you play bass", which mutes the groove bass while the split gives
// your left hand its own sound. Pure: the engine turns these gains into its bus levels.

import { dbToGain } from './curves.ts'

export const CHANNELS = ['drums', 'bass', 'chords', 'you'] as const
export type Channel = (typeof CHANNELS)[number]

export interface ChannelLevel {
  /** Level in dB on top of the channel's fixed level (the groove sits at GROOVE_LEVEL_DB). */
  db: number
  muted: boolean
}

export interface MixerSettings {
  channels: Record<Channel, ChannelLevel>
  /** Mutes the groove bass while the split is on. */
  youPlayBass: boolean
}

export const MIN_LEVEL_DB = -24
export const MAX_LEVEL_DB = 6

const flat: ChannelLevel = { db: 0, muted: false }
export const DEFAULT_MIXER: MixerSettings = {
  channels: { drums: flat, bass: flat, chords: flat, you: flat },
  youPlayBass: false,
}

export const clampLevel = (db: number) => Math.min(MAX_LEVEL_DB, Math.max(MIN_LEVEL_DB, db))

/** Each channel's gain factor; `split` is whether the keyboard split is on. */
export function channelGains(mixer: MixerSettings, split: boolean): Record<Channel, number> {
  const gain = (c: Channel) => {
    const { db, muted } = mixer.channels[c]
    // shortcut: "you play bass" checks only that the split is on, not that the left sound is a
    // bass; check the left preset too if presets ever get a bass category.
    if (muted || (c === 'bass' && mixer.youPlayBass && split)) return 0
    return dbToGain(clampLevel(db))
  }
  return { drums: gain('drums'), bass: gain('bass'), chords: gain('chords'), you: gain('you') }
}
