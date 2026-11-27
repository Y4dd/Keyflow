// Which view shows (P2-T12): a hash route (`#/jam`…), so the back button works without a router
// dependency. Also the shell's one bit of open-drawer state. Changes on a click, never per note.

import { useSyncExternalStore } from 'react'
import { create } from 'zustand'
import type { ZoneId } from '../audio/zones.ts'
import { audio, useAudioStore } from './audio.ts'
import { calibration } from './calibration.ts'
import { drills } from './drills.ts'
import { session } from './session.ts'

export const ROUTES = ['jam', 'practice', 'learn', 'setup', 'welcome'] as const
export type Route = (typeof ROUTES)[number]

const parse = (hash: string): Route | null => {
  const r = hash.replace(/^#\/?/, '')
  return (ROUTES as readonly string[]).includes(r) ? (r as Route) : null
}

let current = parse(location.hash)
const listeners = new Set<() => void>()

/** Leaving a view ends what only makes sense inside it, so no mode outlives its screen. */
function leave(from: Route | null, to: Route | null) {
  if (from === to) return
  // An open drill keeps grading and keeps the jam highlighting off, so leaving closes it.
  if (from === 'practice') {
    session.leave()
    drills.stop()
  }
  if (from === 'setup') {
    audio.learnSplit(false)
    calibration.cancel()
  }
  // The sound drawer and Setup's sound cards never show the same zone twice.
  if (to === 'setup' || from === 'setup') useShellStore.setState({ drawer: null })
}

window.addEventListener('hashchange', () => {
  const next = parse(location.hash)
  if (next === null) return void location.replace('#/jam') // an old or mistyped link
  leave(current, next)
  current = next
  for (const l of listeners) l()
})

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** The current view, or null until `startRoute` has picked one for an empty hash. */
export const useRoute = () => useSyncExternalStore(subscribe, () => current)

/**
 * After the saved settings are applied: an empty hash opens the first-visit walk-through for
 * someone who has never started sound here, and Jam for everyone else.
 */
export function startRoute() {
  if (current !== null) return
  const s = useAudioStore.getState() // sound started while settings loaded counts too
  location.replace(s.startedBefore || s.status === 'running' ? '#/jam' : '#/welcome')
}

export const useShellStore = create<{ drawer: ZoneId | null }>(() => ({ drawer: null }))

/** Opens a zone's sounds in the drawer over the keys, or closes it if it's already open. */
export const toggleDrawer = (zone: ZoneId) =>
  useShellStore.setState((s) => ({ drawer: s.drawer === zone ? null : zone }))
