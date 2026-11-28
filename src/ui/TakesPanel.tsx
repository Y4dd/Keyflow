import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  blueNote,
  evidence,
  noteMarks,
  suggest,
  takeStats,
  type Evidence,
  type NoteMark,
  type Suggestion,
  type TakeStats,
} from '../analysis/stats.ts'
import { takeToMidi, type Take } from '../analysis/take.ts'
import type { Groove } from '../grooves/groove.ts'
import { pc } from '../music/harmony.ts'
import { transpose } from '../grooves/groove.ts'
import { GROOVES } from '../grooves/library.ts'
import { keyName, noteNames } from '../music/spelling.ts'
import type { StoredTake } from '../storage/db.ts'
import { useAudioStore } from '../state/audio.ts'
import { groove, grooveOf } from '../state/groove.ts'
import { canReplay, takes, useTakesStore } from '../state/takes.ts'
import { drawRoll, ROLL_LOOKS, type RollFocus, type RollLook } from './canvas/roll.ts'

const clock = (ms: number) => {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const when = (t: number) =>
  new Date(t).toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

// shortcut: a take whose groove was removed from the app shows the first groove's key mode and
// chords in its roll (none exists yet); store the groove's name and mode in the take if one does.
const grooveName = (take: Take) =>
  GROOVES.find((g) => g.id === take.grooveId)?.name ?? 'A groove no longer in the app'

const keyOf = (take: Take) => {
  const mode = grooveOf(take.grooveId).key.mode
  return `${keyName({ tonic: take.tonic, mode })} ${mode}`
}

/** "keyflow-neo-soul-drift-2026-11-26-2114.mid": the groove and when, in local time. */
function fileName(take: Take) {
  const d = new Date(take.createdAt)
  const two = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
  return `keyflow-${take.grooveId}-${date}-${two(d.getHours())}${two(d.getMinutes())}.mid`
}

function download(take: Take) {
  const url = URL.createObjectURL(new Blob([takeToMidi(take)], { type: 'audio/midi' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName(take)
  a.click()
  // After the click has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** What the roll and the stats share: one take's marks, stats and evidence (P2-T11). */
interface Analysis {
  /** The take's groove in its key, for the roll's chords. */
  shown: Groove
  names: readonly string[]
  marks: NoteMark[]
  stats: TakeStats
  suggestion: Suggestion
  evidence: Evidence | null
}

function analyse(take: StoredTake): Analysis {
  const g = grooveOf(take.grooveId)
  const shown = transpose(g, take.tonic - g.key.tonic)
  const names = noteNames(shown.key, take.scale)
  // Without its groove there are no chords to compare with.
  const compare = canReplay(take) ? shown : null
  const marks = noteMarks(take, compare)
  const stats = takeStats(take, compare, marks)
  const suggestion = suggest(stats, take)
  return { shown, names, marks, stats, suggestion, evidence: evidence(suggestion, take, marks) }
}

/** What the roll reads each frame: the stat in focus and the marking look. */
interface RollState {
  focus: RollFocus
  look: RollLook
}

/**
 * The chosen take's piano roll. It reads the focus, the look and its size each frame and redraws
 * only when one changed, so hovering a stat re-renders nothing.
 */
function Roll({ take, a, state }: { take: StoredTake; a: Analysis; state: RefObject<RollState> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let drawn = ''
    let frame = 0
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const { width, height } = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const { focus, look } = state.current
      const key = `${width}x${height}@${dpr} ${focus} ${look}`
      if (key === drawn || width === 0) return
      drawn = key
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawRoll(ctx, {
        width,
        height,
        take,
        groove: a.shown,
        scale: take.scale,
        marks: a.marks,
        stats: a.stats,
        evidence: a.evidence,
        focus,
        look,
        names: a.names,
      })
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [take, a, state])
  const { marks } = a
  const out = marks.filter((m) => !m.inScale).length
  const strong = marks.filter((m) => m.strong).length
  const chordTones = marks.filter((m) => m.chordTone).length
  return (
    <div className="roll">
      <canvas
        ref={canvasRef}
        className="roll-canvas"
        role="img"
        data-in-scale={marks.length - out}
        data-out={out}
        data-strong={strong}
        data-chord-tones={chordTones}
        aria-label={`Piano roll: ${marks.length} notes over ${grooveName(take)}, ${clock(take.lengthMs)} long; ${marks.length - out} in the scale, ${out} outside it${canReplay(take) ? `; ${chordTones} of ${strong} on beats 1 and 3 are chord tones` : ''}`}
      />
    </div>
  )
}

const percent = (share: number) => `${Math.round(share * 100)}%`

/** "1.5 bars", "3 beats": a rest in the take's own beats, to the half. */
function restLength(ms: number, bpm: number) {
  const beats = (ms * bpm) / 60_000
  // Down, so a rest just short of a bar never reads as one beside the "bar of space" tip.
  const half = (n: number) => Math.floor(n * 2) / 2
  const [n, unit] = beats >= 4 ? [half(beats / 4), 'bar'] : [half(beats), 'beat']
  if (n === 0) return 'Under half a beat'
  return `${n} ${unit}${n === 1 ? '' : 's'}`
}

function suggestionText(s: Suggestion, take: Take, names: readonly string[]): string {
  switch (s) {
    case 'longer':
      return 'Play a little longer next time: a few phrases give you more to hear back.'
    case 'space':
      return 'Try leaving a full bar of space between phrases.'
    case 'blueNote':
      return `You haven’t used the blue note yet: try ${names[blueNote(take.tonic)]} on the way from ${names[pc(take.tonic + 5)]} to ${names[pc(take.tonic + 7)]}.`
    case 'land':
      return 'Try landing on a chord tone on beats 1 and 3: the keyboard marks them as the chords change.'
    case 'range':
      return 'Try starting your next phrase an octave higher or lower than the last.'
    case 'scale':
      return 'Try one pass using only the scale’s notes, so the outside notes you add later stand out.'
    case 'repeat':
      return 'Next time, try playing one short idea twice and changing how it ends.'
  }
}

/** What the chosen take holds, and one thing to try next. No score. */
function Stats({ take, a, state }: { take: StoredTake; a: Analysis; state: RefObject<RollState> }) {
  const { stats, names } = a
  const tip = suggestionText(a.suggestion, take, names)
  // Hover (a mouse) or focus (a tap or Tab) lights the notes a stat counts on the roll.
  const point = (focus: RollFocus) => ({
    tabIndex: 0,
    onFocus: () => (state.current.focus = focus),
    onBlur: () => (state.current.focus = null),
    onPointerEnter: (e: { pointerType: string }) => {
      if (e.pointerType === 'mouse') state.current.focus = focus
    },
    onPointerLeave: (e: { pointerType: string; currentTarget: Element }) => {
      if (e.pointerType === 'mouse' && document.activeElement !== e.currentTarget)
        state.current.focus = null
    },
  })
  // C♭ belongs to the octave above its key, B♯ to the one below.
  const name = (n: number) => {
    const s = names[pc(n)]!
    return `${s}${Math.floor(n / 12) - 1 + (s === 'C♭' ? 1 : s === 'B♯' ? -1 : 0)}`
  }
  const { lowest, highest, inScale, strongBeats, longestRestMs } = stats
  return (
    <div className="take-stats" data-testid="take-stats">
      <dl>
        <div>
          <dt>Notes</dt>
          <dd>{stats.notes}</dd>
        </div>
        {lowest !== null && highest !== null && (
          <div {...point('range')}>
            <dt>Range</dt>
            <dd>{lowest === highest ? name(lowest) : `${name(lowest)} to ${name(highest)}`}</dd>
          </div>
        )}
        {inScale !== null && (
          <div {...point('inScale')}>
            <dt>In the scale</dt>
            <dd>{percent(inScale)}</dd>
          </div>
        )}
        {strongBeats && stats.notes > 0 && (
          <div {...point('strong')}>
            <dt>Chord tones on 1 and 3</dt>
            <dd>
              {strongBeats.notes === 0
                ? 'No notes on 1 or 3'
                : `${percent(strongBeats.chordTones / strongBeats.notes)} (${strongBeats.chordTones} of ${strongBeats.notes})`}
            </dd>
          </div>
        )}
        {longestRestMs !== null && (
          <div {...point('rest')}>
            <dt>Longest rest</dt>
            <dd>{restLength(longestRestMs, take.bpm)}</dd>
          </div>
        )}
      </dl>
      <p className="take-tip">{tip}</p>
    </div>
  )
}

/**
 * The marking look, a temporary choice for the P2-T11 taste check; the pick becomes the only look.
 * shortcut: kept for the visit only, not saved; the chips go once the look is picked.
 */
function LookChips({ state }: { state: RefObject<RollState> }) {
  const [look, setLook] = useState(state.current.look)
  return (
    <div className="chips roll-looks" role="radiogroup" aria-label="Roll marks">
      {ROLL_LOOKS.map((l) => (
        <label key={l} className="chip">
          <input
            type="radio"
            name="roll-look"
            value={l}
            checked={l === look}
            onChange={() => {
              state.current.look = l
              setLook(l)
            }}
          />
          {l[0]!.toUpperCase() + l.slice(1)}
        </label>
      ))}
    </div>
  )
}

/** The chosen take: its roll, stats and actions. */
function TakeView({
  take,
  running,
  recording,
}: {
  take: StoredTake
  running: boolean
  recording: boolean
}) {
  const a = useMemo(() => analyse(take), [take])
  const state = useRef<RollState>({ focus: null, look: 'fill' })
  const isReplaying = useTakesStore((s) => s.replaying === take.id)
  return (
    <div className="take-view">
      <Roll take={take} a={a} state={state} />
      <LookChips state={state} />
      <Stats take={take} a={a} state={state} />
      <div className="actions">
        <button
          type="button"
          aria-pressed={isReplaying}
          disabled={!running || recording || !canReplay(take)}
          onClick={isReplaying ? groove.stop : () => takes.replay(take.id)}
        >
          {isReplaying ? 'Stop replay' : 'Replay'}
        </button>
        <button type="button" onClick={() => download(take)}>
          Export .mid
        </button>
        <span className="muted small">
          {!canReplay(take)
            ? 'Its groove isn’t in the app any more, so it can’t replay; the export still works.'
            : running
              ? 'Replays over its groove, through the sounds set now.'
              : 'Turn sound on to replay.'}
        </span>
      </div>
    </div>
  )
}

/** Saved takes: pick one to see its piano roll, replay it over its groove, or export it. */
export function TakesPanel() {
  const { takes: list, selected, recording, error } = useTakesStore()
  const running = useAudioStore((s) => s.status === 'running')
  const take = list.find((t) => t.id === selected) ?? list[0]

  return (
    <section className="card takes" aria-labelledby="takes-tab" data-testid="takes">
      <h2 className="tab" id="takes-tab">
        Takes{' '}
        {list.length > 0 && (
          <span className="range">
            {list.length === 1 ? '1 take' : `${list.length} takes, newest first`}
          </span>
        )}
      </h2>
      {error && <p className="hint">{error}</p>}
      {!take ? (
        <p className="blurb takes-empty">
          No takes yet. Press <strong>Record</strong> over the keys, play over the groove, then{' '}
          <strong>Save take</strong>: it lands here, to replay over its groove or export as a MIDI
          file.
        </p>
      ) : (
        <div className="takes-body">
          <div className="take-list" role="radiogroup" aria-label="Takes">
            {list.map((t) => (
              <label key={t.id} className="take">
                <input
                  type="radio"
                  name="take"
                  checked={t.id === take.id}
                  onChange={() => takes.select(t.id)}
                />
                <span className="take-name">{grooveName(t)}</span>
                <span className="take-meta">
                  {keyOf(t)} · {Math.round(t.bpm)} BPM · {clock(t.lengthMs)} · {when(t.createdAt)}
                </span>
              </label>
            ))}
          </div>
          <TakeView take={take} running={running} recording={recording} />
        </div>
      )}
    </section>
  )
}
