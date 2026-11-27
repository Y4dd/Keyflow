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

// "Help on the keys": the training-wheels level and the highlighting look (both saved as before)
// in one menu. Chord tones only and Off keep whichever look was chosen last.
const HELP: { wheels: Wheels; look?: Look; label: string; text: string }[] = [
  {
    wheels: 3,
    look: 'tags',
    label: 'Tags with names',
    text: 'A named tag on each chord tone, names on the other scale tones, the other keys dimmed.',
  },
  {
    wheels: 2,
    look: 'tags',
    label: 'Tags',
    text: 'A tag on each chord tone, a small dash on the other scale tones, the other keys dimmed.',
  },
  {
    wheels: 3,
    look: 'spotlight',
    label: 'Spotlight with names',
    text: 'Chord tones brightest, the other scale tones dimmer, the rest darkest, with names.',
  },
  {
    wheels: 2,
    look: 'spotlight',
    label: 'Spotlight',
    text: 'No marks, only light: chord tones brightest, the other scale tones dimmer, the rest darkest.',
  },
  { wheels: 1, label: 'Chord tones only', text: 'Only the chord tones marked.' },
  { wheels: 0, label: 'Off', text: 'No help on the keys: play by ear.' },
]
const helpValue = (wheels: Wheels, look?: Look) => (wheels >= 2 ? `${wheels} ${look}` : `${wheels}`)

function useHelp() {
  const wheels = useGrooveStore((s) => s.wheels)
  const look = useViewStore((s) => s.look)
  const value = helpValue(wheels, look)
  return { value, help: HELP.find((h) => helpValue(h.wheels, h.look) === value)! }
}

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

/** The top bar's small stop button: shown while a groove (or a replay) plays, in every view. */
export function StopGroove() {
  const playing = useGrooveStore((s) => s.playing)
  if (!playing) return null
  return (
    <button type="button" className="stop-groove" onClick={groove.stop}>
      <TransportIcon playing />
      Stop groove
    </button>
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
export function Mix() {
  const { channels, youPlayBass } = useAudioStore((s) => s.mixer)
  const split = useAudioStore((s) => s.layout.split)
  const bassYours = youPlayBass && split
  return (
    <div className="mix" data-testid="mix">
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
              : '(mutes the groove’s bass once you turn on Split keyboard in Setup)'}
          </span>
        </span>
      </label>
    </div>
  )
}

/** Jam's two lines of guidance: what the help on the keys shows, and what the transport does. */
export function GrooveNote() {
  const { grooveId, loop, countIn } = useGrooveStore()
  const running = useAudioStore((s) => s.status === 'running')
  const recording = useTakesStore((s) => s.recording)
  const replaying = useTakesStore((s) => s.replaying !== null)
  const g = grooveOf(grooveId)
  const { help } = useHelp()
  return (
    <>
      <p className="blurb">{help.text}</p>
      <p className="muted small transport-note">
        {recording
          ? 'Recording: play over the groove, then Save take (or Stop) to keep it. The groove, key and tempo stay as they are until then.'
          : replaying
            ? 'Replaying a take over its groove, key and tempo. Stop ends it.'
            : running
              ? `${g.name}: drums, Round Bass and EP Keys${countIn ? ', after one bar of clicks' : ''}. ${loop ? 'Loops until you stop it' : `Plays its ${g.bars} bars once`}.`
              : 'Turn sound on to play the groove.'}
      </p>
    </>
  )
}

/** Jam's transport strip, over the keys: play and record, groove, key, tempo, scale, help. */
export function Transport() {
  const { grooveId, tonic, bpm, loop, countIn, playing, scale } = useGrooveStore()
  const running = useAudioStore((s) => s.status === 'running')
  const g = grooveOf(grooveId)
  const [min, max] = tempoRange(g)
  const { value: helpNow } = useHelp()
  const recording = useTakesStore((s) => s.recording)
  const replaying = useTakesStore((s) => s.replaying !== null)
  // A take keeps one groove, key and tempo (src/analysis/take.ts), and a replay plays the take's.
  const locked = recording || replaying

  return (
    <div className="transport" role="group" aria-label="Groove" data-testid="groove">
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
        className="transport-record"
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
      <label className="field">
        Help on the keys
        <select
          value={helpNow}
          onChange={(e) => {
            const h = HELP.find((x) => helpValue(x.wheels, x.look) === e.target.value)!
            groove.setWheels(h.wheels)
            if (h.look) view.setLook(h.look)
            blur(e)
          }}
        >
          {HELP.map((h) => (
            <option key={h.label} value={helpValue(h.wheels, h.look)}>
              {h.label}
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={loop} onChange={(e) => groove.setLoop(e.target.checked)} />
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
  )
}
