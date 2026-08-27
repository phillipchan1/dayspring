import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { validateMarkings } from './corpus'
import { validateSemantics } from './semantics'
import { LookingScene } from './scenes/LookingScene'
import { LeavesScene } from './scenes/LeavesScene'
import { FitScene } from './scenes/FitScene'
import { PageScene } from './scenes/PageScene'
import { Notes } from './scenes/Notes'

/**
 * Three routes, and two of them are not the product.
 *
 * The previous pass had a scene bar with ten entries along the bottom, and that
 * bar was the tell: ten named destinations is a dashboard, and choosing one
 * before you have a question is work. Everything it held is now one surface
 * whose shape follows from what you put in the bar.
 *
 * `leaves` is the reading-zoom argument on its own, because it is a claim about
 * page layout rather than a way of looking back. `notes` is for the facilitator
 * and never goes on a shared screen.
 */
export const ROUTES = [
  { id: 'looking', key: '1', label: 'looking' },
  { id: 'fit', key: '2', label: 'where it fits' },
  { id: 'leaves', key: '3', label: 'a page that runs long' },
  { id: 'notes', key: '?', label: 'notes' },
] as const

export type RouteId = (typeof ROUTES)[number]['id'] | 'page'

function parseHash(): { route: RouteId; rest: string } {
  const raw = window.location.hash.replace(/^#/, '')
  const [head = '', ...tail] = raw.split('/')
  const known = head === 'page' || ROUTES.some((r) => r.id === head)
  return { route: known ? (head as RouteId) : 'looking', rest: tail.join('/') }
}

function setHash(route: RouteId, rest = '') {
  const next = rest ? `#${route}/${rest}` : `#${route}`
  if (window.location.hash !== next) window.location.hash = next
}

export function App() {
  const [{ route, rest }, setRoute] = useState(parseHash)
  const [bar, setBar] = useState(true)

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    if (!window.location.hash) setHash('looking')
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = useCallback((id: RouteId, extra = '') => setHash(id, extra), [])

  /*
   * Both fixtures obey the product's own grounding rule, and both say so
   * loudly if they ever stop. A quote nobody wrote is the single failure this
   * whole surface exists to avoid — and the semantic one matters more, because
   * it is the only place here the app is pretending to be clever.
   */
  useEffect(() => {
    const marks = validateMarkings()
    if (marks.length) console.error('[markings] not verbatim:\n' + marks.join('\n'))
    const near = validateSemantics()
    if (near.length) console.error('[semantics] not verbatim:\n' + near.join('\n'))
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        if (e.key === 'Escape') (el as HTMLInputElement).blur()
        return
      }
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

  const open = (id: string) => go('page', id)

  let view: ReactNode
  switch (route) {
    case 'looking':
      view = <LookingScene onOpen={open} />
      break
    case 'fit':
      view = <FitScene onOpen={open} />
      break
    case 'leaves':
      view = <LeavesScene onOpen={open} />
      break
    case 'page':
      view = <PageScene id={rest} onBack={() => window.history.back()} />
      break
    case 'notes':
      view = <Notes onGo={(id) => go(id)} />
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
