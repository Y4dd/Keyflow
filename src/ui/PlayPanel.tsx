import { useSyncExternalStore } from 'react'
import { Note } from 'tonal'
import { computerKeyboard } from '../state/input.ts'
import { LiveInput } from './LiveInput.tsx'
import { OnscreenPiano } from './OnscreenPiano.tsx'

export function PlayPanel() {
  // Changes only on Z/X, never per note.
  const base = useSyncExternalStore(computerKeyboard.subscribe, computerKeyboard.getBaseNote)
  return (
    <section className="panel" aria-label="Play">
      <h2>Play</h2>
      <p className="muted">
        No keyboard at hand? Click or touch the keys below, or use your computer keys: the home row
        (A S D F G H J K L ; &apos;) plays the white keys and the row above (W E T Y U O P) the
        black keys. Z and X shift the octave; they now play{' '}
        <span data-testid="computer-range">
          {Note.fromMidiSharps(base)} to {Note.fromMidiSharps(base + 17)}
        </span>
        .
      </p>
      <OnscreenPiano baseNote={base} />
      <LiveInput />
      <p className="muted">No sound yet: the synth comes next. This shows what Keyflow hears.</p>
    </section>
  )
}
