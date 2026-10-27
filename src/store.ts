// Swipes, saved cards and filters on this device. In a shared list, `saved` is this device's copy
// and `base` holds the ids the list had at the last sync, so changes made offline still go up later.
import type { Filters, Repo } from './github'

export type Verdict = 'save' | 'pass'
export type Saved = Repo & { savedAt: number }
export type State = {
  swipes: Record<string, Verdict>
  saved: Saved[]
  filters: Filters
  list: string | null
  base: string[]
}

const KEY = 'skilldeck:v1'
export const DEFAULT_FILTERS: Filters = { min: 10, max: null, sort: 'top', hidden: [] }

export function load(): State {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return {
      swipes: s.swipes ?? {},
      saved: s.saved ?? [],
      filters: { ...DEFAULT_FILTERS, ...s.filters },
      list: s.list ?? null,
      base: s.base ?? [],
    }
  } catch {
    return { swipes: {}, saved: [], filters: DEFAULT_FILTERS, list: null, base: [] }
  }
}

export function persist(s: State) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode or full: keep going in memory */ }
}

// Three-way merge: what changed here since `base` wins, and everything else comes from the list.
export function merge(remote: Saved[], local: Saved[], base: string[]) {
  const had = new Set(base)
  const here = new Set(local.map(s => s.id))
  const added = local.filter(s => !had.has(s.id))
  const removed = base.filter(id => !here.has(id))
  const mine = new Set([...added.map(s => s.id), ...removed])
  return { list: [...added, ...remote.filter(s => !mine.has(s.id))], added, removed }
}
