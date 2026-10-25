import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { SEEDS, ageDays, ago, formatStars, rarity, type Contents, type Extras, type Repo } from './github'
import { External, Star } from './icons'

export type Exit = { dir: 1 | -1; v: number }
export type Enter = 'deal' | 'stack' | 'left' | 'right'
export type Loadable<T> = T | 'loading' | 'error'

const LABEL = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' }
const stop = (e: PointerEvent) => e.stopPropagation() // links and lists inside the card shouldn't drag or flip it

type Props = {
  repo: Repo
  extras?: Extras
  contents?: Loadable<Contents>
  depth: number
  enter: Enter
  flipped: boolean
  onSwipe: (dir: 1 | -1, v: number) => void
  onFlip: () => void
}

export function Card({ repo, extras, contents, depth, enter, flipped, onSwipe, onFlip }: Props) {
  const reduce = useReducedMotion() ?? false
  const away = window.innerWidth + 320
  // x belongs to the drag alone; an undone card starts off-screen on the side it left and springs back.
  const x = useMotionValue(reduce || enter === 'deal' || enter === 'stack' ? 0 : (enter === 'right' ? 1 : -1) * away)
  const moved = useRef(false)
  const rotate = useTransform(x, [-240, 240], reduce ? [0, 0] : [-16, 16])
  const saveInk = useTransform(x, [24, 110], [0, 1])
  const nopeInk = useTransform(x, [-110, -24], [1, 0])
  const foil = useTransform(x, [-240, 240], ['0% 50%', '100% 50%'])
  const shine = useTransform(x, [-220, 0, 220], [0.9, 0, 0.9])
  const [pick, setPick] = useState(0)
  const [fit, setFit] = useState('')
  const [delay, setDelay] = useState(enter === 'deal' ? (2 - depth) * 0.09 : 0)

  const top = depth === 0
  const tier = rarity(repo.stars)
  const holo = tier === 'epic' || tier === 'legendary'
  const art = extras?.images[pick]
  const tags = repo.topics.filter(t => !SEEDS.includes(t)).slice(0, 4)
  const skills = contents && typeof contents === 'object' ? contents : null
  const skip = () => setPick(p => p + 1)

  useEffect(() => {
    if (x.get() !== 0) animate(x, 0, { type: 'spring', stiffness: 300, damping: 28 })
  }, [x])

  return (
    <motion.article
      className={`card ${tier}`}
      aria-hidden={!top}
      style={{ x, rotate, zIndex: 10 - depth, backgroundPosition: holo ? foil : undefined }}
      initial={
        reduce ? { opacity: 0 }
        : enter === 'deal' ? { y: 520, scale: 0.9, opacity: 0 }
        : enter === 'stack' ? { y: depth * 14 + 28, scale: 0.86, opacity: 0 }
        : false
      }
      animate={{ y: depth * 14, scale: 1 - depth * 0.05, opacity: 1, rotateY: flipped ? 180 : 0 }}
      variants={{
        gone: (e: Exit) => reduce
          ? { opacity: 0, transition: { duration: 0.15 } }
          : { x: e.dir * away, transition: { type: 'spring', velocity: e.v, stiffness: 170, damping: 26 } },
      }}
      exit="gone"
      transition={{ type: 'spring', stiffness: 380, damping: 30, delay, rotateY: { type: 'spring', stiffness: 240, damping: 24 } }}
      onAnimationComplete={() => delay && setDelay(0)}
      drag={top ? 'x' : false}
      dragSnapToOrigin
      dragTransition={{ bounceStiffness: 520, bounceDamping: 18 }}
      whileDrag={{ scale: 1.03 }}
      onPointerDown={() => (moved.current = false)}
      onDragStart={() => (moved.current = true)}
      onDragEnd={(_, i) => {
        if (Math.abs(i.offset.x) > 110 || Math.abs(i.velocity.x) > 650) onSwipe(i.offset.x + i.velocity.x * 0.1 > 0 ? 1 : -1, i.velocity.x)
      }}
      onTap={() => top && !moved.current && onFlip()}
    >
      <div className="face front" inert={flipped}>
        {art && (
          <div className={`art ${fit}`}>
            <img
              key={art}
              src={art}
              alt=""
              draggable={false}
              onError={skip}
              onLoad={e => {
                const { naturalWidth: w, naturalHeight: h } = e.currentTarget
                if (h < 120 || w / h > 4) skip() // a badge, not art
                else setFit(w / h >= 1.3 ? 'cover' : 'contain')
              }}
            />
          </div>
        )}
        <div className={`body${art ? '' : ' noart'}`}>
          <div className="meta">
            <span className="rarity">{LABEL[tier]}</span>
            {ageDays(repo.createdAt) <= 14 && <span className="new">New</span>}
            <span className="stars"><Star />{formatStars(repo.stars)}</span>
          </div>
          <h2 className="name">{repo.name}</h2>
          <p className="owner">
            <img src={`${repo.avatar}&s=48`} alt="" width={22} height={22} draggable={false} />
            {repo.owner}
            {repo.language && <span className="lang">{repo.language}</span>}
          </p>
          {repo.description && <p className="desc">{repo.description}</p>}
          {!art && extras?.blurb && <p className="blurb">{extras.blurb}</p>}
          {tags.length > 0 && <ul className="tags">{tags.map(t => <li key={t}>{t}</li>)}</ul>}
        </div>
        {holo && <motion.div className="sheen" style={{ backgroundPosition: foil, opacity: shine }} />}
        <motion.span className="stamp save" aria-hidden="true" style={{ opacity: saveInk }}>Save</motion.span>
        <motion.span className="stamp nope" aria-hidden="true" style={{ opacity: nopeInk }}>Nope</motion.span>
      </div>

      <div className="face back" inert={!flipped}>
        <div className="meta">
          <span className="rarity">{LABEL[tier]}</span>
          <span className="stars"><Star />{formatStars(repo.stars)}</span>
        </div>
        <h2 className="name">{repo.name}</h2>
        {repo.description && <p className="desc-full">{repo.description}</p>}
        <div className="inside" onPointerDown={stop}>
          <h3>{skills ? `${skills.skills.length} skill${skills.skills.length === 1 ? '' : 's'} inside` : 'Skills inside'}</h3>
          {contents === 'error' ? (
            <p className="muted">GitHub needs a minute. Flip again soon.</p>
          ) : !skills ? (
            <p className="muted">Reading the repo…</p>
          ) : skills.skills.length === 0 ? (
            <p className="muted">No SKILL.md found. This may be a list of links or a tool.</p>
          ) : (
            <ul className="skills">{skills.skills.map(s => <li key={s}>{s}</li>)}</ul>
          )}
        </div>
        {skills?.hasScripts && <p className="warn">Includes scripts. Read them before you install.</p>}
        <p className="muted">Updated {ago(repo.pushedAt)}. Created {ago(repo.createdAt)}.</p>
        <a className="gh" href={repo.url} target="_blank" rel="noreferrer" onPointerDown={stop}>
          Open on GitHub <External />
        </a>
      </div>
    </motion.article>
  )
}
