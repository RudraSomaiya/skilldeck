// Live GitHub data, straight from the browser with no token, so calls stay few:
// search (10/min) for the deck, raw README (no API quota) for art, git tree only on flip.

export type Repo = {
  id: string
  name: string
  owner: string
  avatar: string
  url: string
  description: string
  stars: number
  language: string | null
  topics: string[]
  createdAt: string
  pushedAt: string
}
export type Sort = 'top' | 'fresh' | 'new'
export type Filters = { min: number; max: number | null; sort: Sort; hidden: string[] }
export type Extras = { images: string[]; skill: boolean; blurb: string }
export type Contents = { skills: string[]; hasScripts: boolean }
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

export const SEEDS = ['claude-skills', 'agent-skills', 'claude-skill', 'claude-code-skills']
const API = 'https://api.github.com'
const RAW = 'https://raw.githubusercontent.com'
const DAY = 864e5

export class RateLimited extends Error {
  resetAt: Date
  constructor(resetAt: Date) {
    super('GitHub rate limit')
    this.resetAt = resetAt
  }
}

export function buildQuery(seed: string, f: Filters, now = Date.now()): string {
  const stars = f.max == null ? `stars:>=${f.min}` : `stars:${f.min}..${f.max}`
  const created = f.sort === 'new' ? ` created:>=${new Date(now - 30 * DAY).toISOString().slice(0, 10)}` : ''
  return `topic:${seed} ${stars}${created}`
}

type GhRepo = {
  full_name: string
  name: string
  html_url: string
  description: string | null
  owner: { login: string; avatar_url: string }
  stargazers_count: number
  language: string | null
  topics?: string[]
  created_at: string
  pushed_at: string
}

const toRepo = (r: GhRepo): Repo => ({
  id: r.full_name,
  name: r.name,
  owner: r.owner.login,
  avatar: r.owner.avatar_url,
  url: r.html_url,
  description: r.description ?? '',
  stars: r.stargazers_count,
  language: r.language,
  topics: r.topics ?? [],
  createdAt: r.created_at,
  pushedAt: r.pushed_at,
})

export function mergeRepos(lists: Repo[][], sort: Sort): Repo[] {
  const repos = [...new Map(lists.flat().map(r => [r.id, r])).values()]
  return sort === 'fresh'
    ? repos.sort((a, b) => b.pushedAt.localeCompare(a.pushedAt))
    : repos.sort((a, b) => b.stars - a.stars)
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
  const retry = r.headers.get('retry-after')
  if (r.status === 429 || (r.status === 403 && (retry || r.headers.get('x-ratelimit-remaining') === '0'))) {
    const reset = Number(r.headers.get('x-ratelimit-reset')) * 1000 || Date.now() + Number(retry ?? 60) * 1000
    throw new RateLimited(new Date(reset))
  }
  if (!r.ok) throw new Error(`GitHub answered ${r.status}`)
  return r.json()
}

// localStorage cache with a TTL; pruneCache() clears stale entries on start.
const pending = new Map<string, Promise<unknown>>()
function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  try {
    const hit = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (hit && Date.now() - hit.t < ttl) return Promise.resolve(hit.v)
  } catch { /* no storage: go live */ }
  if (!pending.has(key)) {
    const p = load().then(v => {
      try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v })) } catch { /* full or blocked */ }
      return v
    })
    pending.set(key, p.finally(() => pending.delete(key)))
  }
  return pending.get(key) as Promise<T>
}

export function pruneCache(maxAge = DAY) {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('gh:') && Date.now() - (JSON.parse(localStorage.getItem(k) ?? '{}').t ?? 0) > maxAge) localStorage.removeItem(k)
    }
  } catch { /* nothing to prune */ }
}

export function searchRepos(f: Filters, page: number): Promise<Repo[]> {
  const sort = f.sort === 'fresh' ? 'updated' : 'stars'
  return cached(`gh:search:${f.sort}:${f.min}:${f.max}:${page}`, 30 * 60e3, async () => {
    const lists = await Promise.all(SEEDS.map(async seed => {
      const q = encodeURIComponent(buildQuery(seed, f))
      const j = await getJson<{ items: GhRepo[] }>(`${API}/search/repositories?q=${q}&sort=${sort}&order=desc&per_page=50&page=${page}`)
      return j.items.map(toRepo)
    }))
    return mergeRepos(lists, f.sort)
  })
}

const BADGE = /shields\.io|badge|skills\.sh\/b\/|star-history|contrib\.rocks|visitor|komarev|trendshift|producthunt|buymeacoffee|ko-fi\.com/i

// First few README images that aren't known badges; the card skips any that load badge-sized.
export function pickImages(md: string, id: string, max = 3): string[] {
  const out: string[] = []
  for (const m of md.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)|<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)/gi)) {
    const src = (m[1] ?? m[2]).trim()
    if (BADGE.test(src) || /^(data:|#|mailto:)/i.test(src)) continue
    out.push(/^https?:\/\//i.test(src)
      ? src.replace(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/blob\//, `${RAW}/$1/`)
      : `${RAW}/${id}/HEAD/${src.replace(/^\.?\//, '')}`)
    if (out.length === max) break
  }
  return out
}

// "mentions skill" is the spam guard; topic-stuffed spam READMEs never do.
export const looksLikeSkill = (readme: string) => readme === '' || /skill/i.test(readme)

// First real paragraph of the README: fills cards that have no picture.
export function readmeBlurb(md: string, max = 280): string {
  const text = md
    .replace(/<!--[\s\S]*?-->|```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
  for (const block of text.split(/\n\s*\n/)) {
    if (/^\s*(#|\||[-*+] |\d+\. )/m.test(block)) continue // headings, tables, lists
    const p = block.replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim()
    if (p.length >= 60) return p.length > max ? `${p.slice(0, max - 1).trimEnd()}…` : p
  }
  return ''
}

export function fetchExtras(id: string): Promise<Extras> {
  return cached(`gh:readme:v3:${id}`, DAY, async () => {
    const r = await fetch(`${RAW}/${id}/HEAD/README.md`)
    const md = r.ok ? await r.text() : ''
    return { images: pickImages(md, id), skill: looksLikeSkill(md), blurb: readmeBlurb(md) }
  })
}

export function skillsFromTree(paths: string[], repoName: string): Contents {
  const skills = paths.filter(p => /(^|\/)SKILL\.md$/i.test(p)).map(p => p.split('/').at(-2) ?? repoName)
  return { skills: [...new Set(skills)].sort(), hasScripts: paths.some(p => /\.(sh|py|m?js|cjs|ts|ps1|bat|rb)$/i.test(p)) }
}

export function fetchContents(repo: Repo): Promise<Contents> {
  return cached(`gh:tree:${repo.id}`, DAY, async () => {
    const t = await getJson<{ tree: { path: string }[] }>(`${API}/repos/${repo.id}/git/trees/HEAD?recursive=1`)
    return skillsFromTree(t.tree.map(e => e.path), repo.name)
  })
}

export const rarity = (stars: number): Rarity =>
  stars >= 10_000 ? 'legendary' : stars >= 1_000 ? 'epic' : stars >= 100 ? 'rare' : 'common'

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
export const formatStars = (n: number) => compact.format(n).toLowerCase()

export const ageDays = (iso: string, now = Date.now()) => Math.floor((now - Date.parse(iso)) / DAY)

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
export function ago(iso: string, now = Date.now()) {
  const d = ageDays(iso, now)
  return d < 30 ? rtf.format(-d, 'day') : d < 365 ? rtf.format(-Math.round(d / 30), 'month') : rtf.format(-Math.round(d / 365), 'year')
}
