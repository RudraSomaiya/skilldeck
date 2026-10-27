import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { cloud, newCode, shareLink, sync } from './cloud'
import { SEEDS, fetchExtras, pruneCache, RateLimited, searchRepos, type Extras, type Filters, type Repo } from './github'
import { Deck, press } from './Deck'
import { FilterSheet } from './Filters'
import { SavedList } from './Saved'
import { Sliders, Star } from './icons'
import { DEFAULT_FILTERS, load, merge, persist, type Verdict } from './store'

function explain(e: unknown) {
  return e instanceof RateLimited
    ? `GitHub needs a minute. Try again after ${e.resetAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
    : 'Could not reach GitHub. Check your connection and try again.'
}

const query = (f: Filters) => `${f.sort}:${f.min}:${f.max}`
const slide = (from: number) => ({ initial: { opacity: 0, x: from }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: from } })

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
  const [view, setView] = useState<'deck' | 'saved'>('deck')
  const [sheet, setSheet] = useState(false)
  const [offline, setOffline] = useState(false)
  const asked = useRef(new Set<string>())
  const latest = useRef(state)
  const syncing = useRef(false)
  const again = useRef(false)
  const { filters, swipes, saved, list, base } = state

  useEffect(() => {
    latest.current = state
    persist(state)
  }, [state])
  useEffect(() => pruneCache(), [])

  // A share link (#list=code) puts this device in that list. Saves made before joining go into it.
  useEffect(() => {
    const code = new URLSearchParams(location.hash.slice(1)).get('list')
    if (!code) return
    window.history.replaceState(null, '', location.pathname + location.search)
    if (cloud && /^[a-z0-9]{16,64}$/i.test(code))
      setState(s => (s.list === code ? s : { ...s, list: code, base: [], saved: s.list ? [] : s.saved }))
  }, [])

  // Sends what changed here and takes everyone else's changes. Changes made while a sync is in
  // flight are merged back on top, and a failed sync leaves them waiting for the next one.
  async function syncNow() {
    const s = latest.current
    if (!cloud || !s.list) return
    if (syncing.current) return void (again.current = true)
    syncing.current = true
    const sent = s.saved.map(x => x.id)
    try {
      const fresh = await sync(s.list, s.saved, s.base)
      setState(cur => (cur.list !== s.list ? cur : { ...cur, saved: merge(fresh, cur.saved, sent).list, base: fresh.map(x => x.id) }))
      setOffline(false)
    } catch {
      setOffline(true)
    } finally {
      syncing.current = false
      if (again.current) {
        again.current = false
        syncNow()
      }
    }
  }

  const dirty = !!list && (saved.length !== base.length || saved.some(x => !base.includes(x.id)))
  useEffect(() => {
    if (!dirty) return
    const t = setTimeout(syncNow, 500)
    return () => clearTimeout(t)
  }, [dirty, saved])

  useEffect(() => {
    syncNow()
    const onShow = () => document.visibilityState === 'visible' && syncNow()
    document.addEventListener('visibilitychange', onShow)
    window.addEventListener('online', onShow)
    return () => {
      document.removeEventListener('visibilitychange', onShow)
      window.removeEventListener('online', onShow)
    }
  }, [list])

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

  // Cards already on the saved list stay out of the deck, including ones a friend saved.
  const savedIds = new Set(saved.map(s => s.id))
  const deck = (repos ?? []).filter(
    r => !swipes[r.id] && !savedIds.has(r.id) && extras[r.id]?.skill !== false && !r.topics.some(t => filters.hidden.includes(t)),
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

  function applyFilters(f: Filters) {
    setSheet(false)
    if (query(f) !== query(filters)) {
      setRepos(null)
      setPage(1)
      setDone(false)
      setHistory([])
    }
    setState(s => ({ ...s, filters: f }))
  }

  const removeSaved = (id: string) =>
    setState(s => ({ ...s, saved: s.saved.filter(x => x.id !== id), swipes: { ...s.swipes, [id]: 'pass' } }))

  const passedAgain = () =>
    setState(s => ({ ...s, swipes: Object.fromEntries(Object.entries(s.swipes).filter(([, v]) => v === 'save')) }))

  // Starts a shared list from this device's saves, or returns the link to the one it's already in.
  function share() {
    const code = list ?? newCode()
    if (!list) setState(s => ({ ...s, list: code, base: [] }))
    return shareLink(code)
  }

  const leave = () => setState(s => ({ ...s, list: null, base: [] }))

  // Filter chips come from the data: topics of everything loaded, plus anything already hidden.
  function topics(): [string, number][] {
    const n = new Map(filters.hidden.map(t => [t, 0]))
    for (const r of repos ?? []) for (const t of r.topics) if (!SEEDS.includes(t)) n.set(t, (n.get(t) ?? 0) + 1)
    const all = [...n].sort((a, b) => b[1] - a[1])
    return [...all.filter(([t]) => filters.hidden.includes(t)), ...all.filter(([t]) => !filters.hidden.includes(t)).slice(0, 36)]
  }

  const tuned = query(filters) !== query(DEFAULT_FILTERS) || filters.hidden.length > 0

  return (
    <MotionConfig reducedMotion="user">
      <div className="app">
        <header className="bar">
          <span className="wordmark">Skilldeck</span>
          <div className="bar-actions">
            {view === 'deck' && (
              <motion.button {...press} className="icon-pill" onClick={() => setSheet(true)} aria-label="Filters">
                <Sliders />
                {tuned && <span className="dot" />}
              </motion.button>
            )}
            <motion.button
              {...press}
              className="count"
              aria-pressed={view === 'saved'}
              aria-label={`Saved skills, ${saved.length}`}
              onClick={() => setView(v => (v === 'deck' ? 'saved' : 'deck'))}
            >
              <Star />
              <motion.span key={saved.length} initial={{ scale: 1.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 12 }}>
                {saved.length}
              </motion.span>
            </motion.button>
          </div>
        </header>
        <main className="stage">
          <AnimatePresence mode="wait" initial={false}>
            {view === 'saved' ? (
              <motion.div key="saved" className="view" {...slide(40)}>
                <SavedList
                  saved={saved}
                  list={list}
                  offline={offline}
                  onShare={share}
                  onLeave={leave}
                  onRemove={removeSaved}
                  onBack={() => setView('deck')}
                />
              </motion.div>
            ) : (
              <motion.div key="deck" className="view" {...slide(-40)}>
                {error ? (
                  <div className="empty">
                    <p>{error}</p>
                    <button className="pill" onClick={() => setRetry(n => n + 1)}>Try again</button>
                  </div>
                ) : !repos ? (
                  <div className="skeleton">
                    <p className="hint">Dealing skills from GitHub…</p>
                  </div>
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
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
      <AnimatePresence>{sheet && <FilterSheet filters={filters} topics={topics()} onDone={applyFilters} />}</AnimatePresence>
    </MotionConfig>
  )
}
