import { useEffect, useMemo, useState } from 'react'
import type { MarkingKind } from '../corpus'
import { Glyph } from '../Glyph'
import { KIND_META } from '../kinds'

/**
 * What it looks like while you are still writing.
 *
 * It opens OFF, and that is not a placeholder — off is the default the product
 * would actually ship. What you are looking at first is the editor exactly as
 * it is today, and every other state on this screen is something a person had
 * to go and turn on.
 *
 * Two axes, because both are live arguments and neither is settled:
 *
 * WHEN — Principle 3 says the writing surface is sacred and forbids
 * suggestions in the composing surface outright; RECALL's Act four says
 * re-entry lands *after* the writing, never as live editor chrome. So "as you
 * write" is here to make the cost feelable, not because it is allowed. Watch
 * whether the margin pulls your eye off the sentence you are still typing.
 *
 * HOW — D-016 rejected model-inferred significance: recurrence is a count,
 * significance is a verdict. "It decides" is that rejected shape, built so it
 * can be looked at rather than argued about. "It offers" is the D-019 shape:
 * the app may propose, and everything it proposes arrives as something you can
 * pull off. Until it is kept it is in PENCIL — it carries no weight, appears in
 * no count, and reaches no other surface.
 *
 * The dismiss is one tap, costs nothing, and says nothing back. An easy,
 * dignified no is what keeps every yes honest.
 *
 * Note what the opt-in does and does not buy. Off-by-default answers Principle
 * 3 — the default writing surface is untouched. It does NOT answer D-016:
 * consenting to be judged is still being judged, so "it decides" is no more
 * legal switched on than it was before. The switch gates when; pencil gates
 * what; they stack.
 */

type When = 'live' | 'pause' | 'close'
type How = 'off' | 'offers' | 'decides'

type Candidate = {
  id: string
  kind: MarkingKind
  para: number
  quote: string
}

const TEXT = [
  'David asked what I would do with a free morning and I did not have an answer ready.',
  'What I want is an hour that is not owed to anyone. I have wanted it for two years and never once put it on a calendar.',
  'What I have learned is that the hour does not appear. It gets taken, and I have not been willing to take it.',
]

const CANDIDATES: Candidate[] = [
  { id: 'c1', kind: 'desire', para: 1, quote: 'What I want is an hour that is not owed to anyone.' },
  {
    id: 'c2',
    kind: 'learned',
    para: 2,
    quote: 'the hour does not appear. It gets taken, and I have not been willing to take it',
  },
]

const SPEED = 24
const HOLD = 1100

export function PencilView() {
  const [when, setWhen] = useState<When>('pause')
  const [how, setHow] = useState<How>('off')
  const [run, setRun] = useState(0)

  /** How much of paragraph `p` has been typed. */
  const [p, setP] = useState(0)
  const [c, setC] = useState(0)
  /** Between paragraphs — the beat where someone stops and looks up. */
  const [resting, setResting] = useState(false)

  const [kept, setKept] = useState<Record<string, boolean>>({})
  const [gone, setGone] = useState<Record<string, boolean>>({})

  function restart() {
    setP(0)
    setC(0)
    setResting(false)
    setKept({})
    setGone({})
    setRun((r) => r + 1)
  }

  useEffect(restart, [when, how])

  useEffect(() => {
    const current = TEXT[p]
    if (current === undefined) return

    if (c < current.length) {
      const t = window.setTimeout(() => setC((v) => v + 1), SPEED)
      return () => window.clearTimeout(t)
    }

    // End of a paragraph. Rest here — this is the pause "when you pause" means.
    if (!resting) {
      setResting(true)
      return
    }
    if (p >= TEXT.length - 1) return
    const t = window.setTimeout(() => {
      setP((v) => v + 1)
      setC(0)
      setResting(false)
    }, HOLD)
    return () => window.clearTimeout(t)
  }, [p, c, resting, run])

  const finished = p >= TEXT.length - 1 && c >= (TEXT[TEXT.length - 1]?.length ?? 0)

  const shown = useMemo(
    () =>
      CANDIDATES.filter((cand) => {
        if (how === 'off') return false
        if (gone[cand.id]) return false
        const typedThrough = p > cand.para || (p === cand.para && (TEXT[p] ?? '').slice(0, c).includes(cand.quote))
        if (when === 'live') return typedThrough
        if (when === 'pause') return typedThrough && (resting || p > cand.para)
        return finished && resting
      }),
    [p, c, resting, finished, when, gone, how],
  )

  return (
    <div className="desk">
      <div className="pen">
        <div className="pen__bar">
          <div className="seg" role="group" aria-label="when it appears" data-muted={how === 'off' ? 'true' : undefined}>
            {(
              [
                ['live', 'as you write'],
                ['pause', 'when you pause'],
                ['close', 'when you finish'],
              ] as [When, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                data-on={when === v ? 'true' : undefined}
                disabled={how === 'off'}
                onClick={() => setWhen(v)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="whether it decides">
            {(
              [
                ['off', 'off'],
                ['offers', 'it notices'],
                ['decides', 'it decides'],
              ] as [How, string][]
            ).map(([v, label]) => (
              <button key={v} type="button" data-on={how === v ? 'true' : undefined} onClick={() => setHow(v)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="pen__leaf">
          <div className="leaf__head">
            <time className="leaf__date">Today</time>
            <span className="leaf__year">2026</span>
            <button className="leaf__flip" onClick={restart} aria-label="Start again">
              ↺
            </button>
          </div>

          <div className="pen__grid">
            {TEXT.map((full, i) => {
              const text = i < p ? full : i === p ? full.slice(0, c) : ''
              const mine = shown.filter((cand) => cand.para === i)
              const cursor = i === p && !finished
              return (
                <div className="leaf__row" key={i}>
                  <p className="pen__para said">
                    <Typed text={text} candidate={mine[0]} kept={kept} how={how} />
                    {cursor ? <span className="pen__caret" aria-hidden /> : null}
                  </p>
                  <aside className="leaf__margin">
                    {mine.map((cand) => (
                      <Proposal
                        key={cand.id}
                        candidate={cand}
                        how={how}
                        kept={!!kept[cand.id]}
                        onKeep={() => setKept((k) => ({ ...k, [cand.id]: true }))}
                        onDismiss={() => setGone((g) => ({ ...g, [cand.id]: true }))}
                      />
                    ))}
                  </aside>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/** The candidate's own span, drawn in pencil until it is kept. */
function Typed({
  text,
  candidate,
  kept,
  how,
}: {
  text: string
  candidate?: Candidate
  kept: Record<string, boolean>
  how: How
}) {
  if (!candidate) return <>{text}</>
  const at = text.indexOf(candidate.quote)
  if (at < 0) return <>{text}</>
  const inked = how === 'decides' || kept[candidate.id]
  return (
    <>
      {text.slice(0, at)}
      <span className="pen__span" data-kind={candidate.kind} data-inked={inked ? 'true' : undefined}>
        {candidate.quote}
      </span>
      {text.slice(at + candidate.quote.length)}
    </>
  )
}

function Proposal({
  candidate,
  how,
  kept,
  onKeep,
  onDismiss,
}: {
  candidate: Candidate
  how: How
  kept: boolean
  onKeep: () => void
  onDismiss: () => void
}) {
  const meta = KIND_META[candidate.kind]
  const decided = how === 'decides'
  const pencil = !decided && !kept

  return (
    <div className="prop" data-kind={candidate.kind} data-pencil={pencil ? 'true' : undefined}>
      <Glyph kind={candidate.kind} size={24} pencil={pencil} />
      <div className="prop__body">
        <span className="prop__name">{meta.label}</span>
        <p className="prop__quote">{candidate.quote}</p>

        {/*
          "It decides" has no controls, on purpose. That absence is the whole
          difference — a tag you cannot refuse is a verdict, and these two
          buttons are what stop it being one.
        */}
        {decided ? null : kept ? (
          <span className="prop__done">kept</span>
        ) : (
          <div className="prop__acts">
            <button type="button" className="prop__keep" onClick={onKeep}>
              keep
            </button>
            <button type="button" className="prop__no" onClick={onDismiss}>
              not this
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
