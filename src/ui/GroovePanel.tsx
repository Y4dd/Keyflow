import { Fragment, type ChangeEvent } from 'react'
import { MAX_LEVEL_DB, MIN_LEVEL_DB, type Channel } from '../audio/mixer.ts'
import type { PresetId } from '../audio/presets/types.ts'
import { audio, useAudioStore } from '../state/audio.ts'
import { GROOVES } from '../grooves/library.ts'
import type { ScaleId } from '../music/harmony.ts'
import type { Wheels } from '../music/highlight.ts'
import { keyName } from '../music/spelling.ts'
import { groove, grooveOf, scalesOf, tempoRange, useGrooveStore } from '../state/groove.ts'
import { takes, useTakesStore } from '../state/takes.ts'
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

const LOOK_CHIPS: { look: Look; label: string; text: string }[] = [
  {
    look: 'tags',
    label: 'Tags',
    text: 'A tag on each chord tone; the other scale tones get their name or a small dash.',
  },
  {
    look: 'spotlight',
    label: 'Spotlight',
    text: 'No marks, only light: chord tones brightest, the other scale tones dimmer, the rest darkest.',
  },
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

/** A filled dot: record (no red: the dot is the shape, bone like the other icons). */
function RecordIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" fill="currentColor" />
    </svg>
  )
}

// The groove's bass and chords keep their sounds' colours on their sliders (One Colour Per Sound),
// Round Bass (GROOVE_BASS) and EP Keys, as the transport note names them.
const MIX_ROWS: { channel: Channel; label: string; sound?: PresetId }[] = [
  { channel: 'drums', label: 'Drums' },
  { channel: 'bass', label: 'Bass', sound: 'round-bass' },
  { channel: 'chords', label: 'Chords', sound: 'ep-keys' },
  { channel: 'you', label: 'Your synth' },
]

const signedDb = (db: number) => `${db > 0 ? '+' : db < 0 ? '−' : ''}${Math.abs(db)} dB`

/** Levels and mutes for the groove's parts and your synth, and "you play bass" (P1-T6). */
function Mix() {
  const { channels, youPlayBass } = useAudioStore((s) => s.mixer)
  const split = useAudioStore((s) => s.layout.split)
  const bassYours = youPlayBass && split
  return (
    <div className="mix" role="group" aria-labelledby="mix-label">
      <span id="mix-label" className="mix-label">
        Mix
      </span>
      <div className="knobs mix-rows">
        {MIX_ROWS.map(({ channel, label, sound }) => {
          const { db, muted } = channels[channel]
          const silent = muted || (channel === 'bass' && bassYours)
          return (
            <Fragment key={channel}>
              <label className="knob" data-sound={sound}>
                <span>{label}</span>
                <input
                  type="range"
                  min={MIN_LEVEL_DB}
                  max={MAX_LEVEL_DB}
                  step={1}
                  value={db}
                  onChange={(e) => audio.setChannel(channel, { db: Number(e.target.value) })}
                />
                <output className={silent ? 'muted' : undefined}>
                  {silent ? (muted ? 'Muted' : 'Yours') : signedDb(db)}
                </output>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  aria-label={`Mute ${label.toLowerCase()}`}
                  checked={muted}
                  onChange={(e) => audio.setChannel(channel, { muted: e.target.checked })}
                />
                Mute
              </label>
            </Fragment>
          )
        })}
      </div>
      <label className="check mix-bass">
        <input
          type="checkbox"
          checked={youPlayBass}
          onChange={(e) => audio.setYouPlayBass(e.target.checked)}
        />
        <span>
          You play bass{' '}
          <span className="muted small">
            {split
              ? '(mutes the groove’s bass while the split is on, so your left hand is the bass)'
              : '(mutes the groove’s bass once you turn on Split in the Play card)'}
          </span>
        </span>
      </label>
    </div>
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
  const recording = useTakesStore((s) => s.recording)
  const replaying = useTakesStore((s) => s.replaying !== null)
  // A take keeps one groove, key and tempo (src/analysis/take.ts), and a replay plays the take's.
  const locked = recording || replaying

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
        <button
          type="button"
          className="transport-play"
          aria-pressed={recording}
          disabled={!running || replaying}
          onClick={recording ? groove.stop : takes.record}
        >
          <RecordIcon />
          {recording ? 'Save take' : 'Record'}
        </button>
        <label className="field">
          Groove
          <select
            value={grooveId}
            disabled={locked}
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
            disabled={locked}
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
            disabled={locked}
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
          <span id="look-label">Look</span>
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
        {recording
          ? 'Recording: play over the groove, then Save take (or Stop) to keep it. The groove, key and tempo stay as they are until then.'
          : replaying
            ? 'Replaying a take over its groove, key and tempo. Stop ends it.'
            : running
              ? `Drums, Round Bass and EP Keys${countIn ? ', after one bar of clicks' : ''}. ${loop ? 'Loops until you stop it' : `Plays its ${g.bars} bars once`}.`
              : 'Turn sound on to play the groove.'}
      </p>
      <Mix />
    </section>
  )
}
