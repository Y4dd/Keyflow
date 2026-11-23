// Pure MIDI bytes -> InputEvent parsing. No DOM, no Tone.js, no React.
// Rules come from the P0-T2 findings (docs/phases/phase-0-foundation.md, Findings) and
// docs/architecture.md, "MIDI parsing facts".

import type { InputEvent } from '../types.ts'

const NOTE_OFF = 0x80
const NOTE_ON = 0x90
const CONTROL_CHANGE = 0xb0
const SUSTAIN = 64

export interface MidiParserOptions {
  /** Treat CC64 >= 64 on every channel as "up" (reversed pedals). Default false. */
  invertPedal?: boolean
}

export interface MidiParser {
  /** One complete MIDI message (Web MIDI delivers one per event). Null when it maps to nothing. */
  parse(data: ArrayLike<number>, time: number): InputEvent | null
  /**
   * Note-offs for every held note, plus pedal-up if the pedal is down, then a full reset.
   * Call when the device disconnects so nothing downstream is left stuck.
   */
  releaseAll(time: number): InputEvent[]
  /** Change pedal polarity. Returns a pedal event if the effective pedal state flips. */
  setInvertPedal(invert: boolean, time: number): InputEvent | null
}

/** One parser per MIDI input: held notes and pedal state are per device. */
export function createMidiParser(options: MidiParserOptions = {}): MidiParser {
  let invert = options.invertPedal ?? false
  const held = new Uint8Array(128) // 1 = a note-on was seen without its note-off
  // CC64 value per channel. The YPT-380 sends every pedal change on channels 1-3, and channel 3
  // always sends 0, so the pedal is down if ANY channel is >= 64 (never "the last message").
  const sustain = new Uint8Array(16)
  let sawPedal = false // nothing is emitted for the pedal until the first CC64 arrives
  let pedalDown = false

  function computeDown(): boolean {
    let anyHigh = false
    for (let ch = 0; ch < 16; ch++) {
      if (sustain[ch] >= 64) {
        anyHigh = true
        break
      }
    }
    // Invert the aggregate, not each channel: inverted per channel, the YPT-380's constant
    // channel-3 zero would read as a pedal held down forever.
    return invert ? !anyHigh : anyHigh
  }

  function updatePedal(time: number): InputEvent | null {
    const down = computeDown()
    if (down === pedalDown) return null
    pedalDown = down
    return { kind: 'pedal', down, time, source: 'midi' }
  }

  return {
    parse(data, time) {
      const status = data[0]
      // System realtime (0xF8 clock, 0xFE active sensing, ...): the YPT-380 streams clock
      // constantly, so this check comes first.
      if (status >= 0xf8) return null
      // Stray data bytes, sysex and system common: not used.
      if (status < 0x80 || status >= 0xf0 || data.length < 3) return null

      const type = status & 0xf0
      // Notes are accepted on every channel (the YPT-380 sometimes sends on ch 2 and 3), and
      // never clamped to 36-96 (the keyboard's transpose shifts what it sends).
      if (type === NOTE_ON || type === NOTE_OFF) {
        const note = data[1] & 0x7f
        const velocity = data[2] & 0x7f
        // Note-on with velocity 0 is a note-off; the YPT-380 only sends note-offs this way.
        if (type === NOTE_ON && velocity > 0) {
          held[note] = 1
          return { kind: 'noteOn', note, velocity: velocity / 127, time, source: 'midi' }
        }
        held[note] = 0
        return { kind: 'noteOff', note, time, source: 'midi' }
      }

      if (type === CONTROL_CHANGE && (data[1] & 0x7f) === SUSTAIN) {
        sustain[status & 0x0f] = data[2] & 0x7f
        sawPedal = true
        return updatePedal(time)
      }

      // Bank select, program change, volume, pan and other CCs (the voice-change burst),
      // aftertouch and pitch bend are ignored.
      return null
    },

    releaseAll(time) {
      const events: InputEvent[] = []
      for (let note = 0; note < 128; note++) {
        if (held[note]) {
          held[note] = 0
          events.push({ kind: 'noteOff', note, time, source: 'midi' })
        }
      }
      if (pedalDown) events.push({ kind: 'pedal', down: false, time, source: 'midi' })
      pedalDown = false
      sawPedal = false
      sustain.fill(0)
      return events
    },

    setInvertPedal(next, time) {
      invert = next
      return sawPedal ? updatePedal(time) : null
    },
  }
}
