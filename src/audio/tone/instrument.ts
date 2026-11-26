// A playable instrument built from a preset: the pure voice logic (src/audio/voices.ts)
// deciding, the Tone voices (./voices.ts) sounding. Instances, not a singleton: the split
// keyboard (P0-T6) plays two at once.

import * as Tone from 'tone'
import { dbToGain, midiToHz, velocityToGain } from '../curves.ts'
import { createSustainLatch } from '../expression.ts'
import { scaleBend } from '../../music/bend.ts'
import type { KnobValues, Preset } from '../presets/types.ts'
import {
  createMonoNoteStack,
  createPolyAllocator,
  glideTimeFor,
  type MonoAction,
} from '../voices.ts'
import { createFmVoice, createLeadVoice, createWobbleVoice, type MonoVoice } from './voices.ts'

export interface Instrument {
  readonly preset: Preset
  /** Times are audio-context seconds: Tone.immediate() for live input. */
  noteOn(note: number, velocity: number, time: number): void
  noteOff(note: number, time: number): void
  releaseAll(time: number): void
  /** Sustain pedal: while down, note-offs wait for it to lift. */
  setSustain(down: boolean, time: number): void
  /** Glide-hold: mono instruments glide into detached notes too. */
  setGlideHold(on: boolean): void
  /**
   * Bends every sounding and later note to `amount`, sliding over `ramp` seconds: semitones,
   * or with a bend scale, steps of it (each note to its own next scale tone, src/music/bend.ts).
   */
  bend(amount: number, time: number, ramp: number): void
  /**
   * Pitch classes bends count steps of (null: semitones) with the bend held in those units, set
   * at once: an amount in the old units would mean another pitch. Nothing changes if neither did.
   */
  setBendScale(scale: readonly number[] | null, amount: number, time: number): void
  setKnob(id: string, value: number): void
  /** Lines a tempo-synced LFO up with a groove starting at `time` (Wobble Bass only). */
  restartLfo(time: number): void
  /** Pitches currently held, for tests and dev tools. */
  heldCount(): number
  dispose(): void
}

export function createInstrument(
  preset: Preset,
  knobs: KnobValues,
  destination: Tone.InputNode,
): Instrument {
  const output = new Tone.Gain(dbToGain(preset.levelDb))
  output.connect(destination)
  switch (preset.kind) {
    case 'lead':
      return monoInstrument(preset, createLeadVoice(preset, knobs), output)
    case 'wobble':
      return monoInstrument(preset, createWobbleVoice(preset, knobs), output)
    case 'fm':
      return polyInstrument(preset, knobs, output)
    case 'tines':
      return tinesInstrument(preset, knobs, output)
  }
}

/**
 * Warm Tines: the FM voices through a low-mid boost, a low-pass (the Tone knob) and a tremolo
 * (an LFO swinging a gain).
 */
function tinesInstrument(
  preset: Extract<Preset, { kind: 'tines' }>,
  knobs: KnobValues,
  output: Tone.Gain,
): Instrument {
  const input = new Tone.Gain(1)
  const body = new Tone.Filter({
    type: 'peaking',
    frequency: preset.body.hz,
    gain: preset.body.db,
    Q: 0.7,
  })
  const tone = new Tone.Filter({ type: 'lowpass', frequency: knobs.tone, rolloff: -12, Q: 0.7 })
  const tremolo = new Tone.Gain(1)
  const lfo = new Tone.LFO({ frequency: preset.tremoloHz, min: 1 - knobs.tremolo, max: 1 })
  lfo.connect(tremolo.gain)
  lfo.start(Tone.immediate())
  input.chain(body, tone, tremolo, output)
  const poly = polyInstrument(preset, knobs, input)
  return {
    ...poly,
    setKnob(id, value) {
      if (id === 'tremolo') lfo.min = 1 - value
      else if (id === 'tone') tone.frequency.setValueAtTime(value, Tone.immediate())
      else poly.setKnob(id, value)
    },
    dispose() {
      poly.dispose()
      for (const node of [body, tone, tremolo, lfo, output]) node.dispose()
    },
  }
}

function monoInstrument(preset: Preset, voice: MonoVoice, output: Tone.Gain): Instrument {
  voice.output.connect(output)
  const stack = createMonoNoteStack()
  const latch = createSustainLatch()
  let glideHold = false
  let playedBefore = false
  const bent = createBent()
  let sounding: number | null = null

  function act(action: MonoAction | null, velocity: number, time: number) {
    if (action === null) return
    if (action.kind === 'release') {
      voice.release(time)
      return
    }
    const glide = glideTimeFor(action, voice.glide(), glideHold, playedBefore)
    playedBefore = true
    voice.setPitch(midiToHz(action.note), time, glide)
    sounding = action.note
    // A scale step differs per note, so the bend moves with the pitch, still finishing a move.
    if (bent.scale)
      voice.bend(bent.semitones(action.note), time, Math.max(glide, bent.rampEnd - time))
    // Legato moves keep the envelopes (and level) of the note they continue.
    if (action.kind === 'attack')
      voice.attack(time, velocityToGain(velocity, preset.velocityRangeDb))
  }

  return {
    preset,
    noteOn: (note, velocity, time) => act(stack.noteOn(note), velocity, time),
    noteOff(note, time) {
      if (latch.noteOff(note)) act(stack.noteOff(note), 0, time)
    },
    releaseAll(time) {
      latch.clear()
      act(stack.releaseAll(), 0, time)
    },
    setSustain(down, time) {
      // Oldest press first, so the sounding note lifts last: lifting it first would move the
      // pitch back to an older sustained note before the release.
      const order = stack.held()
      const notes = latch.hold(down).sort((a, b) => order.indexOf(a) - order.indexOf(b))
      for (const note of notes) act(stack.noteOff(note), 0, time)
    },
    setGlideHold(on) {
      glideHold = on
    },
    bend(amount, time, ramp) {
      bent.move(amount, time, ramp)
      voice.bend(bent.semitones(sounding), time, ramp)
    },
    setBendScale(scale, amount, time) {
      if (bent.set(scale, amount, time)) voice.bend(bent.semitones(sounding), time, 0)
    },
    setKnob: voice.setKnob,
    restartLfo: (time) => voice.restartLfo?.(time),
    heldCount: () => stack.held().length,
    dispose() {
      voice.dispose()
      output.dispose()
    },
  }
}

function polyInstrument(
  preset: Extract<Preset, { kind: 'fm' | 'tines' }>,
  knobs: KnobValues,
  output: Tone.Gain,
): Instrument {
  const allocator = createPolyAllocator(preset.voices)
  const voices = Array.from({ length: preset.voices }, () => createFmVoice(preset, knobs, output))
  const latch = createSustainLatch()
  const bent = createBent()
  /** The note each voice last started, for its own scale step. */
  const notes: (number | null)[] = voices.map(() => null)
  const stop = (note: number, time: number) => {
    const voice = allocator.noteOff(note)
    if (voice !== null) voices[voice].stop(time)
  }

  return {
    preset,
    noteOn(note, velocity, time) {
      const on = allocator.noteOn(note)
      const { voice } = on
      // A stolen note is gone; a note-off still withheld for it would stop its next press.
      if (on.kind === 'steal') latch.forget(on.stolenNote)
      notes[voice] = note
      if (bent.scale)
        voices[voice].bend(bent.semitones(note), time, Math.max(0, bent.rampEnd - time))
      voices[voice].start(
        midiToHz(note),
        velocity,
        velocityToGain(velocity, preset.velocityRangeDb),
        time,
      )
    },
    noteOff(note, time) {
      if (latch.noteOff(note)) stop(note, time)
    },
    releaseAll(time) {
      latch.clear()
      for (const voice of allocator.releaseAll()) voices[voice].stop(time)
    },
    setSustain(down, time) {
      for (const note of latch.hold(down)) stop(note, time)
    },
    setGlideHold() {}, // no glide on a poly instrument
    restartLfo() {},
    bend(amount, time, ramp) {
      bent.move(amount, time, ramp)
      voices.forEach((voice, i) => voice.bend(bent.semitones(notes[i] ?? null), time, ramp))
    },
    setBendScale(scale, amount, time) {
      if (!bent.set(scale, amount, time)) return
      voices.forEach((voice, i) => voice.bend(bent.semitones(notes[i] ?? null), time, 0))
    },
    setKnob(id, value) {
      for (const voice of voices) voice.setKnob(id, value)
    },
    heldCount: allocator.heldCount,
    dispose() {
      for (const voice of voices) voice.dispose()
      output.dispose()
    },
  }
}

/** The bend an instrument holds, and its semitones for one note. */
function createBent() {
  return {
    amount: 0,
    scale: null as readonly number[] | null,
    /** When the last bend move ends: a note re-targeted mid-move finishes with it. */
    rampEnd: 0,
    move(amount: number, time: number, ramp: number) {
      this.amount = amount
      this.rampEnd = time + ramp
    },
    /** True if the scale or amount changed. */
    set(scale: readonly number[] | null, amount: number, time: number): boolean {
      if (scale === this.scale && amount === this.amount) return false
      this.scale = scale
      this.move(amount, time, 0)
      return true
    },
    semitones(note: number | null): number {
      // shortcut: before any note, a scale bend has no step to count, so 0 until one plays.
      if (!this.scale) return this.amount
      return note === null ? 0 : scaleBend(note, this.amount, this.scale)
    },
  }
}
