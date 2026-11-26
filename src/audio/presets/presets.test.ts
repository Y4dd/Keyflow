import { describe, expect, it } from 'vitest'
import { defaultKnobs, getPreset, PRESETS } from './index.ts'

describe('presets', () => {
  it('are the three Phase 0 presets with unique ids', () => {
    expect(PRESETS.map((p) => p.id)).toEqual(['funk-lead', 'wobble-bass', 'ep-keys'])
    expect(getPreset('ep-keys').name).toBe('EP Keys')
    expect(() => getPreset('nope' as 'ep-keys')).toThrow(/Unknown preset/)
  })

  it('are plain JSON data', () => {
    for (const p of PRESETS) expect(JSON.parse(JSON.stringify(p))).toEqual(p)
  })

  it('use the voice type the spec gives: poly for keys, mono for lead and bass', () => {
    expect(getPreset('ep-keys').voice).toBe('poly')
    expect(getPreset('funk-lead').voice).toBe('mono')
    expect(getPreset('wobble-bass').voice).toBe('mono')
  })

  it('have knob defaults inside their ranges, with sane envelopes', () => {
    for (const p of PRESETS) {
      for (const [id, k] of Object.entries(p.knobs)) {
        expect(k.min, `${p.id}.${id}`).toBeLessThan(k.max)
        expect(k.default, `${p.id}.${id}`).toBeGreaterThanOrEqual(k.min)
        expect(k.default, `${p.id}.${id}`).toBeLessThanOrEqual(k.max)
        if (k.curve === 'log') expect(k.min).toBeGreaterThan(0)
      }
      // Attacks and releases of a few ms or more, so notes start and stop without clicks.
      expect(p.amp.attack).toBeGreaterThanOrEqual(0.002)
      expect(p.amp.release).toBeGreaterThanOrEqual(0.05)
      expect(p.levelDb).toBeLessThan(0)
    }
  })

  it('defaultKnobs lists every knob', () => {
    expect(defaultKnobs(getPreset('wobble-bass'))).toEqual({
      cutoff: 900,
      lfoSync: 1,
      lfoRate: 2,
      drive: 0.4,
    })
  })
})
