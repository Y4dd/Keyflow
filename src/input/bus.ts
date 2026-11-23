import type { InputEvent } from './types.ts'

export type InputListener = (event: InputEvent) => void

export interface InputBus {
  emit(event: InputEvent): void
  /** Returns an unsubscribe function. */
  subscribe(listener: InputListener): () => void
}

// Synchronous fan-out on the hot path: the audio engine subscribes here and must hear a note
// in the same call stack as the MIDI callback. Listeners must be cheap and must not throw;
// React and stores are updated elsewhere, never per event.
export function createInputBus(): InputBus {
  let listeners: readonly InputListener[] = []
  return {
    emit(event) {
      // Iterate a snapshot so (un)subscribing inside a listener is safe.
      const current = listeners
      for (let i = 0; i < current.length; i++) current[i](event)
    },
    subscribe(listener) {
      listeners = [...listeners, listener]
      return () => {
        listeners = listeners.filter((l) => l !== listener)
      }
    },
  }
}

/** The app's single input bus. */
export const inputBus = createInputBus()
