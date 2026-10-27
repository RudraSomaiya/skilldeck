import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cloud } from './cloud'
import { formatStars, rarity } from './github'
import { Star, X } from './icons'
import type { Saved } from './store'

type Props = {
  saved: Saved[]
  list: string | null
  offline: boolean
  onShare: () => string
  onLeave: () => void
  onRemove: (id: string) => void
  onBack: () => void
}

function exportSaved(saved: Saved[]) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(saved, null, 2)], { type: 'application/json' }))
  a.download = `skilldeck-saved-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// Phones get the share sheet, everything else copies the link. Returns true when it was copied.
async function send(link: string) {
  if ('share' in navigator && matchMedia('(pointer: coarse)').matches) {
    await navigator.share({ title: 'Skilldeck', url: link }).catch(() => {})
    return false
  }
  try {
    await navigator.clipboard.writeText(link)
    return true
  } catch {
    prompt('Copy this link', link) // no clipboard outside https
    return false
  }
}

export function SavedList({ saved, list, offline, onShare, onLeave, onRemove, onBack }: Props) {
  const [copied, setCopied] = useState(false)

  async function share() {
    if (!(await send(onShare()))) return
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function leave() {
    if (confirm('Leave the shared list on this device? You keep a copy of the saves, and the link brings you back.')) onLeave()
  }

  return (
    <section className="saved" aria-labelledby="saved-title">
      <div className="saved-head">
        <h1 id="saved-title">Saved skills</h1>
        <div className="saved-actions">
          {saved.length > 0 && <button className="pill ghost" onClick={() => exportSaved(saved)}>Export</button>}
          {cloud && <button className="pill" onClick={share}>{copied ? 'Copied' : 'Share'}</button>}
        </div>
      </div>
      {list && (
        <p className="list-note" role="status">
          {offline ? "Can't reach the shared list. Your changes will sync when you're back online." : 'Shared list. Anyone with the link can add and remove skills.'}{' '}
          <button className="link" onClick={leave}>Leave</button>
        </p>
      )}
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
