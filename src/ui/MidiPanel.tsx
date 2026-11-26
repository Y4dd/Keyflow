import type { ReactNode } from 'react'
import { detectBrowser } from '../input/midi/browser.ts'
import { midi, useMidiStore } from '../state/midi.ts'
import { useSetupSteps } from '../state/setup.ts'
import { StepAction } from './SetupSteps.tsx'

const browser = detectBrowser()
const browserName =
  browser === 'firefox' ? 'Firefox' : browser === 'chromium' ? 'Chrome' : 'Your browser'

// Copy states only what P0-T2 verified (docs/phases/phase-0-foundation.md, Findings).
const PERMISSION_COPY: Record<typeof browser, string> = {
  firefox:
    'Firefox will ask you to add a site permission add-on. Firefox makes it itself to give this ' +
    'site MIDI access; nothing is downloaded from Keyflow. After that, Firefox remembers it.',
  chromium: 'Chrome will ask whether this site may use your MIDI devices. Choose Allow.',
  other: 'Your browser will ask whether this site may use your MIDI devices.',
}

const CLOSE_OTHER_APPS =
  'Close other music apps and other browsers first: on Windows, a keyboard may work with only ' +
  'one app at a time.'

// The Keyboard card. Its tab is decorative: the region is named by aria-label, and the state's
// h2 stays the region's only heading.
function Panel({ children }: { children: ReactNode }) {
  const state = useSetupSteps().keyboard
  return (
    <section className="card" id="keyboard" aria-label="Keyboard" data-state={state}>
      <span className="tab" aria-hidden="true">
        Keyboard
      </span>
      {children}
    </section>
  )
}

export function MidiPanel() {
  const { checking, status, inputs, selectedId, noInputYet, error } = useMidiStore()
  const connect = () => void midi.request()

  if (checking && status !== 'waitingForAddon') {
    return (
      <Panel>
        <p className="muted">Looking for MIDI access...</p>
      </Panel>
    )
  }

  switch (status) {
    case 'unsupported':
      return (
        <Panel>
          <h2 className="title">This browser can't use MIDI keyboards</h2>
          <p>Open Keyflow in Firefox or Chrome on a computer.</p>
        </Panel>
      )

    case 'needsPermission':
      return (
        <Panel>
          <h2 className="title">Connect your keyboard</h2>
          <p>Plug the keyboard in over USB and switch it on, then press Connect.</p>
          <p>{PERMISSION_COPY[browser]}</p>
          <p className="muted small">{CLOSE_OTHER_APPS}</p>
          <StepAction step="keyboard" label="Connect" onClick={connect} />
        </Panel>
      )

    case 'waitingForAddon':
      return (
        <Panel>
          <h2 className="title">Waiting for {browserName}</h2>
          <p>
            {browser === 'firefox'
              ? 'Look for the prompt near the address bar and add the site permission.'
              : 'Look for the prompt near the address bar and allow MIDI access.'}
          </p>
        </Panel>
      )

    case 'denied':
      return (
        <Panel>
          <h2 className="title">MIDI access was refused</h2>
          <p>
            Keyflow needs MIDI access to hear your keyboard. Press Try again. If no prompt appears,{' '}
            {browser === 'other' ? 'the browser' : browserName} may have remembered the refusal for
            this site; look for MIDI in its site settings.
          </p>
          {error && <p className="muted small">Details: {error}</p>}
          <StepAction step="keyboard" label="Try again" onClick={connect} />
        </Panel>
      )

    case 'noDevices':
      return (
        <Panel>
          <h2 className="title">No keyboard found</h2>
          <p>
            MIDI access is on, but no MIDI input is connected. Plug the keyboard in and switch it
            on. Keyflow picks it up without a reload.
          </p>
          <p className="muted small">
            If it's plugged in and still missing, another app may be using it: close music apps and
            other browsers, then unplug it and plug it back in.
          </p>
        </Panel>
      )

    case 'granted':
      return (
        <Panel>
          <h2 className="title">Keyboard connected</h2>
          {inputs.length === 1 ? (
            <p className="muted">{inputs[0].name}</p>
          ) : (
            <label className="field">
              Listen to
              <select
                value={selectedId ?? ''}
                onChange={(e) => midi.select(e.target.value === '' ? null : e.target.value)}
              >
                <option value="">All inputs</option>
                {inputs.map((input) => (
                  <option key={input.id} value={input.id}>
                    {input.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {noInputYet && (
            <p className="hint" role="status">
              Nothing has arrived from the keyboard yet. Press a key. If nothing shows up on the
              keys below, another app may be using the keyboard: close music apps and other
              browsers, then unplug the keyboard and plug it back in.
            </p>
          )}
        </Panel>
      )
  }
}
