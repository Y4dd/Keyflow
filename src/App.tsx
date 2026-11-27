import { lazy, Suspense } from 'react'
import { CalibrationPanel } from './ui/CalibrationPanel.tsx'
import { DataPanel } from './ui/DataPanel.tsx'
import { DrillPanel } from './ui/DrillPanel.tsx'
import { GroovePanel } from './ui/GroovePanel.tsx'
import { MidiPanel } from './ui/MidiPanel.tsx'
import { PlayPanel } from './ui/PlayPanel.tsx'
import { SetupSteps } from './ui/SetupSteps.tsx'
import { SoundCrate, SoundStatus } from './ui/SoundPanel.tsx'
import { TakesPanel } from './ui/TakesPanel.tsx'

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
      <DrillPanel />
      <GroovePanel />
      <TakesPanel />
      <div className="grid">
        <SoundCrate />
        <CalibrationPanel />
      </div>
      <DataPanel />
      {Inspector && (
        <Suspense fallback={null}>
          <Inspector />
        </Suspense>
      )}
    </main>
  )
}
