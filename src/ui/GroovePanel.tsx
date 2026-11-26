import type { ChangeEvent } from 'react'
import { useAudioStore } from '../state/audio.ts'
import { GROOVES } from '../grooves/library.ts'
import { groove, grooveOf, tempoRange, useGrooveStore } from '../state/groove.ts'

// Key names as their key signatures spell them (the fewest accidentals for the mode).
// shortcut: fixed spellings; the flats-or-sharps question is open in the Phase 1 file.
const KEY_NAMES = {
  major: ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'],
  minor: ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'],
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

/** The groove transport: play and stop, which groove, key, tempo, loop and count-in. */
export function GroovePanel() {
  const { grooveId, tonic, bpm, loop, countIn, playing } = useGrooveStore()
  const running = useAudioStore((s) => s.status === 'running')
  const g = grooveOf(grooveId)
  const [min, max] = tempoRange(g)
  const names = KEY_NAMES[g.key.mode]

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
            {names.map((n, pc) => (
              <option key={n} value={pc}>
                {n} {g.key.mode}
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
      <p className="muted small transport-note">
        {running
          ? `Drums, Wobble Bass and EP Keys${countIn ? ', after one bar of clicks' : ''}. ${loop ? 'Loops until you stop it' : `Plays its ${g.bars} bars once`}.`
          : 'Turn sound on to play the groove.'}
      </p>
    </section>
  )
}
