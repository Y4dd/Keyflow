import { describe, expect, it } from 'vitest'
import type { InputEvent } from '../types.ts'
import { createPointerPiano, ONSCREEN_VELOCITY } from './pointer.ts'

function setup() {
  const events: InputEvent[] = []
  const piano = createPointerPiano((e) => events.push(e))
  const notes = () =>
    events.map((e) => `${e.kind === 'noteOn' ? '+' : '-'}${'note' in e ? e.note : ''}`)
  return { piano, events, notes }
}

describe('createPointerPiano', () => {
  it('presses on down and releases on up, as source onscreen', () => {
    const t = setup()
    t.piano.down(1, 60, 5)
    t.piano.up(1, 9)
    expect(t.events).toEqual([
      { kind: 'noteOn', note: 60, velocity: ONSCREEN_VELOCITY, time: 5, source: 'onscreen' },
      { kind: 'noteOff', note: 60, time: 9, source: 'onscreen' },
    ])
  })

  it('sliding to another key releases the old note, then presses the new one', () => {
    const t = setup()
    t.piano.down(1, 60, 0)
    t.piano.move(1, 60, 1) // same key: nothing
    t.piano.move(1, 62, 2)
    t.piano.move(1, null, 3) // off the keys
    t.piano.move(1, 64, 4)
    t.piano.up(1, 5)
    expect(t.notes()).toEqual(['+60', '-60', '+62', '-62', '+64', '-64'])
  })

  it('ignores moves and ups from pointers that are not pressed', () => {
    const t = setup()
    t.piano.move(7, 60, 0)
    t.piano.up(7, 0)
    expect(t.events).toEqual([])
  })

  it('two pointers on one key sound it once until both lift', () => {
    const t = setup()
    t.piano.down(1, 60, 0)
    t.piano.down(2, 60, 0)
    t.piano.up(1, 0)
    expect(t.notes()).toEqual(['+60'])
    t.piano.up(2, 0)
    expect(t.notes()).toEqual(['+60', '-60'])
  })

  it('a second down on the same pointer replaces its note', () => {
    const t = setup()
    t.piano.down(1, 60, 0)
    t.piano.down(1, 67, 0)
    expect(t.notes()).toEqual(['+60', '-60', '+67'])
  })

  it('releaseAll lifts every pointer', () => {
    const t = setup()
    t.piano.down(1, 60, 0)
    t.piano.down(2, 64, 0)
    t.piano.releaseAll(1)
    t.piano.up(1, 2)
    expect(t.notes()).toEqual(['+60', '+64', '-60', '-64'])
  })
})
