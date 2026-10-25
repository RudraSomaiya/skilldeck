import { useEffect, useRef, useState } from 'react'
import { MotionConfig, motion } from 'motion/react'
import { fetchExtras, pruneCache, RateLimited, searchRepos, type Extras, type Repo } from './github'
import { Deck } from './Deck'
import { Star } from './icons'
import { load, persist, type Verdict } from './store'

function explain(e: unknown) {
  return e instanceof RateLimited
    ? `GitHub needs a minute. Try again after ${e.resetAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
    : 'Could not reach GitHub. Check your connection and try again.'
}

export function App() {
  const [state, setState] = useState(load)
  const [repos, setRepos] = useState<Repo[] | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [extras, setExtras] = useState<Record<string, Extras>>({})
  const [history, setHistory] = useState<{ repo: Repo; verdict: Verdict }[]>([])
  const [returning, setReturning] = useState<{ id: string; dir: 1 | -1 } | null>(null)
  const asked = useRef(new Set<string>())
  const { filters, swipes, saved } = state

  useEffect(() => persist(state), [state])
  useEffect(() => pruneCache(), [])

  useEffect(() => {
    let live = true
    setLoading(true)
    setError('')
    searchRepos(filters, page)
      .then(list => {
        if (!live) return
        setRepos(prev => {
          const have = new Set((prev ?? []).map(r => r.id))
          return [...(prev ?? []), ...list.filter(r => !have.has(r.id))]
        })
        if (list.length === 0 || page >= 20) setDone(true) // GitHub search stops at 1,000 results
      }, e => live && setError(explain(e)))
      .finally(() => live && setLoading(false))
    return () => { live = false }
  }, [filters.sort, filters.min, filters.max, page, retry])

  const deck = (repos ?? []).filter(
    r => !swipes[r.id] && extras[r.id]?.skill !== false && !r.topics.some(t => filters.hidden.includes(t)),
  )

  // README art and the spam check for the next five cards.
  useEffect(() => {
    for (const r of deck.slice(0, 5)) {
      if (asked.current.has(r.id)) continue
      asked.current.add(r.id)
      fetchExtras(r.id).then(x => setExtras(m => ({ ...m, [r.id]: x })), () => {})
    }
  })

  // Deal more when the deck runs low.
  useEffect(() => {
    if (repos && !loading && !done && !error && deck.length < 8) setPage(p => p + 1)
  }, [repos, loading, done, error, deck.length])

  function swipe(repo: Repo, verdict: Verdict) {
    setReturning(null)
    setHistory(h => [...h.slice(-29), { repo, verdict }])
    setState(s => ({
      ...s,
      swipes: { ...s.swipes, [repo.id]: verdict },
      saved: verdict === 'save' ? [{ ...repo, savedAt: Date.now() }, ...s.saved.filter(x => x.id !== repo.id)] : s.saved,
    }))
  }

  function undo() {
    const last = history.at(-1)
    if (!last) return
    setHistory(h => h.slice(0, -1))
    setReturning({ id: last.repo.id, dir: last.verdict === 'save' ? 1 : -1 })
    setState(s => {
      const swipes = { ...s.swipes }
      delete swipes[last.repo.id]
      return { ...s, swipes, saved: s.saved.filter(x => x.id !== last.repo.id) }
    })
  }

  const passedAgain = () =>
    setState(s => ({ ...s, swipes: Object.fromEntries(Object.entries(s.swipes).filter(([, v]) => v === 'save')) }))

  return (
    <MotionConfig reducedMotion="user">
      <div className="app">
        <header className="bar">
          <span className="wordmark">Skilldeck</span>
          <motion.span
            key={saved.length}
            className="count"
            initial={{ scale: 1.35 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 12 }}
            aria-label={`${saved.length} saved`}
          >
            <Star /> {saved.length}
          </motion.span>
        </header>
        <main className="stage">
          {error ? (
            <div className="empty">
              <p>{error}</p>
              <button className="pill" onClick={() => setRetry(n => n + 1)}>Try again</button>
            </div>
          ) : !repos ? (
            <p className="hint">Dealing skills from GitHub…</p>
          ) : (
            <Deck cards={deck} extras={extras} returning={returning} canUndo={history.length > 0} onSwipe={swipe} onUndo={undo}>
              {done ? (
                <div className="empty">
                  <p>You have seen every skill that matches.</p>
                  <button className="pill" onClick={passedAgain}>Show passed skills again</button>
                </div>
              ) : (
                <p className="hint">Dealing more skills…</p>
              )}
            </Deck>
          )}
        </main>
      </div>
    </MotionConfig>
  )
}
