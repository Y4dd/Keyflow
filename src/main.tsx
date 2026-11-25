import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import './index.css'
import { inputBus } from './input/bus.ts'
import { attachComputerKeyboard } from './input/computer/keyboard.ts'
import { attachAudioUnlock, audio } from './state/audio.ts'
import { computerKeyboard, laptopBend } from './state/input.ts'
import { midi } from './state/midi.ts'
import { startSettings } from './state/settings.ts'

// Outside React so StrictMode's double effects can't start them twice.
// The audio controller subscribes first, so notes reach the engine before anything else.
inputBus.subscribe(audio.handle)
attachAudioUnlock(window)
void startSettings()
void midi.start()
attachComputerKeyboard(computerKeyboard, window, laptopBend)

// window.__keyflow (sim injection) for Playwright and the dev server; absent in production.
if (__KEYFLOW_DEV_TOOLS__) void import('./dev/devtools.ts').then((m) => m.installDevTools())

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
