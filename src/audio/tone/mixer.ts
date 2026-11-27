// The mixer's buses (P1-T6): one Gain per channel. Drums, bass and chords go through the groove's
// fixed level; your synth goes straight to the master. The engine and the dev groove render
// build the same graph, so a render measures what the engine plays.

import * as Tone from 'tone'
import { dbToGain } from '../curves.ts'
import { CHANNELS, type Channel } from '../mixer.ts'

/** The groove under your playing, before the mixer's own levels. */
export const GROOVE_LEVEL_DB = -3
/** Level changes slide this long, so a mute or a dragged slider doesn't click. */
export const MIX_RAMP_S = 0.02

export interface MixBuses {
  channels: Record<Channel, Tone.Gain>
  /** The groove's fixed level, which the count-in click goes through: a drums mute keeps it. */
  groove: Tone.Gain
}

export function createMixBuses(
  destination: Tone.InputNode,
  gains: Record<Channel, number>,
): MixBuses {
  const groove = new Tone.Gain(dbToGain(GROOVE_LEVEL_DB)).connect(destination)
  const bus = (c: Channel) => new Tone.Gain(gains[c]).connect(c === 'you' ? destination : groove)
  return {
    channels: { drums: bus('drums'), bass: bus('bass'), chords: bus('chords'), you: bus('you') },
    groove,
  }
}

export function setMixGains(buses: MixBuses, gains: Record<Channel, number>, time: number) {
  for (const c of CHANNELS) buses.channels[c].gain.rampTo(gains[c], MIX_RAMP_S, time)
}
