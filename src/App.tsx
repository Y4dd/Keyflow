import { lazy, Suspense } from 'react'
import { CalibrationPanel } from './ui/CalibrationPanel.tsx'
import { GroovePanel } from './ui/GroovePanel.tsx'
import { MidiPanel } from './ui/MidiPanel.tsx'
import { PlayPanel } from './ui/PlayPanel.tsx'
import { SetupSteps } from './ui/SetupSteps.tsx'
import { SoundCrate, SoundStatus } from './ui/SoundPanel.tsx'

// A literal false in production builds, so the inspector isn't bundled there.
const Inspector = __KEYFLOW_DEV_TOOLS__
  ? lazy(() => import('./dev/Inspector.tsx').then((m) => ({ default: m.Inspector })))
  : null

export function App() {
  return (
    <main className="shell">
      <header className="masthead">
        <h1 className="wordmark">Keyflow</h1>
        <p className="tagline">
          Learn piano for synth soloing and comping over grooves, with your MIDI keyboard.
        </p>
        <SetupSteps />
      </header>
      <div className="grid setup">
        <MidiPanel />
        <SoundStatus />
      </div>
      <PlayPanel />
      <GroovePanel />
      <div className="grid">
        <SoundCrate />
        <CalibrationPanel />
      </div>
      {Inspector && (
        <Suspense fallback={null}>
          <Inspector />
        </Suspense>
      )}
    </main>
  )
}
