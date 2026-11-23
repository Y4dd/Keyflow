import { describe, expect, it } from 'vitest'
import { createMidiParser } from './parse.ts'

describe('createMidiParser: notes', () => {
  it('turns note-on into noteOn with velocity scaled to 0..1', () => {
    const p = createMidiParser()
    expect(p.parse([0x90, 60, 127], 5)).toEqual({
      kind: 'noteOn',
      note: 60,
      velocity: 1,
      time: 5,
      source: 'midi',
    })
    expect(p.parse([0x90, 61, 1], 6)).toMatchObject({ kind: 'noteOn', velocity: 1 / 127 })
  })

  it('treats note-on with velocity 0 as noteOff (how the YPT-380 releases keys)', () => {
    const p = createMidiParser()
    p.parse([0x90, 60, 100], 0)
    expect(p.parse([0x90, 60, 0], 10)).toEqual({
      kind: 'noteOff',
      note: 60,
      time: 10,
      source: 'midi',
    })
  })

  it('handles 0x80 note-off too, for other keyboards', () => {
    const p = createMidiParser()
    expect(p.parse([0x80, 60, 64], 1)).toMatchObject({ kind: 'noteOff', note: 60 })
  })

  it('accepts notes on every channel', () => {
    const p = createMidiParser()
    expect(p.parse([0x91, 62, 90], 0)).toMatchObject({ kind: 'noteOn', note: 62 })
    expect(p.parse([0x92, 64, 90], 0)).toMatchObject({ kind: 'noteOn', note: 64 })
    expect(p.parse([0x9f, 65, 90], 0)).toMatchObject({ kind: 'noteOn', note: 65 })
  })

  it('does not clamp notes to the 61-key range (transpose shifts them)', () => {
    const p = createMidiParser()
    expect(p.parse([0x90, 33, 90], 0)).toMatchObject({ kind: 'noteOn', note: 33 })
    expect(p.parse([0x90, 108, 90], 0)).toMatchObject({ kind: 'noteOn', note: 108 })
  })
})

describe('createMidiParser: sustain pedal', () => {
  // The exact burst captured from the YPT-380 in P0-T2 (Chrome run, raw log).
  const press = [
    [0xb0, 64, 127],
    [0xb1, 64, 127],
    [0xb2, 64, 0],
  ]
  const release = [
    [0xb0, 64, 0],
    [0xb1, 64, 0],
    [0xb2, 64, 0],
  ]
  const feed = (p: ReturnType<typeof createMidiParser>, msgs: number[][], time: number) =>
    msgs.map((m) => p.parse(m, time)).filter((e) => e !== null)

  it('turns the 3-channel press burst into exactly one pedal-down', () => {
    const p = createMidiParser()
    expect(feed(p, press, 11059)).toEqual([
      { kind: 'pedal', down: true, time: 11059, source: 'midi' },
    ])
  })

  it('turns the 3-channel release burst into exactly one pedal-up', () => {
    const p = createMidiParser()
    feed(p, press, 0)
    expect(feed(p, release, 14832)).toEqual([
      { kind: 'pedal', down: false, time: 14832, source: 'midi' },
    ])
  })

  it('stays down while any channel is >= 64, even if the last message says 0', () => {
    const p = createMidiParser()
    feed(p, press, 0)
    expect(p.parse([0xb2, 64, 0], 1)).toBeNull()
    expect(p.parse([0xb0, 64, 0], 2)).toBeNull() // ch 2 still 127
    expect(p.parse([0xb1, 64, 0], 3)).toMatchObject({ kind: 'pedal', down: false })
  })

  it('uses 64 as the threshold', () => {
    const p = createMidiParser()
    expect(p.parse([0xb0, 64, 63], 0)).toBeNull()
    expect(p.parse([0xb0, 64, 64], 0)).toMatchObject({ kind: 'pedal', down: true })
    expect(p.parse([0xb0, 64, 63], 0)).toMatchObject({ kind: 'pedal', down: false })
  })

  it('inverted: inverts the any-channel aggregate, so a constant channel-3 zero is harmless', () => {
    const p = createMidiParser({ invertPedal: true })
    // A reversed pedal at rest sends high values; channel 3's zero must not read as "down".
    expect(feed(p, press, 0)).toEqual([])
    // Pressing a reversed pedal sends low values on every channel.
    expect(feed(p, release, 1)).toEqual([{ kind: 'pedal', down: true, time: 1, source: 'midi' }])
    expect(feed(p, press, 2)).toEqual([{ kind: 'pedal', down: false, time: 2, source: 'midi' }])
  })

  it('emits nothing for the pedal before the first CC64, even when inverted', () => {
    const p = createMidiParser({ invertPedal: true })
    expect(p.setInvertPedal(true, 0)).toBeNull()
    expect(p.parse([0x90, 60, 100], 0)).toMatchObject({ kind: 'noteOn' })
  })

  it('setInvertPedal flips the effective state once a CC64 has been seen', () => {
    const p = createMidiParser()
    feed(p, release, 0)
    expect(p.setInvertPedal(true, 5)).toEqual({
      kind: 'pedal',
      down: true,
      time: 5,
      source: 'midi',
    })
    expect(p.setInvertPedal(false, 6)).toMatchObject({ kind: 'pedal', down: false })
  })
})

describe('createMidiParser: ignored messages', () => {
  it.each([
    ['clock', [0xf8]],
    ['active sensing', [0xfe]],
    ['start', [0xfa]],
    ['reset', [0xff]],
    ['bank select MSB', [0xb0, 0, 0]],
    ['bank select LSB', [0xb0, 32, 3]],
    ['volume', [0xb0, 7, 100]],
    ['pan', [0xb0, 10, 64]],
    ['release time', [0xb0, 72, 64]],
    ['reverb send', [0xb0, 91, 40]],
    ['program change', [0xc0, 5]],
    ['channel pressure', [0xd0, 40]],
    ['poly aftertouch', [0xa0, 60, 40]],
    ['pitch bend', [0xe0, 0, 64]],
    ['sysex', [0xf0, 0x43, 0x10, 0xf7]],
    ['song position', [0xf2, 0, 0]],
    ['stray data byte', [0x40, 0x40]],
    ['truncated note-on', [0x90, 60]],
    ['empty', []],
  ])('ignores %s', (_name, bytes) => {
    const p = createMidiParser()
    expect(p.parse(bytes, 0)).toBeNull()
  })

  it('ignoring the voice-change burst leaves note and pedal state alone', () => {
    const p = createMidiParser()
    p.parse([0x90, 60, 100], 0)
    p.parse([0xb0, 64, 127], 0)
    for (const m of [
      [0xb0, 0, 0],
      [0xb0, 32, 0],
      [0xc0, 0],
      [0xb0, 7, 100],
      [0xb0, 10, 64],
      [0xb0, 72, 64],
      [0xb0, 91, 40],
    ]) {
      p.parse(m, 1)
    }
    expect(p.releaseAll(2)).toEqual([
      { kind: 'noteOff', note: 60, time: 2, source: 'midi' },
      { kind: 'pedal', down: false, time: 2, source: 'midi' },
    ])
  })
})

describe('createMidiParser: releaseAll', () => {
  it('releases held notes and the pedal, then resets', () => {
    const p = createMidiParser()
    p.parse([0x90, 60, 100], 0)
    p.parse([0x90, 64, 100], 0)
    p.parse([0x90, 67, 100], 0)
    p.parse([0x90, 64, 0], 1)
    p.parse([0xb0, 64, 127], 1)
    expect(p.releaseAll(9)).toEqual([
      { kind: 'noteOff', note: 60, time: 9, source: 'midi' },
      { kind: 'noteOff', note: 67, time: 9, source: 'midi' },
      { kind: 'pedal', down: false, time: 9, source: 'midi' },
    ])
    expect(p.releaseAll(10)).toEqual([])
    // After a reset the pedal starts from "up" again.
    expect(p.parse([0xb2, 64, 0], 11)).toBeNull()
  })
})
