import { detectBrowser } from '../input/midi/browser.ts'
import { midi, useMidiStore } from '../state/midi.ts'

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

export function MidiPanel() {
  const { checking, status, inputs, selectedId, noInputYet, error } = useMidiStore()
  const connect = () => void midi.request()

  if (checking && status !== 'waitingForAddon') {
    return (
      <section className="panel" aria-label="Keyboard">
        <p className="muted">Looking for MIDI access...</p>
      </section>
    )
  }

  switch (status) {
    case 'unsupported':
      return (
        <section className="panel" aria-label="Keyboard">
          <h2>This browser can't use MIDI keyboards</h2>
          <p>Open Keyflow in Firefox or Chrome on a computer.</p>
        </section>
      )

    case 'needsPermission':
      return (
        <section className="panel" aria-label="Keyboard">
          <h2>Connect your keyboard</h2>
          <p>Plug the keyboard in over USB and switch it on, then press Connect.</p>
          <p>{PERMISSION_COPY[browser]}</p>
          <p className="muted">{CLOSE_OTHER_APPS}</p>
          <button type="button" onClick={connect}>
            Connect
          </button>
        </section>
      )

    case 'waitingForAddon':
      return (
        <section className="panel" aria-label="Keyboard">
          <h2>Waiting for {browserName}</h2>
          <p>
            {browser === 'firefox'
              ? 'Look for the prompt near the address bar and add the site permission.'
              : 'Look for the prompt near the address bar and allow MIDI access.'}
          </p>
        </section>
      )

    case 'denied':
      return (
        <section className="panel" aria-label="Keyboard">
          <h2>MIDI access was refused</h2>
          <p>
            Keyflow needs MIDI access to hear your keyboard. Press Try again. If no prompt appears,{' '}
            {browser === 'other' ? 'the browser' : browserName} may have remembered the refusal for
            this site; look for MIDI in its site settings.
          </p>
          {error && <p className="muted">Details: {error}</p>}
          <button type="button" onClick={connect}>
            Try again
          </button>
        </section>
      )

    case 'noDevices':
      return (
        <section className="panel" aria-label="Keyboard">
          <h2>No keyboard found</h2>
          <p>
            MIDI access is on, but no MIDI input is connected. Plug the keyboard in and switch it
            on. Keyflow picks it up without a reload.
          </p>
          <p className="muted">
            If it's plugged in and still missing, another app may be using it: close music apps and
            other browsers, then unplug it and plug it back in.
          </p>
        </section>
      )

    case 'granted':
      return (
        <section className="panel" aria-label="Keyboard">
          <h2>Keyboard connected</h2>
          {inputs.length === 1 ? (
            <p>{inputs[0].name}</p>
          ) : (
            <label>
              Listen to{' '}
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
              Nothing has arrived from the keyboard yet. Press a key. If nothing shows up below,
              another app may be using the keyboard: close music apps and other browsers, then
              unplug the keyboard and plug it back in.
            </p>
          )}
        </section>
      )
  }
}
