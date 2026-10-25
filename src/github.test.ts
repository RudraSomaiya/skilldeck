import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildQuery, formatStars, looksLikeSkill, mergeRepos, pickImages, rarity, readmeBlurb, skillsFromTree } from './github.ts'
import type { Filters, Repo } from './github.ts'

const f: Filters = { min: 10, max: null, sort: 'top', hidden: [] }

test('buildQuery: open-ended or ranged stars, "new" adds a created date', () => {
  assert.equal(buildQuery('claude-skills', f), 'topic:claude-skills stars:>=10')
  assert.equal(buildQuery('agent-skills', { ...f, max: 500 }), 'topic:agent-skills stars:10..500')
  assert.equal(buildQuery('x', { ...f, sort: 'new' }, Date.parse('2026-10-23T00:00:00Z')), 'topic:x stars:>=10 created:>=2026-09-23')
})

test('pickImages skips badges, resolves relative paths and blob links', () => {
  const md = '[![Stars](https://img.shields.io/github/stars/a/b)](x) ![installs](https://skills.sh/b/a/b)\n![demo](./docs/demo.gif "Demo")'
  assert.deepEqual(pickImages(md, 'a/b'), ['https://raw.githubusercontent.com/a/b/HEAD/docs/demo.gif'])
  assert.deepEqual(pickImages('<img width="600" src="https://github.com/a/b/blob/main/shot.png">', 'a/b'), ['https://raw.githubusercontent.com/a/b/main/shot.png'])
  assert.deepEqual(pickImages('![1](a.png) ![2](b.png) ![3](c.png) ![4](d.png)', 'a/b').length, 3)
  assert.deepEqual(pickImages('no pictures here', 'a/b'), [])
})

test('skillsFromTree names skills by folder and flags scripts', () => {
  assert.deepEqual(skillsFromTree(['skills/b/SKILL.md', 'skills/a/SKILL.md', 'README.md'], 'r'), { skills: ['a', 'b'], hasScripts: false })
  assert.deepEqual(skillsFromTree(['SKILL.md', 'scripts/run.py'], 'r'), { skills: ['r'], hasScripts: true })
})

test('looksLikeSkill drops READMEs that never mention skills', () => {
  assert.equal(looksLikeSkill('# FPS optimizer\nBoost your frames'), false)
  assert.equal(looksLikeSkill('An agent Skill for diagrams'), true)
  assert.equal(looksLikeSkill(''), true)
})

test('readmeBlurb takes the first real paragraph, not headings, lists or badges', () => {
  const md = '# Title\n\n[![b](https://img.shields.io/x)](y)\n\n- a list item that is long enough to be a paragraph but is a list\n\nThis skill turns any **plan** into a [diagram](https://x.y) you can click through, with no setup at all.'
  assert.equal(readmeBlurb(md), 'This skill turns any plan into a diagram you can click through, with no setup at all.')
  assert.equal(readmeBlurb('# Only a heading'), '')
  assert.equal(readmeBlurb(`${'word '.repeat(80)}`, 20).length, 20)
})

test('rarity tiers and star formatting', () => {
  assert.deepEqual([99, 100, 1_000, 10_000].map(rarity), ['common', 'rare', 'epic', 'legendary'])
  assert.equal(formatStars(88_065), '88.1k')
})

test('mergeRepos dedupes and sorts by stars or freshness', () => {
  const r = (id: string, stars: number, pushedAt: string) => ({ id, stars, pushedAt }) as Repo
  const lists = [[r('a', 5, '2026-05-01'), r('b', 9, '2026-03-01')], [r('a', 5, '2026-05-01')]]
  assert.deepEqual(mergeRepos(lists, 'top').map(x => x.id), ['b', 'a'])
  assert.deepEqual(mergeRepos(lists, 'fresh').map(x => x.id), ['a', 'b'])
})
