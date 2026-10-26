import { AnimatePresence, motion } from 'motion/react'
import { formatStars, rarity } from './github'
import { Star, X } from './icons'
import type { Saved } from './store'

type Props = { saved: Saved[]; onRemove: (id: string) => void; onBack: () => void }

// The export is also what a later Supabase migration imports.
function exportSaved(saved: Saved[]) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(saved, null, 2)], { type: 'application/json' }))
  a.download = `skilldeck-saved-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function SavedList({ saved, onRemove, onBack }: Props) {
  return (
    <section className="saved" aria-labelledby="saved-title">
      <div className="saved-head">
        <h1 id="saved-title">Saved skills</h1>
        {saved.length > 0 && <button className="pill" onClick={() => exportSaved(saved)}>Export</button>}
      </div>
      {saved.length === 0 ? (
        <div className="empty">
          <p>Nothing saved yet.</p>
          <span className="hint">Swipe right on a skill you want to keep.</span>
          <button className="pill" onClick={onBack}>Back to the deck</button>
        </div>
      ) : (
        <ul className="saved-list">
          <AnimatePresence initial={false}>
            {saved.map((s, i) => (
              <motion.li
                key={s.id}
                layout
                className={`row ${rarity(s.stars)}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 8) * 0.03 } }}
                exit={{ opacity: 0, x: -60, transition: { duration: 0.18 } }}
              >
                <img src={`${s.avatar}&s=80`} alt="" width={40} height={40} />
                <div>
                  <a className="row-name" href={s.url} target="_blank" rel="noreferrer">{s.name}</a>
                  <span className="row-owner">{s.owner}</span>
                  {s.description && <p className="row-desc">{s.description}</p>}
                </div>
                <div className="row-side">
                  <span className="stars"><Star />{formatStars(s.stars)}</span>
                  <button className="icon-btn" aria-label={`Remove ${s.name}`} onClick={() => onRemove(s.id)}>
                    <X size={18} />
                  </button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  )
}
