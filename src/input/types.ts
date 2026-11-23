// Every input source (MIDI, computer keyboard, on-screen piano, simulated) emits these.
// See docs/architecture.md, "Core types".

export type InputSource = 'midi' | 'computer' | 'onscreen' | 'sim'

export type InputEvent =
  | { kind: 'noteOn'; note: number; velocity: number; time: number; source: InputSource }
  | { kind: 'noteOff'; note: number; time: number; source: InputSource }
  | { kind: 'pedal'; down: boolean; time: number; source: InputSource }
  | { kind: 'bend'; semitones: number; time: number; source: InputSource }

// note: MIDI number 0..127. velocity: 0..1. time: performance time in ms
// (MIDIMessageEvent.timeStamp for MIDI). semitones: bend offset from center.
