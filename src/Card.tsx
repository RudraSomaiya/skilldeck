import { useState } from 'react'
import { SEEDS, formatStars, rarity, type Extras, type Repo } from './github'
import { Star } from './icons'

const LABEL = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' }

export function Card({ repo, extras, depth }: { repo: Repo; extras?: Extras; depth: number }) {
  const [pick, setPick] = useState(0)
  const [fit, setFit] = useState('')
  const tier = rarity(repo.stars)
  const art = extras?.images[pick]
  const tags = repo.topics.filter(t => !SEEDS.includes(t)).slice(0, 4)
  const skip = () => setPick(p => p + 1)
  return (
    <article
      className={`card ${tier}${art ? '' : ' noart'}`}
      style={{ transform: `translateY(${depth * 14}px) scale(${1 - depth * 0.05})`, zIndex: 3 - depth }}
    >
      <div className="face">
        {art && (
          <div className={`art ${fit}`}>
            <img
              key={art}
              src={art}
              alt=""
              onError={skip}
              onLoad={e => {
                const { naturalWidth: w, naturalHeight: h } = e.currentTarget
                if (h < 120 || w / h > 4) skip() // a badge, not art
                else setFit(w / h >= 1.3 ? 'cover' : 'contain')
              }}
            />
          </div>
        )}
        <div className="body">
          <div className="meta">
            <span className="rarity">{LABEL[tier]}</span>
            <span className="stars"><Star />{formatStars(repo.stars)}</span>
          </div>
          <h2 className="name">{repo.name}</h2>
          <p className="owner">
            <img src={`${repo.avatar}&s=48`} alt="" width={22} height={22} />
            {repo.owner}
            {repo.language && <span className="lang">{repo.language}</span>}
          </p>
          {repo.description && <p className="desc">{repo.description}</p>}
          {tags.length > 0 && <ul className="tags">{tags.map(t => <li key={t}>{t}</li>)}</ul>}
        </div>
      </div>
    </article>
  )
}
