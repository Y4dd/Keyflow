import type { ChangeEvent } from 'react'
import { useAudioStore } from '../state/audio.ts'
import { GROOVES } from '../grooves/library.ts'
import type { ScaleId } from '../music/harmony.ts'
import type { Wheels } from '../music/highlight.ts'
import { keyName } from '../music/spelling.ts'
import { groove, grooveOf, scalesOf, tempoRange, useGrooveStore } from '../state/groove.ts'
import { useViewStore, view } from '../state/view.ts'
import type { Look } from './canvas/keys.ts'

const SCALE_NAMES: Record<ScaleId, string> = {
  'minor pentatonic': 'Minor pentatonic',
  'minor blues': 'Blues',
  dorian: 'Dorian',
  'major pentatonic': 'Major pentatonic',
  major: 'Major',
  mixolydian: 'Mixolydian',
}

const WHEELS: { level: Wheels; label: string; text: string }[] = [
  {
    level: 3,
    label: 'Names',
    text: 'Chord tones marked strongly, the rest of the scale softly, names on both, and the other keys dimmed.',
  },
  {
    level: 2,
    label: 'No names',
    text: 'Chord tones marked strongly, the rest of the scale softly, and the other keys dimmed.',
  },
  { level: 1, label: 'Chord tones', text: 'Only the chord tones marked.' },
  { level: 0, label: 'Off', text: 'No help on the keys: play by ear.' },
]

// shortcut: the looks are on trial (P1-T4b); the pick stays and this picker goes.
const LOOK_CHIPS: { look: Look; label: string; text: string }[] = [
  { look: 'spotlight', label: 'Spotlight', text: 'Brightness only: no marks on the keys.' },
  { look: 'tape', label: 'Tape', text: 'A bar across each key, under the black keys.' },
  { look: 'frames', label: 'Frames', text: "An outline inside each key, in the sound's colour." },
  { look: 'tags', label: 'Tags', text: 'A dark tag holding the name on chord tones.' },
]

// A focused menu takes the computer keys (type-ahead), so let go after a choice.
const blur = (e: ChangeEvent<HTMLSelectElement>) => e.currentTarget.blur()

function TransportIcon({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      {playing ? (
        <rect x="3" y="3" width="10" height="10" rx="1.5" fill="currentColor" />
      ) : (
        <path d="M4.5 2.5v11l9-5.5z" fill="currentColor" strokeLinejoin="round" />
      )}
    </svg>
  )
}

/** The groove transport: play and stop, which groove, key, tempo, loop and count-in. */
export function GroovePanel() {
  const { grooveId, tonic, bpm, loop, countIn, playing, scale, wheels } = useGrooveStore()
  const running = useAudioStore((s) => s.status === 'running')
  const g = grooveOf(grooveId)
  const [min, max] = tempoRange(g)
  const wheel = WHEELS.find((w) => w.level === wheels)!
  const look = useViewStore((s) => s.look)
  const lookChip = LOOK_CHIPS.find((l) => l.look === look)!

  return (
    <section className="card groove" aria-labelledby="groove-tab" data-testid="groove">
      <h2 className="tab" id="groove-tab">
        Groove <span className="range">{g.name}</span>
      </h2>
      <div className="transport">
        <button
          type="button"
          className="transport-play"
          aria-pressed={playing}
          disabled={!running}
          onClick={playing ? groove.stop : groove.play}
        >
          <TransportIcon playing={playing} />
          {playing ? 'Stop' : 'Play'}
        </button>
        <label className="field">
          Groove
          <select
            value={grooveId}
            onChange={(e) => {
              groove.setGroove(e.target.value)
              blur(e)
            }}
          >
            {GROOVES.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Key
          <select
            value={tonic}
            onChange={(e) => {
              groove.setTonic(Number(e.target.value))
              blur(e)
            }}
          >
            {Array.from({ length: 12 }, (_, pc) => (
              <option key={pc} value={pc}>
                {keyName({ tonic: pc, mode: g.key.mode })} {g.key.mode}
              </option>
            ))}
          </select>
        </label>
        <label className="tempo">
          <span>Tempo</span>
          <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={bpm}
            onChange={(e) => groove.setBpm(Number(e.target.value))}
          />
          <output>{bpm} BPM</output>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={loop}
            onChange={(e) => groove.setLoop(e.target.checked)}
          />
          Loop
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={countIn}
            onChange={(e) => groove.setCountIn(e.target.checked)}
          />
          Count-in
        </label>
      </div>
      <div className="fields">
        <label className="field">
          Scale
          <select
            value={scale}
            onChange={(e) => {
              groove.setScale(e.target.value as ScaleId)
              blur(e)
            }}
          >
            {scalesOf(g).map((id) => (
              <option key={id} value={id}>
                {SCALE_NAMES[id]}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span id="wheels-label">Training wheels</span>
          <div className="chips" role="radiogroup" aria-labelledby="wheels-label">
            {WHEELS.map(({ level, label }) => (
              <label key={level} className="chip">
                <input
                  type="radio"
                  name="wheels"
                  value={level}
                  checked={level === wheels}
                  onChange={() => groove.setWheels(level)}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <span id="look-label">Look (on trial: pick one)</span>
          <div className="chips" role="radiogroup" aria-labelledby="look-label">
            {LOOK_CHIPS.map((l) => (
              <label key={l.look} className="chip">
                <input
                  type="radio"
                  name="look"
                  value={l.look}
                  checked={l.look === look}
                  onChange={() => view.setLook(l.look)}
                />
                {l.label}
              </label>
            ))}
          </div>
        </div>
      </div>
      <p className="blurb">
        {wheel.text} {wheels > 0 && lookChip.text}
      </p>
      <p className="muted small transport-note">
        {running
          ? `Drums, Round Bass and EP Keys${countIn ? ', after one bar of clicks' : ''}. ${loop ? 'Loops until you stop it' : `Plays its ${g.bars} bars once`}.`
          : 'Turn sound on to play the groove.'}
      </p>
    </section>
  )
}
