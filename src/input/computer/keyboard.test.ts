import { describe, expect, it } from 'vitest'
import type { InputEvent } from '../types.ts'
import {
  COMPUTER_VELOCITY,
  createComputerKeyboard,
  MAX_BASE_NOTE,
  MIN_BASE_NOTE,
} from './keyboard.ts'

function setup(base?: number) {
  const events: InputEvent[] = []
  const kb = createComputerKeyboard((e) => events.push(e), base)
  const notes = () =>
    events.map((e) => `${e.kind === 'noteOn' ? '+' : '-'}${'note' in e ? e.note : ''}`)
  return { kb, events, notes }
}

describe('createComputerKeyboard', () => {
  it('plays the home row as white keys and the row above as black keys, from C4', () => {
    const t = setup()
    for (const code of ['KeyA', 'KeyW', 'KeyS', 'KeyJ', 'KeyK', 'Quote']) t.kb.keyDown(code, 0)
    expect(t.notes()).toEqual(['+60', '+61', '+62', '+71', '+72', '+77'])
    expect(t.events[0]).toEqual({
      kind: 'noteOn',
      note: 60,
      velocity: COMPUTER_VELOCITY,
      time: 0,
      source: 'computer',
    })
  })

  it('reports which keys it handles', () => {
    const t = setup()
    expect(t.kb.keyDown('KeyQ', 0)).toBe(false)
    expect(t.kb.keyDown('KeyA', 0)).toBe(true)
    expect(t.kb.keyDown('KeyZ', 0)).toBe(true)
    expect(t.kb.keyUp('KeyQ', 0)).toBe(false)
    expect(t.kb.keyUp('KeyA', 0)).toBe(true)
  })

  it('ignores auto-repeat and releases on keyup', () => {
    const t = setup()
    t.kb.keyDown('KeyA', 0)
    t.kb.keyDown('KeyA', 30)
    t.kb.keyDown('KeyA', 60)
    t.kb.keyUp('KeyA', 90)
    expect(t.events).toEqual([
      { kind: 'noteOn', note: 60, velocity: COMPUTER_VELOCITY, time: 0, source: 'computer' },
      { kind: 'noteOff', note: 60, time: 90, source: 'computer' },
    ])
  })

  it('Z and X shift by an octave within C1..C7, notifying listeners', () => {
    const t = setup()
    let changes = 0
    t.kb.subscribe(() => changes++)
    const tap = (code: string) => {
      t.kb.keyDown(code, 0)
      t.kb.keyUp(code, 0)
    }
    tap('KeyX')
    expect(t.kb.getBaseNote()).toBe(72)
    tap('KeyZ')
    tap('KeyZ')
    expect(t.kb.getBaseNote()).toBe(48)
    expect(changes).toBe(3)
    for (let i = 0; i < 10; i++) tap('KeyZ')
    expect(t.kb.getBaseNote()).toBe(MIN_BASE_NOTE)
    for (let i = 0; i < 10; i++) tap('KeyX')
    expect(t.kb.getBaseNote()).toBe(MAX_BASE_NOTE)
    expect(MAX_BASE_NOTE + 17).toBeLessThanOrEqual(127)
  })

  it('a held Z or X shifts once, however long it auto-repeats', () => {
    const t = setup()
    t.kb.keyDown('KeyX', 0)
    t.kb.keyDown('KeyX', 30)
    t.kb.keyDown('KeyX', 60)
    expect(t.kb.getBaseNote()).toBe(72)
    t.kb.keyUp('KeyX', 90)
    t.kb.keyDown('KeyX', 120)
    expect(t.kb.getBaseNote()).toBe(84)
    t.kb.releaseAll(130) // focus lost while X was down: the next press shifts again
    t.kb.keyDown('KeyX', 140)
    expect(t.kb.getBaseNote()).toBe(96)
  })

  it('a key held across an octave shift releases the note it started', () => {
    const t = setup()
    t.kb.keyDown('KeyA', 0) // C4
    t.kb.keyDown('KeyX', 0)
    t.kb.keyUp('KeyA', 0)
    expect(t.notes()).toEqual(['+60', '-60'])
  })

  it('two keys on the same pitch (after a shift) sound it once until both are up', () => {
    const t = setup()
    t.kb.keyDown('KeyK', 0) // C5 (72)
    t.kb.keyDown('KeyX', 0)
    t.kb.keyDown('KeyA', 0) // now also C5
    t.kb.keyUp('KeyK', 0)
    expect(t.notes()).toEqual(['+72'])
    t.kb.keyUp('KeyA', 0)
    expect(t.notes()).toEqual(['+72', '-72'])
  })

  it('releaseAll releases every held note once', () => {
    const t = setup()
    t.kb.keyDown('KeyD', 0)
    t.kb.keyDown('KeyA', 0)
    t.kb.releaseAll(5)
    t.kb.keyUp('KeyA', 6) // the keyup that arrives later is ignored
    expect(t.notes()).toEqual(['+64', '+60', '-60', '-64'])
  })

  it('unsubscribe stops notifications', () => {
    const t = setup()
    let changes = 0
    const off = t.kb.subscribe(() => changes++)
    off()
    t.kb.keyDown('KeyX', 0)
    expect(changes).toBe(0)
  })
})
