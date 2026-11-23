import { lazy, Suspense } from 'react'
import { MidiPanel } from './ui/MidiPanel.tsx'
import { PlayPanel } from './ui/PlayPanel.tsx'
import { SoundPanel } from './ui/SoundPanel.tsx'

// A literal false in production builds, so the inspector isn't bundled there.
const Inspector = __KEYFLOW_DEV_TOOLS__
  ? lazy(() => import('./dev/Inspector.tsx').then((m) => ({ default: m.Inspector })))
  : null

export function App() {
  return (
    <main className="shell">
      <h1>Keyflow</h1>
      <p>Learn piano for synth soloing and comping over grooves, with your MIDI keyboard.</p>
      <MidiPanel />
      <SoundPanel />
      <PlayPanel />
      {Inspector && (
        <Suspense fallback={null}>
          <Inspector />
        </Suspense>
      )}
    </main>
  )
}
