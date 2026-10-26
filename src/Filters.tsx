import { useEffect, useState, type CSSProperties } from 'react'
import { motion } from 'motion/react'
import { formatStars, type Filters, type Sort } from './github'

// Log-ish star steps; null = no upper limit.
const STEPS: (number | null)[] = [0, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, null]
const LAST = STEPS.length - 1
const at = (v: number | null) => Math.max(0, STEPS.indexOf(v))
const say = (v: number | null) => (v == null ? 'any' : formatStars(v))

const SORTS: { id: Sort; label: string; hint: string }[] = [
  { id: 'top', label: 'Top', hint: 'Most stars first.' },
  { id: 'fresh', label: 'Fresh', hint: 'Recently updated first.' },
  { id: 'new', label: 'New', hint: 'Created in the last 30 days, most stars first.' },
]

type Props = { filters: Filters; topics: [string, number][]; onDone: (f: Filters) => void }

export function FilterSheet({ filters, topics, onDone }: Props) {
  const [f, setF] = useState(filters)
  const lo = at(f.min)
  const hi = at(f.max)
  const done = () => onDone(f)
  const toggle = (t: string) =>
    setF(x => ({ ...x, hidden: x.hidden.includes(t) ? x.hidden.filter(h => h !== t) : [...x.hidden, t] }))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onDone(f)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <motion.div className="scrim" onClick={done} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="filters-title"
        onClick={e => e.stopPropagation()}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      >
        <div className="sheet-head">
          <h2 id="filters-title">Filters</h2>
          <button className="pill gold" onClick={done} autoFocus>Show skills</button>
        </div>

        <fieldset className="field">
          <legend className="legend">Order</legend>
          <div className="segments">
            {SORTS.map(s => (
              <label key={s.id} className="segment">
                <input type="radio" name="sort" checked={f.sort === s.id} onChange={() => setF(x => ({ ...x, sort: s.id }))} />
                <span>{s.label}</span>
              </label>
            ))}
          </div>
          <p className="field-hint">{SORTS.find(s => s.id === f.sort)?.hint}</p>
        </fieldset>

        <div className="field">
          <div className="field-row">
            <span className="legend">Stars</span>
            <span className="value">{say(f.min)} to {say(f.max)}</span>
          </div>
          <div className="range" style={{ '--a': lo / LAST, '--b': hi / LAST } as CSSProperties}>
            <div className="track" />
            <div className="fill" />
            <input
              type="range"
              min={0}
              max={LAST}
              value={lo}
              aria-label="Minimum stars"
              aria-valuetext={`${say(f.min)} stars`}
              onChange={e => setF(x => ({ ...x, min: STEPS[Math.min(+e.target.value, hi - 1)] ?? 0 }))}
            />
            <input
              type="range"
              min={0}
              max={LAST}
              value={hi}
              aria-label="Maximum stars"
              aria-valuetext={f.max == null ? 'no limit' : `${say(f.max)} stars`}
              onChange={e => setF(x => ({ ...x, max: STEPS[Math.max(+e.target.value, lo + 1)] ?? null }))}
            />
          </div>
          <p className="field-hint">Under 10 stars usually means nobody has tried it yet. Slide down to catch brand-new skills.</p>
        </div>

        <div className="field">
          <div className="field-row">
            <span className="legend">Hide topics</span>
            {f.hidden.length > 0 && <button className="link" onClick={() => setF(x => ({ ...x, hidden: [] }))}>Show all</button>}
          </div>
          <div className="chips">
            {topics.map(([t, n]) => (
              <button key={t} className="chip" aria-pressed={f.hidden.includes(t)} onClick={() => toggle(t)}>
                {t}
                {n > 0 && <small>{n}</small>}
              </button>
            ))}
          </div>
          <p className="field-hint">Built from the topics of the skills loaded so far.</p>
        </div>
      </motion.section>
    </motion.div>
  )
}
