// The app's fallback input sources. Like MIDI, they emit straight onto the input bus.

import { inputBus } from '../input/bus.ts'
import { createLaptopBend } from '../input/computer/bend.ts'
import { createComputerKeyboard } from '../input/computer/keyboard.ts'
import { createPointerPiano } from '../input/onscreen/pointer.ts'
import { useAudioStore } from './audio.ts'

export const computerKeyboard = createComputerKeyboard(inputBus.emit)
export const pointerPiano = createPointerPiano(inputBus.emit)
export const laptopBend = createLaptopBend(
  inputBus.emit,
  {
    now: () => performance.now(),
    setTimer: (fn, ms) => window.setTimeout(fn, ms),
    clearTimer: (handle) => window.clearTimeout(handle as number),
  },
  () => useAudioStore.getState().expression.bendSemitones,
)
