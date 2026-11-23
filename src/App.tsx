import { MidiPanel } from './ui/MidiPanel.tsx'

export function App() {
  return (
    <main className="shell">
      <h1>Keyflow</h1>
      <p>Learn piano for synth soloing and comping over grooves, with your MIDI keyboard.</p>
      <MidiPanel />
    </main>
  )
}
