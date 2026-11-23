import { describe, expect, it } from 'vitest'
import {
  initialOnboardingState,
  nextOnboardingState,
  type OnboardingEvent,
  type OnboardingState,
} from './onboarding.ts'

const run = (events: OnboardingEvent[], from: OnboardingState = initialOnboardingState) =>
  events.reduce(nextOnboardingState, from)

describe('nextOnboardingState', () => {
  it('no Web MIDI API: unsupported, and nothing gets it out', () => {
    expect(run([{ type: 'apiMissing' }])).toBe('unsupported')
    expect(run([{ type: 'apiMissing' }, { type: 'requestSucceeded', inputCount: 1 }])).toBe(
      'unsupported',
    )
  })

  it('first visit: needsPermission, then the prompt, then granted with a device', () => {
    expect(run([{ type: 'permissionKnown', permission: 'prompt' }])).toBe('needsPermission')
    expect(
      run([
        { type: 'permissionKnown', permission: 'prompt' },
        { type: 'requestStarted', silent: false },
      ]),
    ).toBe('waitingForAddon')
    expect(
      run([
        { type: 'permissionKnown', permission: 'prompt' },
        { type: 'requestStarted', silent: false },
        { type: 'requestSucceeded', inputCount: 1 },
      ]),
    ).toBe('granted')
  })

  it('permission query unavailable: still needsPermission', () => {
    expect(run([{ type: 'permissionKnown', permission: 'unknown' }])).toBe('needsPermission')
  })

  it('already granted: the silent request skips waitingForAddon', () => {
    const states: OnboardingState[] = []
    let s = initialOnboardingState
    for (const e of [
      { type: 'permissionKnown', permission: 'granted' },
      { type: 'requestStarted', silent: true },
      { type: 'requestSucceeded', inputCount: 1 },
    ] as const) {
      s = nextOnboardingState(s, e)
      states.push(s)
    }
    expect(states).toEqual(['needsPermission', 'needsPermission', 'granted'])
  })

  it('granted with nothing plugged in: noDevices, then granted on hot-plug and back', () => {
    const noDevices = run([
      { type: 'requestStarted', silent: false },
      { type: 'requestSucceeded', inputCount: 0 },
    ])
    expect(noDevices).toBe('noDevices')
    const plugged = nextOnboardingState(noDevices, { type: 'inputsChanged', inputCount: 1 })
    expect(plugged).toBe('granted')
    expect(nextOnboardingState(plugged, { type: 'inputsChanged', inputCount: 0 })).toBe('noDevices')
  })

  it('rejected request: denied, and the user can try again', () => {
    const denied = run([{ type: 'requestStarted', silent: false }, { type: 'requestFailed' }])
    expect(denied).toBe('denied')
    expect(nextOnboardingState(denied, { type: 'requestStarted', silent: false })).toBe(
      'waitingForAddon',
    )
  })

  it('permission already denied: denied before any request', () => {
    expect(run([{ type: 'permissionKnown', permission: 'denied' }])).toBe('denied')
  })

  it('ignores device changes before access is granted', () => {
    expect(run([{ type: 'inputsChanged', inputCount: 1 }])).toBe('needsPermission')
    expect(run([{ type: 'inputsChanged', inputCount: 1 }], 'waitingForAddon')).toBe(
      'waitingForAddon',
    )
  })

  it('a late permission answer or repeat request does not undo granted access', () => {
    expect(run([{ type: 'permissionKnown', permission: 'prompt' }], 'granted')).toBe('granted')
    expect(run([{ type: 'requestStarted', silent: false }], 'noDevices')).toBe('noDevices')
  })
})
