// The real-browser MidiEnv for connection.ts.

import type { MidiAccessLike, MidiEnv } from './connection.ts'
import type { PermissionHint } from './onboarding.ts'

export type BrowserKind = 'firefox' | 'chromium' | 'other'

/** Only used to pick onboarding copy; behaviour never depends on it. */
export function detectBrowser(userAgent: string = navigator.userAgent): BrowserKind {
  if (/Firefox\//.test(userAgent)) return 'firefox'
  if (/Chrome\/|Chromium\//.test(userAgent)) return 'chromium'
  return 'other'
}

export function browserMidiEnv(): MidiEnv {
  return {
    // Absent outside secure contexts and in browsers without Web MIDI.
    requestAccess:
      typeof navigator.requestMIDIAccess === 'function'
        ? // The real MIDIAccess has a wider event type than MidiAccessLike declares.
          () => navigator.requestMIDIAccess({ sysex: false }) as unknown as Promise<MidiAccessLike>
        : null,
    async queryPermission(): Promise<PermissionHint> {
      try {
        // Worked in Firefox 160 and Chrome 158 in P0-T2; may throw or be missing elsewhere.
        const status = await navigator.permissions.query({ name: 'midi' as PermissionName })
        return status.state
      } catch {
        return 'unknown'
      }
    },
    now: () => performance.now(),
    setTimer: (fn, ms) => window.setTimeout(fn, ms),
    clearTimer: (handle) => window.clearTimeout(handle as number),
  }
}
