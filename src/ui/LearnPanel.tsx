import { useEffect, useMemo } from 'react'
import { pretty } from '../music/spelling.ts'
import { drillOf, qualityWord, SCALE_BPM } from '../practice/drills.ts'
import { idRoot, LIBRARY, libraryEntry, ROOTS, type Pick } from '../practice/library.ts'
import { drills } from '../state/drills.ts'
import { useAudioStore } from '../state/audio.ts'
import { library, useLibraryStore } from '../state/library.ts'

const INVERSIONS = ['Root', '1st', '2nd', '3rd']
const word = (type: Pick['type'], q: string) => {
  const w = qualityWord(type, q)!
  return w[0]!.toUpperCase() + w.slice(1)
}

/**
 * The chord and scale library (P2-T10): pick a root and a chord or scale, see it on the pinned
 * keyboard (names over degrees) with each inversion, its formula and its key's chords, hear it,
 * and drill it. Renders on a pick, never per note.
 */
export function LearnPanel() {
  const pick = useLibraryStore((s) => s.pick)
  const setPick = (p: Pick) => useLibraryStore.setState({ pick: p })
  const { split, splitNote } = useAudioStore((s) => s.layout)
  const entry = useMemo(() => {
    const e = libraryEntry(pick)
    // up by octaves above the split, so the main sound plays it and the bass zone stays clear
    // shortcut: a split above about C6 lifts a scale's top past the keyboard; clamp if anyone does that
    const lift = split ? 12 * Math.max(0, Math.ceil((splitNote - e.tones[0]!.note) / 12)) : 0
    return {
      ...e,
      tones: e.tones.map((t) => ({ ...t, note: t.note + lift })),
      hear: e.hear.map((x) => ('note' in x ? { ...x, note: x.note + lift } : x)),
    }
  }, [pick, split, splitNote])
  const hearing = useLibraryStore((s) => s.hearing)
  const set = (patch: Partial<Pick>) => setPick({ ...pick, ...patch })

  useEffect(() => {
    library.stop()
    useLibraryStore.setState({
      marks: new Map(entry.tones.map((t) => [t.note, `${t.name}\n${t.degree}`])),
    })
  }, [entry])
  useEffect(
    () => () => {
      library.stop()
      useLibraryStore.setState({ marks: null })
    },
    [],
  )

  return (
    <section className="card learn" aria-labelledby="learn-tab" data-testid="learn">
      <h2 className="tab" id="learn-tab">
        Learn
      </h2>
      <div className="learn-pick">
        <div className="chips learn-roots" role="radiogroup" aria-label="Root">
          {ROOTS.map((r) => (
            <label key={r} className="chip">
              <input
                type="radio"
                name="learn-root"
                checked={idRoot(pick.root) === r}
                onChange={() => set({ root: r })}
              />
              {pretty(r)}
            </label>
          ))}
        </div>
        <label className="field">
          Chord or scale
          <select
            value={`${pick.type}:${pick.quality}`}
            onChange={(e) => {
              const [type, quality] = e.target.value.split(':') as [Pick['type'], string]
              set({ type, quality, inversion: 0 })
            }}
          >
            {LIBRARY.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.qualities.map((q) => (
                  <option key={q} value={`${g.type}:${q}`}>
                    {word(g.type, q)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {entry.inversions > 0 && (
          <div className="chips" role="radiogroup" aria-label="Inversion">
            {INVERSIONS.slice(0, entry.inversions).map((label, i) => (
              <label key={label} className="chip">
                <input
                  type="radio"
                  name="learn-inversion"
                  checked={pick.inversion === i}
                  onChange={() => set({ inversion: i })}
                />
                {label}
              </label>
            ))}
          </div>
        )}
        <div className="learn-key">
          <span className="muted">In {entry.key.name}</span>
          <ul className="chips">
            {entry.key.chords.map((c) => {
              const on =
                pick.type === 'chord' &&
                idRoot(pick.root) === idRoot(c.pick.root) &&
                pick.quality === c.pick.quality
              return (
                <li key={c.numeral}>
                  <button
                    type="button"
                    className="chip"
                    aria-pressed={on}
                    onClick={() => setPick(c.pick)}
                  >
                    {c.numeral} <span className="learn-symbol">{c.symbol}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
      <div className="learn-shown">
        <p className="learn-title" data-testid="learn-title">
          {entry.title}
        </p>
        <p className="learn-formula">{entry.formula}</p>
        <ul className="learn-tones" aria-label="Notes, low to high">
          {entry.tones.map((t, i) => (
            <li key={i} data-note={t.note}>
              <strong>{t.name}</strong> {t.degree}
            </li>
          ))}
        </ul>
        <div className="actions">
          <button
            type="button"
            onClick={() => (hearing ? library.stop() : library.hear(entry.hear))}
          >
            {hearing ? 'Stop' : 'Hear it'}
          </button>
          <button
            type="button"
            onClick={() => {
              drills.start(drillOf(entry.item, { bpm: SCALE_BPM }))
              location.hash = '#/practice'
            }}
          >
            Drill this
          </button>
        </div>
      </div>
    </section>
  )
}
