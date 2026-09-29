/**
 * Dev-only: `?__preview=guest-review` — the two App Review guest surfaces
 * (account menu, ritual passage picker) against the real components.
 *
 *   ?__preview=guest-review            both, stacked
 *   ?__preview=guest-review&part=menu  the You menu, already open
 *   ?__preview=guest-review&part=passage  Lectio, John 15, own-Bible path
 */
import { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { GuestModeProvider } from '@/context/GuestMode'
import { YouMenu } from './YouMenu'
import { PassageFinder } from '@/editor/practices/PassageFinder'
import { PRACTICES } from '@/editor/practices/practicesData'
import { THEMES, type ThemeId } from '@/lib/resolveTheme'
import '@/editor/practices/Passage.css'

const lectio = PRACTICES.find((p) => p.name === 'Lectio Divina')!

function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((t) => t.id === value)
}

function OpenYouMenu() {
  const wrap = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    wrap.current?.querySelector<HTMLButtonElement>('[aria-label="You"]')?.click()
  }, [])
  return (
    <div
      ref={wrap}
      style={{ minHeight: 480, display: 'flex', alignItems: 'flex-end', position: 'relative' }}
    >
      <YouMenu
        userEmail=""
        onLifeMap={() => {}}
        onRitualThreads={() => {}}
        onOpenSettings={() => {}}
        concordanceEnabled={false}
        labelsExpanded
      />
    </div>
  )
}

function OpenPassage() {
  const wrap = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    let cancelled = false
    const tryOpen = () => {
      if (cancelled) return
      const host = wrap.current
      if (!host) return
      const book = [...host.querySelectorAll('.pf__book')].find((el) => el.textContent?.trim() === 'John')
      if (!book) {
        requestAnimationFrame(tryOpen)
        return
      }
      ;(book as HTMLElement).click()
      requestAnimationFrame(() => {
        const chapter = [...host.querySelectorAll('.pf__ch')].find((el) => el.textContent?.trim() === '15')
        ;(chapter as HTMLElement | undefined)?.click()
      })
    }
    tryOpen()
    return () => {
      cancelled = true
    }
  }, [])
  return (
    <div ref={wrap} style={{ minHeight: 560 }}>
      <PassageFinder
        practice={lectio}
        onChoose={() => {}}
        onBack={() => {}}
        backLabel="the library"
      />
    </div>
  )
}

function Preview({ part }: { part: string | null }) {
  const showMenu = !part || part === 'menu'
  const showPassage = !part || part === 'passage'
  return (
    <GuestModeProvider requestSignIn={() => {}}>
      <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: '2rem 1.5rem 4rem' }}>
        {showMenu && (
          <section style={{ maxWidth: 360, marginBottom: '3rem' }}>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--text-faint)',
                marginBottom: '0.8rem',
              }}
            >
              Guest account menu
            </p>
            <OpenYouMenu />
          </section>
        )}
        {showPassage && (
          <section>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--text-faint)',
                marginBottom: '0.8rem',
              }}
            >
              Guest passage picker
            </p>
            <OpenPassage />
          </section>
        )}
      </div>
    </GuestModeProvider>
  )
}

export function renderGuestReviewPreview(): void {
  const params = new URLSearchParams(window.location.search)
  const wanted = params.get('theme')
  const theme: ThemeId = isThemeId(wanted) ? wanted : 'dawn'
  const family = THEMES.find((t) => t.id === theme)?.family ?? 'light'
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.setAttribute('data-appearance', family)
  root.style.colorScheme = family

  const el = document.getElementById('root')
  if (!el) throw new Error('Root element #root not found')
  createRoot(el).render(<Preview part={params.get('part')} />)
}
