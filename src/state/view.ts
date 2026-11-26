// How the canvas keyboard looks: whether it shows the computer-key letters, and the highlighting
// look (Tags or Spotlight, P1-T4b). Both are saved with the settings. Changes on a click, never
// per note.

import { create } from 'zustand'
import type { Look } from '../ui/canvas/keys.ts'

export interface ViewState {
  /** The computer-key letters on the canvas keys. */
  keyLetters: boolean
  look: Look
}

export const useViewStore = create<ViewState>(() => ({ keyLetters: true, look: 'tags' }))

export const view = {
  setKeyLetters: (keyLetters: boolean) => useViewStore.setState({ keyLetters }),
  setLook: (look: Look) => useViewStore.setState({ look }),
}
