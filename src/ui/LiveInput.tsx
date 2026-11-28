import { useEffect, useRef } from 'react'
import { Note } from 'tonal'
import { createHeldNotes, nameHeld } from '../analysis/recognize.ts'
import { inputBus } from '../input/bus.ts'
import { noteNames } from '../music/spelling.ts'
import { useAudioStore } from '../state/audio.ts'
import { useDrillStore } from '../state/drills.ts'
import { grooveOf, useGrooveStore } from '../state/groove.ts'
import { useViewStore } from '../state/view.ts'

// Shows what is played (P2-T9), the held notes and the pedal as received from the input bus.
// Updated by writing to the DOM once per animation frame after an input event, not through React
// state (hot-path rule 4).
// shortcut: the chord name follows a key, groove, scale, pedal-mode or drill open/close change at
// the next input event, not at once; subscribe to those stores if a stale name ever shows.
export function LiveInput() {
  const chordOn = useViewStore((s) => s.chordName)
  const chordRef = useRef<HTMLElement>(null)
  const notesRef = useRef<HTMLElement>(null)
  const pedalRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const held = new Set<number>()
    // Sounding notes for the chord name: pedal-held ones count in Sustain mode.
    const sounding = createHeldNotes(() => useAudioStore.getState().expression.pedalMode)
    let pedal: boolean | null = null
    let frame = 0
    let names: string[] = []
    let namesFor = ''

    const render = () => {
      frame = 0
      if (chordRef.current) {
        const { tonic, scale, grooveId } = useGrooveStore.getState()
        const key = { tonic, mode: grooveOf(grooveId).key.mode }
        if (namesFor !== `${tonic} ${key.mode} ${scale}`) {
          names = noteNames(key, scale)
          namesFor = `${tonic} ${key.mode} ${scale}`
        }
        // an open drill has its own key, so no numeral in the groove's
        const { name, numeral } = nameHeld(
          sounding.notes(),
          names,
          useDrillStore.getState().drill ? null : key,
        )
        chordRef.current.textContent = numeral ? `${name} · ${numeral}` : name || '–'
      }
      if (notesRef.current) {
        const notes = [...held].sort((a, b) => a - b)
        notesRef.current.textContent =
          notes.length === 0
            ? 'none'
            : notes.map((n) => `${Note.fromMidiSharps(n)} (${n})`).join(' ')
      }
      if (pedalRef.current) {
        pedalRef.current.textContent = pedal === null ? 'not used yet' : pedal ? 'down' : 'up'
      }
    }
    render()

    const unsubscribe = inputBus.subscribe((event) => {
      if (event.kind === 'noteOn') held.add(event.note)
      else if (event.kind === 'noteOff') held.delete(event.note)
      else if (event.kind === 'pedal') pedal = event.down
      sounding.apply(event)
      if (frame === 0) frame = requestAnimationFrame(render)
    })
    return () => {
      unsubscribe()
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <dl className="live">
      <dt hidden={!chordOn}>Playing</dt>
      <dd ref={chordRef} className="chord-name" data-testid="chord-name" hidden={!chordOn} />
      <dt>Held notes</dt>
      <dd ref={notesRef} className="held" data-testid="held-notes" />
      <dt>Pedal</dt>
      <dd ref={pedalRef} data-testid="pedal" />
    </dl>
  )
}
