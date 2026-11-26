import { Fragment, useSyncExternalStore } from 'react'
import { Note } from 'tonal'
import { computerKeyboard } from '../state/input.ts'
import { LiveInput } from './LiveInput.tsx'
import { OnscreenPiano } from './OnscreenPiano.tsx'
import { SplitControls } from './SoundPanel.tsx'

const keys = (letters: string) =>
  letters.split(' ').map((k, i) => (
    <Fragment key={k}>
      {i > 0 && ' '}
      <kbd>{k}</kbd>
    </Fragment>
  ))

export function PlayPanel() {
  // Changes only on Z/X, never per note.
  const base = useSyncExternalStore(computerKeyboard.subscribe, computerKeyboard.getBaseNote)
  return (
    <section className="card play" aria-labelledby="play-tab">
      <h2 className="tab" id="play-tab">
        Play
      </h2>
      <OnscreenPiano baseNote={base} />
      <div className="play-bar">
        <SplitControls />
        <LiveInput />
      </div>
      <p className="muted small keys-help">
        No keyboard at hand? Click or touch the keys above, or use your computer keys: the home row
        ({keys("A S D F G H J K L ; '")}) plays the white keys and the row above (
        {keys('W E T Y U O P')}) the black keys. {keys('Z')} and {keys('X')} shift the octave; they
        now play{' '}
        <span data-testid="computer-range">
          {Note.fromMidiSharps(base)} to {Note.fromMidiSharps(base + 17)}
        </span>
        .
      </p>
    </section>
  )
}
