import { useEffect, useRef, useState } from 'react'
import { fetchExtras, pruneCache, RateLimited, searchRepos, type Extras, type Filters, type Repo } from './github'
import { Card } from './Card'

const FILTERS: Filters = { min: 10, max: null, sort: 'top', hidden: [] }

export function explain(e: unknown) {
  return e instanceof RateLimited
    ? `GitHub needs a minute. Try again after ${e.resetAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
    : 'Could not reach GitHub. Check your connection and try again.'
}

export function App() {
  const [repos, setRepos] = useState<Repo[] | null>(null)
  const [error, setError] = useState('')
  const [extras, setExtras] = useState<Record<string, Extras>>({})
  const asked = useRef(new Set<string>())

  useEffect(() => {
    pruneCache()
    searchRepos(FILTERS, 1).then(setRepos, e => setError(explain(e)))
  }, [])

  // Spam guard: drop cards whose README never mentions a skill.
  const deck = (repos ?? []).filter(r => extras[r.id]?.skill !== false)

  useEffect(() => {
    for (const r of deck.slice(0, 5)) {
      if (asked.current.has(r.id)) continue
      asked.current.add(r.id)
      fetchExtras(r.id).then(x => setExtras(m => ({ ...m, [r.id]: x })), () => {})
    }
  })

  return (
    <div className="app">
      <header className="bar">
        <span className="wordmark">Skilldeck</span>
      </header>
      <main className="stage">
        {error ? (
          <p className="hint">{error}</p>
        ) : !repos ? (
          <p className="hint">Dealing skills from GitHub…</p>
        ) : (
          <div className="deck">
            {deck.slice(0, 3).reverse().map((r, i, top) => (
              <Card key={r.id} repo={r} extras={extras[r.id]} depth={top.length - 1 - i} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
