// How the canvas keyboard looks: whether it shows the computer-key letters (saved with the
// settings) and which highlighting look is on trial (P1-T4b; not saved). Changes on a click,
// never per note.

import { create } from 'zustand'
import type { Look } from '../ui/canvas/keys.ts'

export interface ViewState {
  /** The computer-key letters on the canvas keys. */
  keyLetters: boolean
  // shortcut: the looks are on trial (P1-T4b); the user's pick becomes the only one and this goes.
  look: Look
}

export const useViewStore = create<ViewState>(() => ({ keyLetters: true, look: 'spotlight' }))

export const view = {
  setKeyLetters: (keyLetters: boolean) => useViewStore.setState({ keyLetters }),
  setLook: (look: Look) => useViewStore.setState({ look }),
}
