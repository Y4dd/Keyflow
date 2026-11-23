// Smoke test: every stack library imports and works under TypeScript 7 + Vitest.
// Replace or remove once real modules have their own tests.
import { describe, expect, it } from 'vitest'
import { Chord, Scale } from 'tonal'
import { createEmptyCard, fsrs, Rating } from 'ts-fsrs'
import { createStore } from 'zustand/vanilla'
import { Dexie } from 'dexie'
import { Midi } from '@tonejs/midi'

describe('stack libraries', () => {
  it('tonal spells chords and scales', () => {
    expect(Chord.get('Em').notes).toEqual(['E', 'G', 'B'])
    expect(Scale.get('A minor pentatonic').notes).toEqual(['A', 'C', 'D', 'E', 'G'])
  })

  it('ts-fsrs schedules a review', () => {
    const scheduler = fsrs()
    const now = new Date('2026-01-01T00:00:00Z')
    const result = scheduler.next(createEmptyCard(now), now, Rating.Good)
    expect(result.card.due.getTime()).toBeGreaterThan(now.getTime())
  })

  it('zustand vanilla store updates outside React', () => {
    const store = createStore<{ held: number[] }>(() => ({ held: [] }))
    store.setState({ held: [64, 67, 71] })
    expect(store.getState().held).toEqual([64, 67, 71])
  })

  it('dexie imports', () => {
    expect(typeof Dexie).toBe('function')
  })

  it('@tonejs/midi round-trips a note', () => {
    const midi = new Midi()
    midi.addTrack().addNote({ midi: 64, time: 0, duration: 0.5, velocity: 0.8 })
    const parsed = new Midi(midi.toArray())
    expect(parsed.tracks[0]?.notes[0]?.midi).toBe(64)
  })

  it('tone imports', async () => {
    const Tone = await import('tone')
    expect(typeof Tone.MonoSynth).toBe('function')
    expect(typeof Tone.immediate).toBe('function')
  })
})
