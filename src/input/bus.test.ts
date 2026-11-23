import { describe, expect, it, vi } from 'vitest'
import { createInputBus } from './bus.ts'
import type { InputEvent } from './types.ts'

const on: InputEvent = { kind: 'noteOn', note: 60, velocity: 0.5, time: 0, source: 'sim' }

describe('createInputBus', () => {
  it('delivers events synchronously to every subscriber', () => {
    const bus = createInputBus()
    const a = vi.fn()
    const b = vi.fn()
    bus.subscribe(a)
    bus.subscribe(b)
    bus.emit(on)
    expect(a).toHaveBeenCalledWith(on)
    expect(b).toHaveBeenCalledWith(on)
  })

  it('stops delivering after unsubscribe, including from inside a listener', () => {
    const bus = createInputBus()
    const self = vi.fn()
    const later = vi.fn()
    const unsubSelf = bus.subscribe((e) => {
      self(e)
      unsubSelf()
    })
    bus.subscribe(later)
    bus.emit(on)
    bus.emit(on)
    expect(self).toHaveBeenCalledTimes(1)
    expect(later).toHaveBeenCalledTimes(2)
  })
})
