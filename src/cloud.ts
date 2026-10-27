// Shared saved lists in Supabase (supabase/schema.sql). Without the two env values the app keeps
// everything on the device and never calls this.
import { merge, type Saved } from './store'

// Takes the project URL or the REST URL that the dashboard also shows.
const url = import.meta.env.VITE_SUPABASE_URL?.replace(/(\/rest\/v1)?\/?$/, '')
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const cloud = Boolean(url && key)

async function rpc<T>(fn: string, args: object): Promise<T> {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!res.ok) throw new Error(`${fn} failed: ${res.status}`)
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

// Sends what changed here since the last sync, then returns the list as it now stands.
export async function sync(code: string, local: Saved[], base: string[]) {
  // Anyone with the link can write to the list, so only keep entries that point at GitHub.
  const remote = (await rpc<Saved[]>('list_saves', { code })).filter(s => s.url === `https://github.com/${s.id}`)
  const { list, added, removed } = merge(remote, local, base)
  if (added.length) await rpc('add_saves', { code, repos: added })
  await Promise.all(removed.map(id => rpc('remove_save', { code, id })))
  return list
}

// 80 random bits as 20 hex characters, so nobody stumbles onto a list.
export const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), b => b.toString(16).padStart(2, '0')).join('')

export const shareLink = (code: string) => `${location.origin}${location.pathname}#list=${code}`
