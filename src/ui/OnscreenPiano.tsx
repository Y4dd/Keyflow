import { useEffect, useRef, type PointerEvent } from 'react'
import { inputBus } from '../input/bus.ts'
import { attachWheelBend } from '../input/computer/bend.ts'
import { KEY_OFFSETS } from '../input/computer/keyboard.ts'
import { harmonyAt, stepIndexAt } from '../grooves/groove.ts'
import { noteNames } from '../music/spelling.ts'
import { useAudioStore } from '../state/audio.ts'
import { shownGroove, shownTick, useGrooveStore } from '../state/groove.ts'
import { laptopBend, pointerPiano } from '../state/input.ts'
import { useViewStore } from '../state/view.ts'
import { drawKeyboard, ZONE_STRIP } from './canvas/keyboard.ts'
import { keyRects, noteAt, type KeyRect } from './canvas/keys.ts'

const KEY_LABELS: [code: string, label: string][] = Object.keys(KEY_OFFSETS).map((code) => [
  code,
  code === 'Semicolon' ? ';' : code === 'Quote' ? "'" : code.slice(3),
])

/**
 * The 61-key canvas keyboard: lights every held note by velocity, whatever the source (MIDI,
 * computer keys, pointer, sim), shows the zones and the split point, highlights the groove's
 * chord and scale tones, and plays on click or touch. It redraws in an animation frame after a
 * change, reading state there, never through React (hot-path rule 4). While a groove plays it
 * checks each frame whether the shown chord moved on, and redraws only when it did.
 */
export function OnscreenPiano({ baseNote }: { baseNote: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const keysRef = useRef<KeyRect[]>([])
  const baseRef = useRef(baseNote)
  const redrawRef = useRef(() => {})

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const container = canvas.parentElement!
    const held = new Map<number, number>()
    let size = { width: 0, height: 0 }
    let frame = 0
    let watch = 0
    let shownStep = -1
    let names: string[] = []
    let namesFor = '' // the key and scale \`names\` was spelled for: it changes only with them
    const draw = () => {
      frame = 0
      const base = baseRef.current
      const { keyLetters, look } = useViewStore.getState()
      const letters = new Map(
        keyLetters ? KEY_LABELS.map(([code, label]) => [base + KEY_OFFSETS[code], label]) : [],
      )
      const { layout } = useAudioStore.getState()
      const { scale, wheels, tonic } = useGrooveStore.getState()
      const g = shownGroove()
      const tick = shownTick()
      shownStep = stepIndexAt(g, tick)
      const key = { tonic, mode: g.key.mode }
      if (namesFor !== `${tonic} ${key.mode} ${scale}`) {
        names = noteNames(key, scale)
        namesFor = `${tonic} ${key.mode} ${scale}`
      }
      const jam = { harmony: harmonyAt(g, tick, scale), wheels, names, look }
      drawKeyboard(ctx, { ...size, keys: keysRef.current, held, layout, letters, jam })
    }
    const redraw = () => {
      if (frame === 0) frame = requestAnimationFrame(draw)
    }
    redrawRef.current = redraw
    // While playing: one cheap step lookup a frame, a redraw only when the chord moves on.
    const follow = () => {
      if (!useGrooveStore.getState().playing) {
        watch = 0
        return
      }
      if (stepIndexAt(shownGroove(), shownTick()) !== shownStep) redraw()
      watch = requestAnimationFrame(follow)
    }

    // shortcut: a zoom that changes devicePixelRatio but not the CSS size keeps the old
    // resolution until the next resize; listen to matchMedia resolution changes if it blurs.
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      size = { width, height }
      keysRef.current = keyRects(width, height, ZONE_STRIP)
      redraw()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    const unsubscribe = inputBus.subscribe((event) => {
      if (event.kind === 'noteOn') held.set(event.note, event.velocity)
      else if (event.kind === 'noteOff') held.delete(event.note)
      else return
      redraw()
    })
    const unsubscribeLayout = useAudioStore.subscribe((s, prev) => {
      if (s.layout !== prev.layout) redraw()
    })
    // Every groove control change (groove, key, scale, training wheels, play and stop) redraws.
    const unsubscribeGroove = useGrooveStore.subscribe((s) => {
      redraw()
      if (s.playing && watch === 0) watch = requestAnimationFrame(follow)
    })
    const unsubscribeView = useViewStore.subscribe(redraw)
    const detachWheel = attachWheelBend(laptopBend, container) // scroll over the keys to bend
    return () => {
      unsubscribe()
      unsubscribeLayout()
      unsubscribeGroove()
      unsubscribeView()
      observer.disconnect()
      detachWheel()
      cancelAnimationFrame(frame)
      cancelAnimationFrame(watch)
      redrawRef.current = () => {}
      pointerPiano.releaseAll(performance.now())
    }
  }, [])

  useEffect(() => {
    baseRef.current = baseNote
    redrawRef.current()
  }, [baseNote])

  const noteUnder = (e: PointerEvent<HTMLDivElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return noteAt(keysRef.current, e.clientX - rect.left, e.clientY - rect.top)
  }
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const note = noteUnder(e)
    if (note === null) return
    e.preventDefault() // no text selection or focus change
    e.currentTarget.setPointerCapture(e.pointerId)
    pointerPiano.down(e.pointerId, note, e.timeStamp)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0) return
    pointerPiano.move(e.pointerId, noteUnder(e), e.timeStamp)
  }
  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) =>
    pointerPiano.up(e.pointerId, e.timeStamp)

  // shortcut: below about 600 px wide the keys get thin for fingers; add a scrolling or
  // zoomed view if phones matter.
  return (
    <div
      className="piano"
      role="group"
      aria-label="On-screen piano"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
    >
      <canvas ref={canvasRef} className="piano-canvas" aria-hidden="true" />
    </div>
  )
}
