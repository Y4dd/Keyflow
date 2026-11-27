// Today's session (P2-T6): builds the queue from the stored items and recent ratings
// (src/practice/session.ts), shows its drills one by one through the drill store, and once
// done offers a jam with the scale practised. The builder is imported on demand, since it loads
// the FSRS scheduler, which the app doesn't need at start.

import { create } from 'zustand'
import { GROOVES } from '../grooves/library.ts'
import type { Drill } from '../practice/drills.ts'
import type { Jam } from '../practice/session.ts'
import { loadItems, loadRecentRatings } from '../storage/db.ts'
import { drills, useDrillStore } from './drills.ts'
import { groove } from './groove.ts'

export interface SessionState {
  /** off: no session; building: loading the items; on: drilling; done: the queue is finished. */
  status: 'off' | 'building' | 'on' | 'done'
  /** The drill showing (1-based) and how many the session has. */
  at: number
  total: number
  /** The jam to offer once done, or null. */
  jam: Jam | null
}

export const useSessionStore = create<SessionState>(() => ({
  status: 'off',
  at: 0,
  total: 0,
  jam: null,
}))

let queue: Drill[] = []
let run = 0 // the session a pending build belongs to

export const session = {
  /** Builds today's session and shows its first drill. */
  async start() {
    const r = ++run
    useSessionStore.setState({ status: 'building', at: 0, total: 0, jam: null })
    try {
      const { buildSession, jamOf, SESSION } = await import('../practice/session.ts')
      const [items, ratings] = await Promise.all([
        loadItems().catch(() => []), // database unavailable: a new learner's session
        loadRecentRatings(SESSION.window).catch(() => []),
      ])
      if (r !== run) return
      const previous = useDrillStore.getState().drill?.item ?? null
      queue = buildSession(items, ratings, new Date(), previous)
      useSessionStore.setState({ total: queue.length, jam: jamOf(queue, GROOVES) })
    } catch (err) {
      // a chunk gone after a deploy, or a row the builder can't read: the button works again
      console.error('Keyflow: could not build the session', err)
      if (r === run) useSessionStore.setState({ status: 'off' })
      return
    }
    session.next()
  },
  /** The session's next drill; past the last, the session is done. */
  next() {
    const d = queue.shift()
    if (!d) {
      // an empty session leaves a drill picked by type alone
      if (useSessionStore.getState().at > 0) drills.stop()
      return useSessionStore.setState({ status: 'done' })
    }
    useSessionStore.setState((s) => ({ status: 'on', at: s.at + 1 }))
    drills.start(d)
  },
  /** Leaves the session; the drill showing, if any, stays. */
  leave() {
    run++
    queue = []
    useSessionStore.setState({ status: 'off', at: 0, total: 0, jam: null })
  },
  /** Sets the groove up with the session's scale and ends the session. */
  jam() {
    const jam = useSessionStore.getState().jam
    if (!jam) return
    groove.setGroove(jam.grooveId)
    groove.setTonic(jam.tonic)
    groove.setScale(jam.scale)
    session.leave()
    location.hash = '#/jam' // the transport sits over the keys there
  },
}
