// The app's MIDI connection and the Zustand store the UI reads it from. The store changes only
// on onboarding, device and hint changes, never per note: notes go straight to the input bus.

import { create } from 'zustand'
import { inputBus } from '../input/bus.ts'
import { browserMidiEnv } from '../input/midi/browser.ts'
import { createMidiConnection, type MidiSnapshot } from '../input/midi/connection.ts'

export const midi = createMidiConnection(browserMidiEnv(), inputBus.emit, (snapshot) =>
  useMidiStore.setState(snapshot, true),
)

export const useMidiStore = create<MidiSnapshot>(() => midi.getSnapshot())
