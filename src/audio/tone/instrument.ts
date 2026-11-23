// A playable instrument built from a preset: the pure voice logic (src/audio/voices.ts)
// deciding, the Tone voices (./voices.ts) sounding. Instances, not a singleton: the split
// keyboard (P0-T6) plays two at once.

import * as Tone from 'tone'
import { dbToGain, midiToHz, velocityToGain } from '../curves.ts'
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
  setKnob(id: string, value: number): void
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

  function act(action: MonoAction | null, velocity: number, time: number) {
    if (action === null) return
    if (action.kind === 'release') {
      voice.release(time)
      return
    }
    voice.setPitch(midiToHz(action.note), time, glideTimeFor(action, voice.glide()))
    // Legato moves keep the envelopes (and level) of the note they continue.
    if (action.kind === 'attack')
      voice.attack(time, velocityToGain(velocity, preset.velocityRangeDb))
  }

  return {
    preset,
    noteOn: (note, velocity, time) => act(stack.noteOn(note), velocity, time),
    noteOff: (note, time) => act(stack.noteOff(note), 0, time),
    releaseAll: (time) => act(stack.releaseAll(), 0, time),
    setKnob: voice.setKnob,
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

  return {
    preset,
    noteOn(note, velocity, time) {
      const { voice } = allocator.noteOn(note)
      voices[voice].start(
        midiToHz(note),
        velocity,
        velocityToGain(velocity, preset.velocityRangeDb),
        time,
      )
    },
    noteOff(note, time) {
      const voice = allocator.noteOff(note)
      if (voice !== null) voices[voice].stop(time)
    },
    releaseAll(time) {
      for (const voice of allocator.releaseAll()) voices[voice].stop(time)
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
