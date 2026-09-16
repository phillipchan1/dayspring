import { useEffect, useMemo, useState } from 'react'
import { DIMENSION_COPY, EMPTY_COPY, SUMMIT_COPY } from './ascent.config'
import type { ScriptureData, SummitStone, SummitView } from './data/types'
import { ScriptureDimension } from './dimensions/ScriptureDimension'
import { recordClimb, sinceLastClimb } from './lastClimb'
import { loadNaming, startNaming, type YearNaming } from './summitNaming'
import { SummitTrail } from './SummitTrail'

interface Props {
  /** The whole Summit: the refrain, the stones, the long look, the year. */
  view: SummitView
  /** Year-of-the-year verse (real scripture, kept). */
  scripture: ScriptureData | null
  onScriptureDrill: (osisRef: string) => void
  onOpenEntry?: ((entryId: string) => void) | undefined
}

/** A stone is only worth a long look after a few months are under it. Below
 *  that a "throughline" would be a mirror pretending to be a window. */
const LONG_LOOK_MIN_PROGRESS = 0.25

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/**
 * SUMMIT (year) — the quietest ground, and the only altitude that is OPEN.
 *
 * Week, month and season are closed loops: they seal on a boundary and stop
 * moving. The year is the one the writer is standing inside, so it is the one
 * place where returning shows something changed — not because a counter went up
 * but because the year got longer and, sometimes, because an ask was met.
 *
 * Five things, four of them the writer's own material, and the app speaks once:
 * the trail with its stones · the refrain · the verse · the long look, folded ·
 * the writer's own naming of the year.
 */
export function Summit({ view, scripture, onScriptureDrill, onOpenEntry }: Props) {
  const { year, stones, longLook, progress } = view
  const refrain = view.words?.moments?.[0] ?? null

  const [openStone, setOpenStone] = useState<string | null>(null)
  const [longLookOpen, setLongLookOpen] = useState(false)
  const [naming, setNaming] = useState<YearNaming | null>(null)
  const [starting, setStarting] = useState(false)

  // What arrived since this screen last showed the year. The diff is READ during
  // render and RECORDED in an effect — see lastClimb.ts for why the two have to
  // be separate calls.
  const stoneKey = stones.map((s) => s.id).join(',')
  const hasRefrain = refrain !== null
  const since = useMemo(
    () => sinceLastClimb(year, stones, hasRefrain),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [year, stoneKey, hasRefrain],
  )
  useEffect(() => {
    recordClimb(year, stones, hasRefrain)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, stoneKey, hasRefrain])

  // The naming is an ordinary entry, so it is read on its own rather than
  // through the climb: writing one must not mean rebuilding the whole Ascent.
  useEffect(() => {
    let alive = true
    loadNaming(year).then(
      (n) => alive && setNaming(n),
      () => {}, // a naming that won't load is a quiet absence, never an error state
    )
    return () => {
      alive = false
    }
  }, [year])

  const hasAnything =
    refrain !== null || stones.length > 0 || (scripture?.refs.length ?? 0) > 0 || longLook !== null
  if (!hasAnything) {
    return (
      <div className="ascent-summit">
        <SummitTrail year={year} progress={progress} stones={[]} selectedId={null} onSelect={() => {}} />
        <p className="ascent-empty">{EMPTY_COPY.year.empty}</p>
      </div>
    )
  }

  const stone = stones.find((s) => s.id === openStone) ?? null
  const longLookReady = longLook !== null && progress >= LONG_LOOK_MIN_PROGRESS

  async function onWriteNaming() {
    if (starting) return
    if (naming) {
      onOpenEntry?.(naming.entryId)
      return
    }
    setStarting(true)
    try {
      const id = await startNaming(year)
      onOpenEntry?.(id)
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="ascent-summit">
      <SummitTrail
        year={year}
        progress={progress}
        stones={stones}
        selectedId={openStone}
        onSelect={setOpenStone}
      />

      <p className="ascent-summit__look">{SUMMIT_COPY.lookingBack}</p>

      {stone ? <StonePair stone={stone} onOpenEntry={onOpenEntry} onClose={() => setOpenStone(null)} /> : null}

      <div className="ascent-stack ascent-stack--summit">
        {refrain ? (
          <section className="ascent-dim ascent-dim--words is-year">
            <span className="ascent-dim__eyebrow">{DIMENSION_COPY.words.year}</span>
            <button
              type="button"
              className="ascent-oneline"
              onClick={() => onOpenEntry?.(refrain.entryId)}
            >
              “{refrain.text}”
            </button>
            <span className="ascent-oneline__date">{refrain.dateLabel}</span>
          </section>
        ) : null}

        <ScriptureDimension data={scripture} onDrill={onScriptureDrill} />

        {stones.length > 0 && !stone ? (
          <section className="ascent-dim">
            <span className="ascent-dim__eyebrow">{SUMMIT_COPY.stonesEyebrow}</span>
            <p className="ascent-dim__note">{SUMMIT_COPY.stonesHint}</p>
          </section>
        ) : null}

        {longLook ? (
          <section className="ascent-dim ascent-longlook">
            <button
              type="button"
              className="ascent-longlook__toggle"
              onClick={() => setLongLookOpen((v) => !v)}
              aria-expanded={longLookOpen}
              disabled={!longLookReady}
            >
              {!longLookReady
                ? SUMMIT_COPY.longLookWaiting
                : longLookOpen
                  ? SUMMIT_COPY.longLookClose
                  : SUMMIT_COPY.longLookOpen}
            </button>
            {longLookOpen && longLookReady ? (
              <div className="ascent-longlook__body">
                {longLook.throughline.map((p, i) => (
                  <p key={`t${i}`} className="ascent-longlook__para">
                    {p}
                  </p>
                ))}
                {longLook.themes.map((p, i) => (
                  <p key={`h${i}`} className="ascent-longlook__para is-themes">
                    {p}
                  </p>
                ))}
                <p className="ascent-dim__note">{SUMMIT_COPY.longLookFooter}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="ascent-dim ascent-naming">
          <span className="ascent-dim__eyebrow">{SUMMIT_COPY.namingEyebrow}</span>
          {naming && naming.text ? (
            <>
              <button type="button" className="ascent-naming__answer" onClick={() => onOpenEntry?.(naming.entryId)}>
                “{naming.text}”
              </button>
              <span className="ascent-oneline__date">{SUMMIT_COPY.namingBy(naming.dateLabel)}</span>
            </>
          ) : (
            <>
              <p className="ascent-summit__ask">{naming ? SUMMIT_COPY.namingStarted : SUMMIT_COPY.taught}</p>
              <button type="button" className="ascent-naming__write" onClick={onWriteNaming} disabled={starting}>
                {naming ? SUMMIT_COPY.namingOpen : SUMMIT_COPY.namingWrite}
              </button>
            </>
          )}
          <p className="ascent-dim__note">{DIMENSION_COPY.learning.note}</p>
        </section>

        <SinceLastClimb newStones={since.newStones} refrainArrived={since.refrainArrived} />
      </div>
    </div>
  )
}

/** The pair a stone stands for: an earlier ask, and the later moment that met
 *  it. Both verbatim, both opening the page they came from — the app pairs them
 *  and never writes either half. */
function StonePair({
  stone,
  onOpenEntry,
  onClose,
}: {
  stone: SummitStone
  onOpenEntry?: ((entryId: string) => void) | undefined
  onClose: () => void
}) {
  return (
    <div className="ascent-stone-pair">
      <div className="ascent-stone-pair__part">
        <span className="ascent-oneline__date">
          {stone.ask.dateLabel} · {SUMMIT_COPY.stoneAsk}
        </span>
        <button type="button" className="ascent-stone-pair__text" onClick={() => onOpenEntry?.(stone.ask.entryId)}>
          “{stone.ask.text}”
        </button>
      </div>
      <div className="ascent-stone-pair__part">
        <span className="ascent-oneline__date">
          {stone.later.dateLabel} · {SUMMIT_COPY.stoneLater}
        </span>
        <button type="button" className="ascent-stone-pair__text" onClick={() => onOpenEntry?.(stone.later.entryId)}>
          “{stone.later.text}”
        </button>
      </div>
      <button type="button" className="ascent-stone-pair__close" onClick={onClose}>
        {SUMMIT_COPY.stoneClose}
      </button>
    </div>
  )
}

/** Silent unless something actually arrived — which is most visits. */
function SinceLastClimb({
  newStones,
  refrainArrived,
}: {
  newStones: SummitStone[]
  refrainArrived: boolean
}) {
  if (newStones.length === 0 && !refrainArrived) return null

  let text: string
  if (newStones.length === 1) {
    const month = MONTHS[new Date(`${newStones[0]!.later.date}T00:00:00Z`).getUTCMonth()]!
    text = SUMMIT_COPY.sinceStone(month)
  } else if (newStones.length > 1) {
    text = SUMMIT_COPY.sinceStones(newStones.length)
  } else {
    text = SUMMIT_COPY.sinceRefrain
  }

  return <p className="ascent-summit__since">{text}</p>
}
