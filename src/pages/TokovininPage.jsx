import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTokovininStore } from '../store/useTokovininStore'

// Mikhail Tokovinin's channel as a reader: one post per screen, the author's
// text exactly as written (paragraphs, bold, links), five ideas under it, and
// a checkbox that strikes the post through. Opening the section always lands
// right after the last post checked off.

const dateLabel = (iso, lang) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'uz' ? 'uz-UZ' : 'ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

export default function TokovininPage() {
  const { t, i18n } = useTranslation()
  const doneIds = useTokovininStore((s) => s.doneIds)
  const setDone = useTokovininStore((s) => s.setDone)
  const [data, setData] = useState(null)
  const [index, setIndex] = useState(null)
  const topRef = useRef(null)

  // Posts (~1 MB) and ideas load only when the section is opened.
  useEffect(() => {
    let alive = true
    Promise.all([import('../data/tokovinin/posts.json'), import('../data/tokovinin/ideas.json')]).then(([p, i]) => {
      if (alive) setData({ posts: p.default, ideas: i.default })
    })
    return () => { alive = false }
  }, [])

  const posts = data?.posts
  const startIndex = useMemo(() => {
    if (!posts) return 0
    let last = -1
    posts.forEach((p, i) => { if (doneIds[p.id]) last = i })
    return Math.min(last + 1, posts.length - 1)
    // Only where the section opens — later checks must not jump the reader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts])

  useEffect(() => { if (posts && index === null) setIndex(startIndex) }, [posts, index, startIndex])

  const go = useCallback((next) => {
    if (!posts) return
    setIndex(Math.max(0, Math.min(posts.length - 1, next)))
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [posts])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, [contenteditable="true"]')) return
      if (e.key === 'ArrowRight') go(index + 1)
      else if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, index])

  if (!posts || index === null) return <div className="tok-page"><p className="tok-loading">…</p></div>

  const post = posts[index]
  const done = !!doneIds[post.id]
  // null = nothing to retell (a bare link or an announcement).
  const ideas = data.ideas[post.id]
  const doneCount = posts.reduce((n, p) => n + (doneIds[p.id] ? 1 : 0), 0)
  const pct = Math.round((doneCount / posts.length) * 1000) / 10

  return (
    <div className="tok-page">
      <article className="tok-reader" ref={topRef}>
        <div className="tok-reader__meta">
          <span>{t('tokovinin.postOf', { n: index + 1, total: posts.length })} · {dateLabel(post.date, i18n.language)}</span>
          <span>{t('tokovinin.read', { pct })}</span>
        </div>
        <div className="tok-reader__bar"><span style={{ width: `${(doneCount / posts.length) * 100}%` }} /></div>

        <div className="tok-reader__head">
          <button
            type="button"
            className={'tok-check' + (done ? ' tok-check--on' : '')}
            onClick={() => setDone(post.id, !done)}
            aria-pressed={done}
            aria-label={done ? t('tokovinin.markUnread') : t('tokovinin.markRead')}
            title={done ? t('tokovinin.markUnread') : t('tokovinin.markRead')}
          >
            {done ? '✓' : ''}
          </button>
          {post.media && <span className="tok-media">{t('tokovinin.hadMedia')}</span>}
        </div>

        {/* Static, pre-sanitised HTML from the channel export (only strong/em/
            u/s/code/blockquote and http(s) links survive — see the import). */}
        <div className={'tok-post' + (done ? ' tok-post--done' : '')} dangerouslySetInnerHTML={{ __html: post.html }} />

        <section className="tok-ideas">
          <h3>{t('tokovinin.ideas')}</h3>
          {ideas === null ? (
            <p className="tok-ideas__empty">{t('tokovinin.noIdeas')}</p>
          ) : ideas?.length ? (
            <ol>{ideas.map((idea, i) => <li key={i}><span className="tok-ideas__n">{i + 1}</span><p>{idea}</p></li>)}</ol>
          ) : (
            <p className="tok-ideas__empty">{t('tokovinin.ideasPending')}</p>
          )}
        </section>

        <div className="tok-reader__nav">
          <button type="button" className="tok-btn" onClick={() => go(index - 1)} disabled={index === 0}>‹ {t('tokovinin.prev')}</button>
          {done ? (
            <button type="button" className="tok-btn tok-btn--primary" onClick={() => go(index + 1)} disabled={index === posts.length - 1}>{t('tokovinin.next')} ›</button>
          ) : (
            <button type="button" className="tok-btn tok-btn--primary" onClick={() => { setDone(post.id, true); go(index + 1) }}>{t('tokovinin.readNext')} ›</button>
          )}
        </div>
      </article>
    </div>
  )
}
