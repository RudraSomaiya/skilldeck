import assert from 'node:assert/strict'
import { test } from 'node:test'
import { merge, type Saved } from './store.ts'

const s = (id: string) => ({ id }) as Saved
const ids = (list: Saved[]) => list.map(x => x.id)

test('merge keeps changes made here and takes the rest from the list', () => {
  // a, b and c were on the list at the last sync. Since then this device removed b and saved d,
  // while a friend removed c and saved e.
  const { list, added, removed } = merge([s('e'), s('a'), s('b')], [s('d'), s('a'), s('c')], ['a', 'b', 'c'])
  assert.deepEqual(ids(list), ['d', 'e', 'a'])
  assert.deepEqual(ids(added), ['d'])
  assert.deepEqual(removed, ['b'])
})

test('merge sends every save made before joining a list', () => {
  const { list, added, removed } = merge([s('x')], [s('a'), s('x')], [])
  assert.deepEqual(ids(list), ['a', 'x'])
  assert.deepEqual(ids(added), ['a', 'x'])
  assert.deepEqual(removed, [])
})
