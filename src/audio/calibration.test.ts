import { describe, expect, it } from 'vitest'
import { computeCalibration, MAX_SPREAD_MS, TAP_TEST } from './calibration.ts'

const BEAT = 600
// 16 clicks, 600 ms apart, starting at 1000 ms.
const clicks = Array.from({ length: 16 }, (_, i) => 1000 + i * BEAT)
const graded = clicks.slice(TAP_TEST.countIn)
const tapsAt = (offsets: number[]) => offsets.map((o, i) => graded[i] + o)

describe('computeCalibration', () => {
  it('takes the median offset of taps after the count-in', () => {
    const taps = tapsAt([40, 42, 38, 41, 39, 40, 43, 37, 40, 41, 39, 40])
    // Taps during the count-in don't count, even far off the beat.
    taps.push(clicks[0] + 250, clicks[2] - 200)
    const r = computeCalibration(clicks, taps)
    expect(r.verdict).toBe('ok')
    expect(r.offsetMs).toBe(40)
    expect(r.used).toBe(12)
    expect(r.beats).toBe(12)
    expect(r.spreadMs).toBeLessThan(2)
  })

  it('reports taps before the click as a negative offset', () => {
    const r = computeCalibration(clicks, tapsAt(Array(12).fill(-25)))
    expect(r.offsetMs).toBe(-25)
    expect(r.spreadMs).toBe(0)
  })

  it('rejects outliers before taking the median and spread', () => {
    const offsets = [30, 32, 28, 31, 29, 30, 250, 30, -200, 31, 29, 30]
    const r = computeCalibration(clicks, tapsAt(offsets))
    expect(r.verdict).toBe('ok')
    expect(r.used).toBe(10)
    expect(r.offsetMs).toBe(30)
    expect(r.spreadMs).toBeLessThan(2)
  })

  it('keeps a tight run whole: the outlier floor stops a near-zero spread rejecting itself', () => {
    const offsets = [40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 41, 60]
    const r = computeCalibration(clicks, tapsAt(offsets))
    expect(r.used).toBe(12)
  })

  it('keeps the closest of several taps on one beat and ignores taps past the last beat', () => {
    const taps = tapsAt(Array(12).fill(20))
    taps.push(graded[3] + 150) // a double tap on one beat
    taps.push(clicks[15] + BEAT) // after the run
    const r = computeCalibration(clicks, taps)
    expect(r.used).toBe(12)
    expect(r.offsetMs).toBe(20)
  })

  it('assigns each tap to the nearest beat, even a tap closer to the next click', () => {
    // 350 ms late is nearer the next click (250 ms early): it counts there, where the beat's
    // own tap is closer, so the first beat goes without.
    const taps = tapsAt(Array(12).fill(10))
    taps[0] = graded[0] + 350
    const r = computeCalibration(clicks, taps)
    expect(r.used).toBe(11)
    expect(r.offsetMs).toBe(10)
  })

  it('needs enough taps', () => {
    const r = computeCalibration(clicks, tapsAt([40, 40, 40, 40, 40]))
    expect(r.verdict).toBe('tooFewTaps')
    expect(r.used).toBe(5)
    expect(computeCalibration(clicks, []).offsetMs).toBeNull()
  })

  it('asks for a retry when the taps are too uneven', () => {
    const offsets = [-10, 90, -10, 90, -10, 90, -10, 90, -10, 90, -10, 90]
    const r = computeCalibration(clicks, tapsAt(offsets))
    expect(r.verdict).toBe('tooNoisy')
    expect(r.spreadMs).toBeGreaterThan(MAX_SPREAD_MS)
    expect(r.offsetMs).toBe(40)
  })

  it('calls every beat tapped but many rejected uneven, not too few taps', () => {
    const offsets = [30, 30, 30, 30, 30, 30, 30, 120, 120, 120, 120, 120]
    const r = computeCalibration(clicks, tapsAt(offsets))
    expect(r.used).toBe(7)
    expect(r.verdict).toBe('tooNoisy')
  })

  it('works with taps given in any order', () => {
    const taps = tapsAt([40, 42, 38, 41, 39, 40, 43, 37, 40, 41, 39, 40]).reverse()
    expect(computeCalibration(clicks, taps).offsetMs).toBe(40)
  })
})
