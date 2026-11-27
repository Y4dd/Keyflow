// Recording, replaying and listing takes (P1-T7). Record plays the groove from the top and
// collects the input bus into a take (src/analysis/take.ts) until the groove stops, by Stop, by
// ending (Loop off) or by sound stopping; then the take is saved. Replay puts the groove on the
// take's groove, key, tempo and scale, plays it, and sends the take's events back through a
// simulated source from the replay's own transport start, so they reach the engine (and the
// canvas keyboard) like live input. The store changes on record, replay and stop, never per note.
//
// shortcut: replay plays through the sounds, split, pedal mode and bend amount set now, not the
// ones recorded with; store them in the take if replays should sound as recorded.
// shortcut: replay events fire on window timers, so they can land a few ms off the groove's
// audio-clock schedule (a manual check listens for it); schedule them on the audio clock if it's
// audible.

import { create } from 'zustand'
import { createTakeRecorder, TAKE_FORMAT, type Take } from '../analysis/take.ts'
import { contextToPerfMs } from '../audio/latency.ts'
import { GROOVES } from '../grooves/library.ts'
import { inputBus } from '../input/bus.ts'
import { createSimPlayer } from '../input/sim/player.ts'
import { loadTakes, saveTake, type StoredTake } from '../storage/db.ts'
import { audio } from './audio.ts'
import { useCalibrationStore } from './calibration.ts'
import { groove, useGrooveStore } from './groove.ts'

/** How many takes the list shows, newest first. */
export const TAKE_LIST_LIMIT = 20

export interface TakesState {
  /** The groove is playing and your input is going into a take. */
  recording: boolean
  /** The take replaying, by id. */
  replaying: number | null
  takes: StoredTake[]
  /** The take the piano roll shows. */
  selected: number | null
  /** What went wrong saving or reading takes, as one next step. */
  error: string | null
}

export const useTakesStore = create<TakesState>(() => ({
  recording: false,
  replaying: null,
  takes: [],
  selected: null,
  error: null,
}))

const set = useTakesStore.setState
const get = useTakesStore.getState

let recording: {
  recorder: ReturnType<typeof createTakeRecorder>
  header: Omit<Take, 'events' | 'lengthMs' | 'createdAt'>
  unsubscribe: () => void
} | null = null

const replayer = createSimPlayer(
  {
    now: () => performance.now(),
    setTimer: (fn, ms) => window.setTimeout(fn, ms),
    clearTimer: (handle) => window.clearTimeout(handle as number),
  },
  inputBus.emit,
)
let replayEnd = 0
// The Loop setting before a replay, which turns it on so the groove outlasts the take.
let loopBefore: boolean | null = null

/** A take can replay only over a groove the app still has. */
export const canReplay = (take: Take) => GROOVES.some((g) => g.id === take.grooveId)

/**
 * Starts the groove from the top: the transport start in performance ms, with the clock
 * mapping's output-timestamp lead, or null when it didn't start.
 */
function playFromTop(): { origin: number; lead: number | null } | null {
  const engine = audio.engine()
  const start = groove.play()
  if (!engine || start === null) return null
  const clock = engine.clock()
  return { origin: contextToPerfMs(clock, start), lead: clock.outputTimestampLeadMs }
}

// shortcut: a take is saved only when the groove stops, so a reload or closed tab mid-take loses
// it; save on visibilitychange (hidden) if lost takes are reported.
async function finishRecording() {
  const r = recording
  if (!r) return
  recording = null
  r.unsubscribe()
  set({ recording: false })
  const { events, lengthMs } = r.recorder.finish(performance.now())
  if (events.length === 0) return // nothing played: no take
  const take: Take = { ...r.header, createdAt: Date.now(), lengthMs, events }
  let id: number
  try {
    id = await saveTake(take)
  } catch {
    // Kept for this visit, so it can still be replayed and exported.
    id = -Date.now()
    set({
      error:
        'This take couldn’t be saved in the browser, so it goes when you reload. Export it as .mid to keep it.',
    })
  }
  set((s) => ({ takes: [{ ...take, id }, ...s.takes].slice(0, TAKE_LIST_LIMIT), selected: id }))
}

function restoreLoop() {
  if (loopBefore !== null) useGrooveStore.setState({ loop: loopBefore })
  loopBefore = null
}

function endReplay() {
  if (get().replaying === null) return
  window.clearTimeout(replayEnd)
  replayer.stop() // releases whatever the take still holds: notes, the pedal, a bend
  set({ replaying: null })
  restoreLoop()
}

export const takes = {
  /** Reads the saved takes, newest first. */
  async load() {
    try {
      const saved = await loadTakes(TAKE_LIST_LIMIT)
      // A take recorded while loading stays at the top.
      set((s) => ({
        takes: [...s.takes, ...saved.filter((t) => !s.takes.some((x) => x.id === t.id))].slice(
          0,
          TAKE_LIST_LIMIT,
        ),
        selected: s.selected ?? saved[0]?.id ?? null,
      }))
    } catch {
      set({ error: 'Your saved takes couldn’t be read. New takes are kept for this visit.' })
    }
  },

  /** Plays the groove from the top and records until it stops. Needs sound running. */
  record() {
    if (recording || get().replaying !== null) return
    const started = playFromTop()
    if (!started) return
    const g = useGrooveStore.getState()
    const c = useCalibrationStore.getState()
    const recorder = createTakeRecorder(started.origin)
    recording = {
      recorder,
      header: {
        format: TAKE_FORMAT,
        grooveId: g.grooveId,
        tonic: g.tonic,
        bpm: g.bpm,
        scale: g.scale,
        countIn: g.countIn,
        offsetMs: c.offsetMs,
        leadMs: started.lead,
      },
      unsubscribe: inputBus.subscribe(recorder.add),
    }
    set({ recording: true, error: null })
  },

  /** Replays a take over its groove; Stop (or its end) stops both. */
  replay(id: number) {
    const take = get().takes.find((t) => t.id === id)
    if (!take || !canReplay(take) || recording) return
    endReplay()
    const { grooveId, tonic, bpm, scale, countIn } = take
    loopBefore = useGrooveStore.getState().loop
    useGrooveStore.setState({ grooveId, tonic, bpm, scale, countIn, loop: true })
    const started = playFromTop()
    if (!started) {
      restoreLoop()
      return
    }
    const { origin } = started
    set({ replaying: id, selected: id })
    void replayer.play(take.events, origin)
    replayEnd = window.setTimeout(
      () => {
        if (get().replaying === id) groove.stop()
      },
      origin + take.lengthMs - performance.now(),
    )
  },

  select: (id: number) => set({ selected: id }),
}

// The groove stopping, however it stops, ends a recording (saving it) and a replay.
useGrooveStore.subscribe((s, prev) => {
  if (prev.playing && !s.playing) {
    void finishRecording()
    endReplay()
  }
})
