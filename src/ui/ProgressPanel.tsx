import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { Item } from '../practice/items.ts'
import {
  dayStart,
  daysRunning,
  heatmap,
  KEYS,
  practiceDays,
  type Level,
} from '../practice/progress.ts'
import { watchProgress } from '../storage/db.ts'

const DAYS = 14

const TRACKS: Record<string, string> = {
  scales: 'Soloing scales',
  triads: 'Triads',
  sevenths: '7th chords',
}

const LEVELS: { level: Level; word: string }[] = [
  { level: 'cold', word: 'Known cold' },
  { level: 'shaky', word: 'Shaky' },
  { level: 'new', word: 'New' },
  { level: 'locked', word: 'Not open yet' },
]
const WORD = Object.fromEntries(LEVELS.map((l) => [l.level, l.word])) as Record<Level, string>

const pretty = (k: string) => k.replace('b', '♭').replace('#', '♯')

const check = (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
  </svg>
)

const Mark = ({ level, fill }: { level: Level; fill: number }) => (
  <span className="mark" data-level={level} style={{ '--fill': fill } as CSSProperties}>
    {level === 'cold' && check}
  </span>
)

/**
 * Progress (P2-T7): which chords and scales you know cold in which keys, and which recent days
 * you practised. Re-reads the database after each write (watchProgress), never per note.
 */
export function ProgressPanel() {
  const [items, setItems] = useState<Item[]>([])
  const [times, setTimes] = useState<Date[]>([])
  // shortcut: the 14-day window is fixed at mount, so a tab left open past midnight shows
  // yesterday's window until a reload; recompute on visibility change if that's ever noticed.
  const [now] = useState(() => new Date())

  useEffect(
    () =>
      watchProgress(dayStart(now, DAYS - 1), (p) => {
        setItems(p.items)
        setTimes(p.times)
      }),
    [now],
  )

  const groups = useMemo(() => heatmap(items), [items])
  const days = useMemo(() => practiceDays(times, now, DAYS), [times, now])
  const counts = useMemo(() => {
    const c: Record<Level, number> = { cold: 0, shaky: 0, new: 0, locked: 0 }
    for (const g of groups)
      for (const r of g.rows) for (const cell of r.cells) if (cell) c[cell.level]++
    return c
  }, [groups])

  const practised = days.filter(Boolean).length
  const run = daysRunning(days)

  return (
    <section className="card progress" aria-labelledby="progress-tab" data-testid="progress">
      <h2 className="tab" id="progress-tab">
        Progress
      </h2>

      <div className="progress-days">
        <p data-testid="progress-days">
          {practised === 0
            ? 'Your practice days show here.'
            : `You practised on ${practised} of the last ${DAYS} days${run > 1 ? `, ${run} days in a row` : ''}.`}
        </p>
        <ol className="days" aria-label={`The last ${DAYS} days`}>
          {days.map((on, i) => {
            const d = dayStart(now, DAYS - 1 - i)
            const name = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
            return (
              <li key={i} data-on={on} title={name}>
                <span className="visually-hidden">
                  {name}: {on ? 'practised' : 'no practice'}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="progress-key">
        <ul className="legend">
          {LEVELS.map(({ level, word }) => (
            <li key={level}>
              <Mark level={level} fill={level === 'shaky' ? 0.5 : level === 'cold' ? 1 : 0} />
              {word} <span className="count">{counts[level]}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="heatmap-scroll">
        <table className="heatmap">
          <thead>
            <tr>
              <td />
              {KEYS.map((k) => (
                <th key={k} scope="col">
                  {pretty(k)}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.track}>
              <tr>
                <th scope="rowgroup" colSpan={KEYS.length + 1} className="group">
                  {TRACKS[g.track] ?? g.track}
                </th>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  {r.cells.map((cell, k) => (
                    <td key={k} data-item={cell?.item}>
                      {cell && (
                        <>
                          <Mark level={cell.level} fill={cell.fill} />
                          <span className="visually-hidden">{WORD[cell.level]}</span>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  )
}
