// Voice logic, pure: which voice plays a note (poly) and what a mono synth does on each key
// (last-note priority with legato-only glide). The Tone.js instruments act on these decisions.
//
// Both ref-count pitches: the same pitch can be pressed twice at once (two input sources, or
// the YPT-380's occasional notes on ch 2/3), and it should sound until the last press lifts.

export type PolyNoteOn =
  /** A free voice starts the note. */
  | { kind: 'start'; voice: number }
  /** The pitch was already sounding on this voice: strike it again. */
  | { kind: 'retrigger'; voice: number }
  /** Every voice was busy: the oldest note is cut and its voice plays this one. */
  | { kind: 'steal'; voice: number; stolenNote: number }

export interface PolyAllocator {
  noteOn(note: number): PolyNoteOn
  /** The voice to release, or null if nothing should change (unknown note, or still held). */
  noteOff(note: number): number | null
  /** Voices to release, ascending. Clears everything. */
  releaseAll(): number[]
  /** Pitches currently held (sounding and not released). */
  heldCount(): number
}

export function createPolyAllocator(size: number): PolyAllocator {
  if (!Number.isInteger(size) || size < 1) throw new Error(`Voice count must be ≥ 1, got ${size}`)
  // Per voice: the held note (-1 when free), the last note it played, and a stamp ordering
  // starts (for stealing) and releases (to reuse the voice released longest ago).
  const held = new Int16Array(size).fill(-1)
  const last = new Int16Array(size).fill(-1)
  const stamp = new Float64Array(size)
  const count = new Uint8Array(128) // presses per pitch
  const voiceOf = new Int16Array(128).fill(-1)
  let clock = 0
  let heldPitches = 0

  function pickFree(note: number): number {
    let best = -1
    for (let v = 0; v < size; v++) {
      if (held[v] !== -1) continue
      // A voice still ringing out this pitch takes it again, so one pitch never doubles up.
      if (last[v] === note) return v
      if (best === -1 || stamp[v] < stamp[best]) best = v
    }
    return best
  }

  function assign(voice: number, note: number) {
    held[voice] = note
    last[voice] = note
    stamp[voice] = ++clock
    voiceOf[note] = voice
    count[note] = 1
    heldPitches++
  }

  return {
    noteOn(note) {
      if (count[note] > 0) {
        if (count[note] < 255) count[note]++
        const voice = voiceOf[note]
        stamp[voice] = ++clock // a fresh strike is no longer the oldest note
        return { kind: 'retrigger', voice }
      }
      const free = pickFree(note)
      if (free !== -1) {
        assign(free, note)
        return { kind: 'start', voice: free }
      }
      let oldest = 0
      for (let v = 1; v < size; v++) if (stamp[v] < stamp[oldest]) oldest = v
      const stolenNote = held[oldest]
      count[stolenNote] = 0 // its key-up will find nothing to release
      voiceOf[stolenNote] = -1
      heldPitches--
      assign(oldest, note)
      return { kind: 'steal', voice: oldest, stolenNote }
    },

    noteOff(note) {
      if (count[note] === 0) return null
      count[note]--
      if (count[note] > 0) return null
      const voice = voiceOf[note]
      voiceOf[note] = -1
      held[voice] = -1
      stamp[voice] = ++clock
      heldPitches--
      return voice
    },

    releaseAll() {
      const voices: number[] = []
      for (let v = 0; v < size; v++) {
        if (held[v] === -1) continue
        voices.push(v)
        count[held[v]] = 0
        voiceOf[held[v]] = -1
        held[v] = -1
        stamp[v] = ++clock
      }
      heldPitches = 0
      return voices
    },

    heldCount: () => heldPitches,
  }
}

export type MonoAction =
  /** Nothing was sounding: jump to the pitch and restart the envelopes. */
  | { kind: 'attack'; note: number }
  /** Another key is still held: move to this pitch without restarting the envelopes. */
  | { kind: 'legato'; note: number }
  /** The last held key lifted. */
  | { kind: 'release' }

export interface MonoNoteStack {
  /** Returns null when nothing audible changes. */
  noteOn(note: number): MonoAction | null
  noteOff(note: number): MonoAction | null
  releaseAll(): MonoAction | null
  /** The sounding pitch, or null. */
  current(): number | null
  /** Held pitches, oldest first; the last is sounding. */
  held(): readonly number[]
}

/**
 * Last-note priority: the newest held key sounds. Lifting it returns to the newest key still
 * held, legato (classic mono-synth behaviour, so a trill between two held keys glides both ways).
 */
export function createMonoNoteStack(): MonoNoteStack {
  const stack: number[] = []
  const count = new Uint8Array(128)

  const top = () => (stack.length > 0 ? stack[stack.length - 1] : null)

  return {
    noteOn(note) {
      const before = top()
      if (count[note] > 0) {
        if (count[note] < 255) count[note]++
        if (before === note) return null
        stack.splice(stack.indexOf(note), 1)
      } else {
        count[note] = 1
      }
      stack.push(note)
      return before === null ? { kind: 'attack', note } : { kind: 'legato', note }
    },

    noteOff(note) {
      if (count[note] === 0) return null
      count[note]--
      if (count[note] > 0) return null
      const wasTop = top() === note
      stack.splice(stack.indexOf(note), 1)
      if (!wasTop) return null
      const next = top()
      return next === null ? { kind: 'release' } : { kind: 'legato', note: next }
    },

    releaseAll() {
      if (stack.length === 0) return null
      for (const n of stack) count[n] = 0
      stack.length = 0
      return { kind: 'release' }
    },

    current: top,
    held: () => stack,
  }
}

/**
 * Legato-only glide: the pitch slides only when moving between held keys. A note played
 * after all keys are up starts on its own pitch.
 */
export function glideTimeFor(action: MonoAction, glideTime: number): number {
  return action.kind === 'legato' ? Math.max(0, glideTime) : 0
}
