import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Card, type Exit, type Loadable } from './Card'
import { fetchContents, type Contents, type Extras, type Repo } from './github'
import { Flip, Star, Undo, X } from './icons'
import type { Verdict } from './store'

type Props = {
  cards: Repo[]
  extras: Record<string, Extras>
  returning: { id: string; dir: 1 | -1 } | null
  canUndo: boolean
  onSwipe: (repo: Repo, verdict: Verdict) => void
  onUndo: () => void
  children: ReactNode // shown when the deck is empty
}

export const press = { whileTap: { scale: 0.86 }, transition: { type: 'spring', stiffness: 600, damping: 15 } } as const

export function Deck({ cards, extras, returning, canUndo, onSwipe, onUndo, children }: Props) {
  const exit = useRef<Exit>({ dir: 1, v: 0 })
  const dealt = useRef(false)
  const [flipped, setFlipped] = useState(false)
  const [contents, setContents] = useState<Record<string, Loadable<Contents>>>({})
  const top = cards[0]

  useEffect(() => setFlipped(false), [top?.id])
  useEffect(() => { if (cards.length) dealt.current = true })

  function swipe(dir: 1 | -1, v = dir * 900) {
    if (!top) return
    exit.current = { dir, v }
    navigator.vibrate?.(8)
    onSwipe(top, dir === 1 ? 'save' : 'pass')
  }

  function flip() {
    if (!top) return
    setFlipped(f => !f)
    const id = top.id
    if (contents[id] && contents[id] !== 'error') return
    setContents(c => ({ ...c, [id]: 'loading' }))
    fetchContents(top).then(
      x => setContents(c => ({ ...c, [id]: x })),
      () => setContents(c => ({ ...c, [id]: 'error' })),
    )
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"]')) return
      if (e.target instanceof HTMLElement && e.target.closest('input, select, textarea')) return
      const k = e.key.toLowerCase()
      if (k === 'arrowright') swipe(1)
      else if (k === 'arrowleft') swipe(-1)
      else if (k === 'arrowup' || k === 'arrowdown' || k === 'f') flip()
      else if (k === 'z' || k === 'backspace') onUndo()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <>
      <div className="deck">
        {!top && children}
        <AnimatePresence custom={exit.current}>
          {cards
            .slice(0, 3)
            .map((r, depth) => (
              <Card
                key={r.id}
                repo={r}
                extras={extras[r.id]}
                contents={contents[r.id]}
                depth={depth}
                enter={!dealt.current ? 'deal' : returning?.id === r.id ? (returning.dir === 1 ? 'right' : 'left') : 'stack'}
                flipped={depth === 0 && flipped}
                onSwipe={swipe}
                onFlip={flip}
              />
            ))
            .reverse()}
        </AnimatePresence>
      </div>
      <div className="actions">
        <motion.button {...press} className="act small" onClick={onUndo} disabled={!canUndo} aria-label="Undo last swipe">
          <Undo />
        </motion.button>
        <motion.button {...press} className="act nope" onClick={() => swipe(-1)} disabled={!top} aria-label="Pass">
          <X />
        </motion.button>
        <motion.button {...press} className="act keep" onClick={() => swipe(1)} disabled={!top} aria-label="Save">
          <Star size={30} />
        </motion.button>
        <motion.button
          {...press}
          className="act small"
          onClick={flip}
          disabled={!top}
          aria-pressed={flipped}
          aria-label={flipped ? 'Show the front' : 'Show the skills inside'}
        >
          <Flip />
        </motion.button>
      </div>
      <p className="keys" aria-hidden="true">
        <span><kbd>←</kbd>Pass</span>
        <span><kbd>→</kbd>Save</span>
        <span><kbd>↑</kbd>Flip</span>
        <span><kbd>Z</kbd>Undo</span>
      </p>
    </>
  )
}
