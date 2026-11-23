import { useEffect, useRef } from 'react'
import { Note } from 'tonal'
import { inputBus } from '../input/bus.ts'

// Shows held notes and the pedal as received from the input bus. Updated by writing to the DOM
// once per animation frame, not through React state (hot-path rule 4).
export function LiveInput() {
  const notesRef = useRef<HTMLElement>(null)
  const pedalRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const held = new Set<number>()
    let pedal: boolean | null = null
    let frame = 0

    const render = () => {
      frame = 0
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
      if (frame === 0) frame = requestAnimationFrame(render)
    })
    return () => {
      unsubscribe()
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <dl className="live">
      <dt>Held notes</dt>
      <dd ref={notesRef} data-testid="held-notes" />
      <dt>Pedal</dt>
      <dd ref={pedalRef} data-testid="pedal" />
    </dl>
  )
}
