// The app's fallback input sources. Like MIDI, they emit straight onto the input bus.

import { inputBus } from '../input/bus.ts'
import { createComputerKeyboard } from '../input/computer/keyboard.ts'
import { createPointerPiano } from '../input/onscreen/pointer.ts'

export const computerKeyboard = createComputerKeyboard(inputBus.emit)
export const pointerPiano = createPointerPiano(inputBus.emit)
