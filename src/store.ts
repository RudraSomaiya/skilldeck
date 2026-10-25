// Device storage for now (Supabase later): swipes, saved cards and filters in one key.
import type { Filters, Repo } from './github'

export type Verdict = 'save' | 'pass'
export type Saved = Repo & { savedAt: number }
export type State = { swipes: Record<string, Verdict>; saved: Saved[]; filters: Filters }

const KEY = 'skilldeck:v1'
export const DEFAULT_FILTERS: Filters = { min: 10, max: null, sort: 'top', hidden: [] }

export function load(): State {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return { swipes: s.swipes ?? {}, saved: s.saved ?? [], filters: { ...DEFAULT_FILTERS, ...s.filters } }
  } catch {
    return { swipes: {}, saved: [], filters: DEFAULT_FILTERS }
  }
}

export function persist(s: State) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode or full: keep going in memory */ }
}
