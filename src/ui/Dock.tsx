import { useSyncExternalStore } from 'react'
import { getPreset } from '../audio/presets/index.ts'
import type { ZoneId } from '../audio/zones.ts'
import { audio, useAudioStore } from '../state/audio.ts'
import { computerKeyboard } from '../state/input.ts'
import { toggleDrawer, useRoute, useShellStore } from '../state/route.ts'
import { Transport } from './GroovePanel.tsx'
import { LiveInput } from './LiveInput.tsx'
import { OnscreenPiano } from './OnscreenPiano.tsx'
import { StepAction } from './SetupSteps.tsx'
import { ZoneControls } from './SoundPanel.tsx'

/** Sound off: the Start audio button in the readout (Setup's Sound card has its own). */
function SoundOff() {
  const status = useAudioStore((s) => s.status)
  const waiting = useAudioStore((s) => s.notesWaiting)
  const label =
    status === 'suspended' ? 'Resume audio' : status === 'failed' ? 'Try again' : 'Start audio'
  return (
    <div className="dock-sound" data-testid="audio-status" data-status={status}>
      {status !== 'running' && status !== 'unsupported' && (
        <StepAction step="sound" label={label} onClick={() => void audio.start()} />
      )}
      {waiting && status !== 'running' && (
        <span className="hint" role="status">
          Your keyboard is playing, but sound is off. Click anywhere to hear it.
        </span>
      )}
    </div>
  )
}

/** A button per zone naming its sound; it opens that zone's sounds in the drawer. */
function ZoneButton({ zone }: { zone: ZoneId }) {
  const presetId = useAudioStore((s) => s.layout[zone].presetId)
  const open = useShellStore((s) => s.drawer === zone)
  return (
    <button
      type="button"
      className="zone-button"
      data-sound={presetId}
      aria-expanded={open}
      onClick={() => toggleDrawer(zone)}
    >
      <span className="zone-swatch" aria-hidden="true" />
      {zone === 'left' ? 'Left' : 'Main'}: {getPreset(presetId).name}
    </button>
  )
}

/**
 * Pinned at the bottom of every view and mounted once, so the canvas is never remounted: Jam's
 * transport, one readout line (sound, held notes, pedal, the zones' sounds) and the keyboard.
 */
export function Dock({ inert }: { inert: boolean }) {
  const route = useRoute()
  // Changes only on Z/X, never per note.
  const base = useSyncExternalStore(computerKeyboard.subscribe, computerKeyboard.getBaseNote)
  const split = useAudioStore((s) => s.layout.split)
  const drawer = useShellStore((s) => s.drawer)
  const setup = route === 'setup' // Setup shows the full sound cards and the Sound card itself
  return (
    <footer className="dock" inert={inert}>
      {drawer && !setup && (
        <div
          className="sound-drawer"
          role="region"
          aria-label={drawer === 'left' ? 'Left sound' : 'Main sound'}
        >
          <ZoneControls zone={drawer} />
          <div className="actions">
            <button type="button" onClick={() => useShellStore.setState({ drawer: null })}>
              Close
            </button>
          </div>
        </div>
      )}
      {route === 'jam' && <Transport />}
      <div className="readout">
        {!setup && <SoundOff />}
        <LiveInput />
        {!setup && (
          <div className="zone-buttons">
            {split && <ZoneButton zone="left" />}
            <ZoneButton zone="main" />
          </div>
        )}
      </div>
      <OnscreenPiano baseNote={base} />
    </footer>
  )
}
