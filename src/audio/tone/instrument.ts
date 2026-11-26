// A playable instrument built from a preset: the pure voice logic (src/audio/voices.ts)
// deciding, the Tone voices (./voices.ts) sounding. Instances, not a singleton: the split
// keyboard (P0-T6) plays two at once.

import * as Tone from 'tone'
import { dbToGain, midiToHz, velocityToGain } from '../curves.ts'
import { createSustainLatch } from '../expression.ts'
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
  /** Bends every sounding and later note to `semitones`, sliding over `ramp` seconds. */
  bend(semitones: number, time: number, ramp: number): void
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
  }
}

function monoInstrument(preset: Preset, voice: MonoVoice, output: Tone.Gain): Instrument {
  voice.output.connect(output)
  const stack = createMonoNoteStack()
  const latch = createSustainLatch()
  let glideHold = false
  let playedBefore = false

  function act(action: MonoAction | null, velocity: number, time: number) {
    if (action === null) return
    if (action.kind === 'release') {
      voice.release(time)
      return
    }
    const glide = glideTimeFor(action, voice.glide(), glideHold, playedBefore)
    playedBefore = true
    voice.setPitch(midiToHz(action.note), time, glide)
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
    bend: voice.bend,
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
  preset: Extract<Preset, { kind: 'fm' }>,
  knobs: KnobValues,
  output: Tone.Gain,
): Instrument {
  const allocator = createPolyAllocator(preset.voices)
  const voices = Array.from({ length: preset.voices }, () => createFmVoice(preset, knobs, output))
  const latch = createSustainLatch()
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
    bend(semitones, time, ramp) {
      for (const voice of voices) voice.bend(semitones, time, ramp)
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
