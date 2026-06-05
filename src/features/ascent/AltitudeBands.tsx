import { useEffect, useId, useState } from 'react'
import { getRopesAtHorizon } from '@/features/threads/data'
import type { WarmthBand } from '@/features/threads/data'
import type { Horizon } from '@/features/threads/data/types'
import { SurfaceLoader } from '@/components/SurfaceLoader'
import { DIMENSION_COPY } from './ascent.config'
import type { ScriptureData } from './data/types'
import { ScriptureDimension } from './dimensions/ScriptureDimension'
import { captionFor, shortLens, warmthSvg } from './warmth'

interface Props {
  /** 0 = Valley/week · 1 = Hillside/month · 2 = Ridge/quarter. (Summit is its own.) */
  horizon: 0 | 1 | 2
  scripture: ScriptureData | null
  onScriptureDrill: (osisRef: string) => void
  onOpenBand: (band: WarmthBand) => void
}

const RESOLUTION = ['week', 'month', 'quarter'] as const
/** Only the few thickest bands surface; the rest rest (quiet line, no counts). */
const VISIBLE = 4
const HOWTO_KEY = 'ascent.howToRead.dismissed'

/**
 * The ropes, rendered as abstract WARMTH BANDS up the altitudes. The same bands
 * persist across altitudes and thicken as the window widens (getRopesAtHorizon).
 * Heft is felt — thickness + saturation + glow pools — never numbered. A one-time
 * "how to read this" key teaches the encoding, then disappears.
 */
export function AltitudeBands({ horizon, scripture, onScriptureDrill, onOpenBand }: Props) {
  const [bands, setBands] = useState<WarmthBand[] | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    setBands(undefined)
    getRopesAtHorizon(horizon as Horizon).then(
      (b) => alive && setBands(b),
      () => alive && setBands(null),
    )
    return () => { alive = false }
  }, [horizon])

  const eyebrow = DIMENSION_COPY.words.themes[RESOLUTION[horizon]]
  const open = (bands ?? []).filter((b) => !b.private)
  const priv = (bands ?? []).filter((b) => b.private)
  const shown = open.slice(0, VISIBLE)
  const resting = open.length - shown.length

  return (
    <div className="ascent-stack">
      <section className="ascent-dim">
        <span className="ascent-dim__eyebrow">{eyebrow}</span>

        <HowToRead />

        {bands === undefined ? (
          <SurfaceLoader label="Reading the warmth…" />
        ) : open.length === 0 && priv.length === 0 ? (
          <p className="ascent-dim__empty">Nothing has gathered this close yet — the threads thicken as you climb.</p>
        ) : (
          <div className="ascent-bands">
            {shown.map((b, i) => (
              <BandRow key={b.id} band={b} horizon={horizon} hero={i === 0} onOpen={onOpenBand} />
            ))}
            {resting > 0 ? (
              <p className="ascent-bands__rest">others rest below the horizon, quieter.</p>
            ) : null}
            {priv.map((b) => (
              <button
                key={b.id}
                type="button"
                className="ascent-band ascent-band--private"
                onClick={() => onOpenBand(b)}
              >
                <div className="ascent-band__head">
                  <span className="ascent-band__name">{b.label}</span>
                  <span className="ascent-band__lock">held privately</span>
                </div>
                <p className="ascent-band__locknote">🔒 held privately — tap to tend, never shown ranked.</p>
              </button>
            ))}
          </div>
        )}
      </section>

      <ScriptureDimension data={scripture} onDrill={onScriptureDrill} />
    </div>
  )
}

// ── one band ────────────────────────────────────────────────────────────────

function BandRow({ band, horizon, hero, onOpen }: { band: WarmthBand; horizon: number; hero: boolean; onOpen: (b: WarmthBand) => void }) {
  return (
    <button type="button" className="ascent-band ascent-band--open" onClick={() => onOpen(band)}>
      <div className="ascent-band__head">
        <span className={`ascent-band__name${hero ? ' is-hero' : ''}`}>{band.label}</span>
        <span className="ascent-band__lens">{band.lenses.map(shortLens).join(' · ')}</span>
      </div>
      {band.repLine ? <p className="ascent-band__snip">“{band.repLine.excerpt}”</p> : null}
      <Warmth heft={band.heft} lenses={band.lenses} pools={band.pools} />
      <p className="ascent-band__caption">{captionFor(band, horizon)}</p>
    </button>
  )
}

// ── the warmth band — soft light, not a chart bar (markup in ./warmth) ────────

function Warmth({ heft, lenses, pools }: { heft: number; lenses: string[]; pools: number[] }) {
  const id = useId().replace(/:/g, '')
  return (
    <div
      className="ascent-band__warmth"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: warmthSvg(heft, lenses, pools, id) }}
    />
  )
}

// ── "how to read this" — one-time, dismissible (NOT a permanent legend) ───────

function HowToRead() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(HOWTO_KEY) === '1' } catch { return false }
  })
  const [openKey, setOpenKey] = useState(false)
  if (dismissed) return null
  return (
    <div className="ascent-howto">
      <button type="button" className="ascent-howto__toggle" onClick={() => setOpenKey((v) => !v)}>
        how to read this {openKey ? '⌃' : '⌄'}
      </button>
      {openKey ? (
        <div className="ascent-howto__key">
          <p><b>thin &amp; pale</b> — touched once or twice.</p>
          <p><b>thick &amp; deep</b> — you kept returning.</p>
          <p>the <b>bright pools</b> mark <b>when</b> it gathered · the <b>hue</b> is which parts of life it wove through.</p>
          <button
            type="button"
            className="ascent-howto__dismiss"
            onClick={() => {
              try { localStorage.setItem(HOWTO_KEY, '1') } catch { /* ignore */ }
              setDismissed(true)
            }}
          >
            got it — hide this
          </button>
        </div>
      ) : null}
    </div>
  )
}
