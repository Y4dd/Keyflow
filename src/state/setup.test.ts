import { describe, expect, it } from 'vitest'
import { stepStates } from './setup.ts'

const done = (keyboard: boolean, sound: boolean, timing: boolean) =>
  stepStates({ keyboard, sound, timing })

describe('stepStates', () => {
  it('makes the first step not done the current one, the rest to do', () => {
    expect(done(false, false, false)).toEqual({ keyboard: 'now', sound: 'todo', timing: 'todo' })
    expect(done(true, false, false)).toEqual({ keyboard: 'done', sound: 'now', timing: 'todo' })
    expect(done(true, true, false)).toEqual({ keyboard: 'done', sound: 'done', timing: 'now' })
  })

  it('keeps a done step done even when an earlier one is not', () => {
    expect(done(false, true, false)).toEqual({ keyboard: 'now', sound: 'done', timing: 'todo' })
    expect(done(false, false, true)).toEqual({ keyboard: 'now', sound: 'todo', timing: 'done' })
  })

  it('has no current step once all are done', () => {
    expect(done(true, true, true)).toEqual({ keyboard: 'done', sound: 'done', timing: 'done' })
  })
})
