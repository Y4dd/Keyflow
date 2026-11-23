// Pure MIDI onboarding state machine (P0-T3). The UI copy for each state lives in
// src/ui/MidiPanel.tsx; the browser glue that feeds events in is connection.ts.

export type OnboardingState =
  | 'unsupported' // no Web MIDI API in this browser
  | 'needsPermission' // ask the user to press Connect (a user gesture)
  | 'waitingForAddon' // the browser's prompt is up (Firefox: the site-permission add-on)
  | 'granted' // access granted and at least one input connected
  | 'denied' // the request was rejected, or the permission is already denied
  | 'noDevices' // access granted but no input is connected

export type PermissionHint = 'granted' | 'prompt' | 'denied' | 'unknown'

export type OnboardingEvent =
  | { type: 'apiMissing' }
  | { type: 'permissionKnown'; permission: PermissionHint }
  /** silent: the permission is already granted, so no prompt is expected. */
  | { type: 'requestStarted'; silent: boolean }
  | { type: 'requestSucceeded'; inputCount: number }
  | { type: 'requestFailed' }
  | { type: 'inputsChanged'; inputCount: number }

export const initialOnboardingState: OnboardingState = 'needsPermission'

export function nextOnboardingState(
  state: OnboardingState,
  event: OnboardingEvent,
): OnboardingState {
  if (state === 'unsupported') return state
  switch (event.type) {
    case 'apiMissing':
      return 'unsupported'
    case 'permissionKnown':
      // Only meaningful before access is granted.
      if (state === 'granted' || state === 'noDevices') return state
      return event.permission === 'denied' ? 'denied' : 'needsPermission'
    case 'requestStarted':
      if (state === 'granted' || state === 'noDevices') return state
      return event.silent ? state : 'waitingForAddon'
    case 'requestSucceeded':
      return event.inputCount > 0 ? 'granted' : 'noDevices'
    case 'requestFailed':
      return 'denied'
    case 'inputsChanged':
      if (state !== 'granted' && state !== 'noDevices') return state
      return event.inputCount > 0 ? 'granted' : 'noDevices'
  }
}
