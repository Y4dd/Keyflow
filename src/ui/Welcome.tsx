import { useState } from 'react'
import { useAudioStore } from '../state/audio.ts'
import { useMidiStore } from '../state/midi.ts'
import { NowStep } from '../state/setup.ts'
import { MidiPanel } from './MidiPanel.tsx'
import { Step } from './SetupSteps.tsx'
import { SoundStatus } from './SoundPanel.tsx'

/**
 * The first-visit walk-through (P2-T12): Keyboard, then Sound, then Jam. Each screen has one
 * yellow action: its card's own button while that step needs one, else Next. Screens move only
 * on Next, never on a status change, since the pointerdown that presses Connect also starts sound
 * (attachAudioUnlock). Whether a browser lets that one press do both is P2-T12's manual step 4;
 * if sound didn't start, the Sound screen's Start audio does it.
 */
export function Welcome() {
  const [screen, setScreen] = useState<'keyboard' | 'sound'>('keyboard')
  const midi = useMidiStore((s) => (s.checking ? 'checking' : s.status))
  const audio = useAudioStore((s) => s.status)
  // Only these states show a yellow button of their own (MidiPanel, SoundPanel's StatusLine).
  const cardAction =
    screen === 'keyboard'
      ? midi === 'needsPermission' || midi === 'denied'
      : audio !== 'running' && audio !== 'unsupported'
  const last = screen === 'sound'

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome-body">
        <h2 className="wordmark" id="welcome-title">
          Keyflow
        </h2>
        <p className="tagline">
          Learn piano for synth soloing and comping over grooves, with your MIDI keyboard.
        </p>
        <ol className="steps" aria-label="Setup">
          <li>
            <Step id="keyboard" current={screen === 'keyboard'} />
          </li>
          <li>
            <Step id="sound" current={last} />
          </li>
        </ol>
        <NowStep.Provider value={screen}>
          {screen === 'keyboard' ? <MidiPanel /> : <SoundStatus />}
        </NowStep.Provider>
        <div className="actions welcome-actions">
          {last ? (
            <button type="button" onClick={() => setScreen('keyboard')}>
              Back
            </button>
          ) : (
            <button type="button" onClick={() => location.replace('#/jam')}>
              Skip setup
            </button>
          )}
          <button
            type="button"
            className={cardAction ? undefined : 'primary'}
            onClick={() => (last ? location.replace('#/jam') : setScreen('sound'))}
          >
            {last ? 'Start playing' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
