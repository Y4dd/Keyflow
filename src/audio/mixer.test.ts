import { describe, expect, it } from 'vitest'
import { channelGains, clampLevel, DEFAULT_MIXER, MAX_LEVEL_DB, MIN_LEVEL_DB } from './mixer.ts'

describe('mixer gains', () => {
  it('every channel at 0 dB unmuted is unity gain', () => {
    expect(channelGains(DEFAULT_MIXER, false)).toEqual({ drums: 1, bass: 1, chords: 1, you: 1 })
  })

  it('a level in dB becomes its gain; a mute silences the channel whatever its level', () => {
    const mixer = {
      ...DEFAULT_MIXER,
      channels: {
        ...DEFAULT_MIXER.channels,
        drums: { db: -6, muted: false },
        chords: { db: 6, muted: true },
      },
    }
    const g = channelGains(mixer, false)
    expect(g.drums).toBeCloseTo(0.501, 3)
    expect(g.chords).toBe(0)
    expect(g.bass).toBe(1)
  })

  it('"you play bass" mutes the groove bass only while the split is on', () => {
    const mixer = { ...DEFAULT_MIXER, youPlayBass: true }
    expect(channelGains(mixer, true).bass).toBe(0)
    expect(channelGains(mixer, false).bass).toBe(1)
    expect(channelGains(mixer, true).you).toBe(1)
  })

  it('levels clamp to the slider range', () => {
    expect(clampLevel(-100)).toBe(MIN_LEVEL_DB)
    expect(clampLevel(40)).toBe(MAX_LEVEL_DB)
    expect(clampLevel(-3)).toBe(-3)
  })
})
