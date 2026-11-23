// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { isTextEntry } from './keyboard.ts'

const input = (type: string) => Object.assign(document.createElement('input'), { type })

describe('isTextEntry', () => {
  it('lets the computer keys play after clicking a preset, knob or button', () => {
    for (const type of ['radio', 'checkbox', 'range', 'button']) {
      expect(isTextEntry(input(type)), type).toBe(false)
    }
    expect(isTextEntry(document.createElement('button'))).toBe(false)
    expect(isTextEntry(document.body)).toBe(false)
    expect(isTextEntry(null)).toBe(false)
  })

  it('leaves typing alone in fields that take letters', () => {
    for (const type of ['text', 'search', 'email', 'number', 'password']) {
      expect(isTextEntry(input(type)), type).toBe(true)
    }
    expect(isTextEntry(document.createElement('textarea'))).toBe(true)
    expect(isTextEntry(document.createElement('select'))).toBe(true)
  })
})
