import { lazy, Suspense, type ComponentType } from 'react'
import { useRoute, type Route } from './state/route.ts'
import { useDrillStage } from './state/session.ts'
import { CalibrationPanel } from './ui/CalibrationPanel.tsx'
import { DataPanel } from './ui/DataPanel.tsx'
import { Dock } from './ui/Dock.tsx'
import { DrillPanel } from './ui/DrillPanel.tsx'
import { GrooveNote, Mix, StopGroove } from './ui/GroovePanel.tsx'
import { KeysHelp } from './ui/KeysHelp.tsx'
import { MidiPanel } from './ui/MidiPanel.tsx'
import { SetupSticker } from './ui/SetupSteps.tsx'
import { SoundCrate, SoundStatus, SplitControls } from './ui/SoundPanel.tsx'
import { TakesPanel } from './ui/TakesPanel.tsx'
import { Welcome } from './ui/Welcome.tsx'

// A literal false in production builds, so the inspector isn't bundled there.
const Inspector = __KEYFLOW_DEV_TOOLS__
  ? lazy(() => import('./dev/Inspector.tsx').then((m) => ({ default: m.Inspector })))
  : null

// On demand: progress reads the curriculum, which loads the FSRS scheduler (like backup.ts).
const ProgressPanel = lazy<ComponentType>(() =>
  // a chunk that fails to load hides only this card, not the app
  import('./ui/ProgressPanel.tsx').then(
    (m) => ({ default: m.ProgressPanel }),
    () => ({ default: () => null }),
  ),
)

const VIEWS: { route: Route; label: string }[] = [
  { route: 'jam', label: 'Jam' },
  { route: 'practice', label: 'Practice' },
  { route: 'learn', label: 'Learn' },
]

const gear = (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path
      d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8 4.6v-2.2l-2.3-.5a6 6 0 0 0-.6-1.5l1.3-2-1.6-1.6-2 1.3a6 6 0 0 0-1.5-.6L12.9 4h-2.2l-.5 2.3a6 6 0 0 0-1.5.6l-2-1.3-1.6 1.6 1.3 2a6 6 0 0 0-.6 1.5L3.5 11v2.2l2.3.5c.1.5.3 1 .6 1.5l-1.3 2 1.6 1.6 2-1.3c.5.3 1 .5 1.5.6l.5 2.3h2.2l.5-2.3c.5-.1 1-.3 1.5-.6l2 1.3 1.6-1.6-1.3-2c.3-.5.5-1 .6-1.5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  </svg>
)

function TopBar({ route, inert }: { route: Route | null; inert: boolean }) {
  return (
    <header className="topbar" inert={inert}>
      <h1 className="wordmark">Keyflow</h1>
      <nav aria-label="Views">
        <ul className="views">
          {VIEWS.map((v) => (
            <li key={v.route}>
              <a href={`#/${v.route}`} aria-current={route === v.route ? 'page' : undefined}>
                {v.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="topbar-end">
        <StopGroove />
        <SetupSticker />
        <a
          className="gear"
          href="#/setup"
          aria-label="Setup"
          aria-current={route === 'setup' ? 'page' : undefined}
        >
          {gear}
        </a>
      </div>
    </header>
  )
}

function JamView() {
  return (
    <>
      <div className="jam-note">
        <GrooveNote />
      </div>
      <div className="drawers">
        <details className="drawer">
          <summary>Mix</summary>
          <Mix />
        </details>
        <details className="drawer">
          <summary>Takes</summary>
          <TakesPanel />
        </details>
      </div>
    </>
  )
}

function PracticeView() {
  // The start screen (Drills, then Progress), or the drill alone at the bottom, over the keys.
  const stage = useDrillStage()
  return (
    <>
      <DrillPanel />
      {!stage && (
        <Suspense fallback={null}>
          <ProgressPanel />
        </Suspense>
      )}
    </>
  )
}

function LearnView() {
  return (
    <section className="card" aria-labelledby="learn-tab">
      <h2 className="tab" id="learn-tab">
        Learn
      </h2>
      <p className="blurb">
        A chord and scale library comes here: look a chord or scale up in any key, see it on the
        keys, hear it, and drill it.
      </p>
    </section>
  )
}

function SetupView() {
  return (
    <>
      <div className="grid setup">
        <MidiPanel />
        <SoundStatus />
      </div>
      <div className="grid">
        <section className="card" aria-labelledby="split-tab">
          <h2 className="tab" id="split-tab">
            Split
          </h2>
          <SplitControls />
        </section>
        <KeysHelp />
      </div>
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
    </>
  )
}

export function App() {
  const route = useRoute()
  return (
    <div className="shell">
      <TopBar route={route} inert={route === 'welcome'} />
      <main className="view" data-view={route ?? undefined} inert={route === 'welcome'}>
        {route === 'jam' && <JamView />}
        {route === 'practice' && <PracticeView />}
        {route === 'learn' && <LearnView />}
        {route === 'setup' && <SetupView />}
      </main>
      <Dock inert={route === 'welcome'} />
      {route === 'welcome' && <Welcome />}
    </div>
  )
}
