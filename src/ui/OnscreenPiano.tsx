import { useEffect, useRef, type PointerEvent } from 'react'
import { Note } from 'tonal'
import { inputBus } from '../input/bus.ts'
import { KEY_OFFSETS } from '../input/computer/keyboard.ts'
import { pointerPiano } from '../state/input.ts'

// A minimal DOM piano, C3 to C6. The 61-key canvas keyboard with velocity and zones is P0-T9.
const LOW = 48
const HIGH = 84
const BLACK_PCS = new Set([1, 3, 6, 8, 10])

interface KeyLayout {
  note: number
  black: boolean
  left: number // %
  width: number // %
}

const KEYS: KeyLayout[] = (() => {
  const whites: number[] = []
  for (let n = LOW; n <= HIGH; n++) if (!BLACK_PCS.has(n % 12)) whites.push(n)
  const w = 100 / whites.length
  const bw = w * 0.62
  const keys: KeyLayout[] = []
  for (let n = LOW; n <= HIGH; n++) {
    if (BLACK_PCS.has(n % 12)) {
      // Centered on the line after the white key below it.
      keys.push({ note: n, black: true, left: (whites.indexOf(n - 1) + 1) * w - bw / 2, width: bw })
    } else {
      keys.push({ note: n, black: false, left: whites.indexOf(n) * w, width: w })
    }
  }
  // Whites first so blacks paint (and hit-test) on top.
  return [...keys.filter((k) => !k.black), ...keys.filter((k) => k.black)]
})()

const KEY_LABELS: [code: string, label: string][] = Object.keys(KEY_OFFSETS).map((code) => [
  code,
  code === 'Semicolon' ? ';' : code === 'Quote' ? "'" : code.slice(3),
])

function noteAt(container: HTMLElement, x: number, y: number): number | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-note]')
  return el && container.contains(el) ? Number(el.dataset.note) : null
}

/**
 * Lights every held note, whatever the source (MIDI, computer keys, pointer, sim). Lit state
 * is written to `data-held` once per animation frame, not through React (hot-path rule 4).
 */
export function OnscreenPiano({ baseNote }: { baseNote: number }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const elements = new Map<number, HTMLElement>()
    for (const el of container.querySelectorAll<HTMLElement>('[data-note]')) {
      elements.set(Number(el.dataset.note), el)
    }
    const held = new Set<number>()
    const dirty = new Set<number>()
    let frame = 0
    const render = () => {
      frame = 0
      for (const note of dirty)
        elements.get(note)?.setAttribute('data-held', String(held.has(note)))
      dirty.clear()
    }
    const unsubscribe = inputBus.subscribe((event) => {
      if (event.kind === 'noteOn') held.add(event.note)
      else if (event.kind === 'noteOff') held.delete(event.note)
      else return
      dirty.add(event.note)
      if (frame === 0) frame = requestAnimationFrame(render)
    })
    return () => {
      unsubscribe()
      cancelAnimationFrame(frame)
      pointerPiano.releaseAll(performance.now())
    }
  }, [])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const note = noteAt(e.currentTarget, e.clientX, e.clientY)
    if (note === null) return
    e.preventDefault() // no text selection or focus change
    e.currentTarget.setPointerCapture(e.pointerId)
    pointerPiano.down(e.pointerId, note, e.timeStamp)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0) return
    pointerPiano.move(e.pointerId, noteAt(e.currentTarget, e.clientX, e.clientY), e.timeStamp)
  }
  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) =>
    pointerPiano.up(e.pointerId, e.timeStamp)

  const letters = new Map(KEY_LABELS.map(([code, label]) => [baseNote + KEY_OFFSETS[code], label]))

  return (
    <div
      ref={containerRef}
      className="piano"
      role="group"
      aria-label="On-screen piano"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
    >
      {KEYS.map((k) => (
        <div
          key={k.note}
          className={k.black ? 'piano-key black' : 'piano-key white'}
          data-note={k.note}
          data-held="false"
          title={Note.fromMidiSharps(k.note)}
          style={{ left: `${k.left}%`, width: `${k.width}%` }}
        >
          {letters.has(k.note) && <span className="piano-letter">{letters.get(k.note)}</span>}
          {k.note % 12 === 0 && <span className="piano-name">{Note.fromMidiSharps(k.note)}</span>}
        </div>
      ))}
    </div>
  )
}
