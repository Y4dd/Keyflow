import { Fragment, useSyncExternalStore } from 'react'
import { Note } from 'tonal'
import { computerKeyboard } from '../state/input.ts'
import { useMidiStore } from '../state/midi.ts'
import { useViewStore, view } from '../state/view.ts'

const keys = (letters: string) =>
  letters.split(' ').map((k, i) => (
    <Fragment key={k}>
      {i > 0 && ' '}
      <kbd>{k}</kbd>
    </Fragment>
  ))

/** Setup's computer-key help, shown open only while no MIDI keyboard is connected. */
export function KeysHelp() {
  // Changes only on Z/X, never per note.
  const base = useSyncExternalStore(computerKeyboard.subscribe, computerKeyboard.getBaseNote)
  const letters = useViewStore((s) => s.keyLetters)
  const chordName = useViewStore((s) => s.chordName)
  const connected = useMidiStore((s) => s.status === 'granted' && s.inputs.length > 0)
  return (
    <section className="card" aria-labelledby="keys-tab">
      <h2 className="tab" id="keys-tab">
        Computer keys
      </h2>
      <details className="keys-help" open={!connected}>
        <summary>No keyboard at hand?</summary>
        <p>
          Click or touch the keys at the bottom, or use your computer keys: the home row (
          {keys("A S D F G H J K L ; '")}) plays the white keys and the row above (
          {keys('W E T Y U O P')}) the black keys. {keys('Z')} and {keys('X')} shift the octave;
          they now play{' '}
          <span data-testid="computer-range">
            {Note.fromMidiSharps(base)} to {Note.fromMidiSharps(base + 17)}
          </span>
          .
        </p>
      </details>
      <label className="check keys-letters">
        <input
          type="checkbox"
          checked={letters}
          onChange={(e) => view.setKeyLetters(e.target.checked)}
        />
        Show the computer-key letters on the keys
      </label>
      <label className="check keys-letters">
        <input
          type="checkbox"
          checked={chordName}
          onChange={(e) => view.setChordName(e.target.checked)}
        />
        Name the chord or interval you play, above the keys
      </label>
    </section>
  )
}
