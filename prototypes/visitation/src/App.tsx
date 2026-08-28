import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { validateMarkings } from './corpus'
import { validateCouncil } from './fathers'
import { validateAsking } from './questions'
import { Arrives } from './scenes/Arrives'
import { HeartScene } from './scenes/HeartScene'
import { AskingScene } from './scenes/AskingScene'
import { CouncilScene } from './scenes/CouncilScene'
import { OnwardScene } from './scenes/OnwardScene'
import { GoneScene } from './scenes/GoneScene'
import { Notes } from './scenes/Notes'

/**
 * Six routes, and `arrives` is the only one that is the product.
 *
 * The other five are arguments about it, which is what a screen-share
 * click-through is for. `looking` learned the neighbouring lesson the hard
 * way — ten named destinations along the bottom IS a dashboard — but that was
 * a bar in a surface a user would live in. This bar is the facilitator's, it
 * is hidden with `S` before anyone sees it, and every route on it is a
 * question to put to a person rather than a place to go.
 */
export const ROUTES = [
  { id: 'arrives', key: '1', label: 'it arrives' },
  { id: 'heart', key: '2', label: 'the heart (cut)' },
  { id: 'asking', key: '3', label: 'where the question comes from' },
  { id: 'council', key: '4', label: 'the statement version' },
  { id: 'onward', key: '5', label: 'onward' },
  { id: 'thin', key: '6', label: 'the same season, 2024' },
  { id: 'gone', key: '7', label: 'after' },
  { id: 'notes', key: '?', label: 'notes' },
] as const

export type RouteId = (typeof ROUTES)[number]['id']

function parseHash(): RouteId {
  const raw = window.location.hash.replace(/^#/, '')
  return ROUTES.some((r) => r.id === raw) ? (raw as RouteId) : 'arrives'
}

export function App() {
  const [route, setRoute] = useState(parseHash)
  const [bar, setBar] = useState(true)

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    if (!window.location.hash) window.location.hash = 'arrives'
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = useCallback((id: RouteId) => {
    window.location.hash = id
  }, [])

  /*
   * Both fixtures gate themselves on load, and the reasons differ.
   *
   * Her markings are gated on being verbatim — the product's own Principle 4,
   * and the failure this whole surface exists to avoid.
   *
   * The council is gated on staying AUDITABLE: a citation, an edition, and a
   * theme something can reach. It cannot check a quote against a book, because
   * that is human work this prototype deliberately has not done. What it can
   * catch is the corpus quietly turning back into model memory with extra
   * steps.
   *
   * A clean console is the check.
   */
  useEffect(() => {
    const marks = validateMarkings()
    if (marks.length) console.error('[markings] not verbatim:\n' + marks.join('\n'))
    const council = validateCouncil()
    if (council.length) console.error('[council] not auditable:\n' + council.join('\n'))
    /* The questions corpus has one extra invariant, and it is the one that
       matters: every row must END IN A QUESTION MARK. The moment a statement
       sneaks in, the surface has gone back to telling her things and it will
       not look any different. */
    const asking = validateAsking()
    if (asking.length) console.error('[asking] not questions:\n' + asking.join('\n'))
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        setBar((v) => !v)
        return
      }
      const hit = ROUTES.find((r) => r.key === e.key)
      if (hit) {
        e.preventDefault()
        go(hit.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  let view: ReactNode
  switch (route) {
    case 'arrives':
      view = <Arrives spanId="spring-2026" />
      break
    case 'heart':
      view = <HeartScene />
      break
    case 'asking':
      view = <AskingScene />
      break
    case 'council':
      view = <CouncilScene />
      break
    case 'onward':
      view = <OnwardScene />
      break
    /* The same page, over three entries. Principle 5's honesty test. */
    case 'thin':
      view = <Arrives spanId="thin-2024" />
      break
    case 'gone':
      view = <GoneScene />
      break
    case 'notes':
      view = <Notes onGo={go} />
      break
  }

  return (
    <>
      {view}
      <nav className="switcher" hidden={!bar} aria-hidden={!bar}>
        {ROUTES.map((r) => (
          <button key={r.id} type="button" data-on={r.id === route ? 'true' : undefined} onClick={() => go(r.id)}>
            {r.label}
          </button>
        ))}
      </nav>
    </>
  )
}
