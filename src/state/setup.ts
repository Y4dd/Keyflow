import { createContext } from 'react'
import { useAudioStore } from './audio.ts'
import { useCalibrationStore } from './calibration.ts'
import { useMidiStore } from './midi.ts'

export type StepState = 'done' | 'now' | 'todo'
export type StepId = 'keyboard' | 'sound' | 'timing'
export const STEP_IDS: readonly StepId[] = ['keyboard', 'sound', 'timing']

/**
 * Where each setup step stands: done steps stay done, the first one not done is "now", the
 * rest are to do. Reads status fields only, so it re-renders on a status change, never per note.
 */
// shortcut: a browser without Web MIDI keeps "Connect keyboard" as the current step even though
// the computer keys still play; skip the step there if that confuses anyone.
export function useSetupSteps(): Record<StepId, StepState> {
  const keyboard = useMidiStore((s) => s.status === 'granted' && s.inputs.length > 0)
  const sound = useAudioStore((s) => s.status === 'running')
  const timing = useCalibrationStore((s) => s.offsetMs != null)
  return stepStates({ keyboard, sound, timing })
}

/** Done stays done; the first step not done is "now"; the rest are to do. */
export function stepStates(done: Record<StepId, boolean>): Record<StepId, StepState> {
  const now = STEP_IDS.find((id) => !done[id])
  const state = (id: StepId): StepState => (done[id] ? 'done' : id === now ? 'now' : 'todo')
  return { keyboard: state('keyboard'), sound: state('sound'), timing: state('timing') }
}

/**
 * The step a screen is about, when it isn't the first one not done: the walk-through's Sound
 * screen keeps Start audio yellow after the keyboard was skipped (StepAction).
 */
export const NowStep = createContext<StepId | null>(null)
