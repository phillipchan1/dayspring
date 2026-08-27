import { useState } from 'react'
import type { Hue, Marking, MarkingKind } from '../corpus'
import { Glyph } from '../Glyph'
import { DECLARED, HUES, KIND_META, TOUCH } from '../kinds'

/**
 * Putting your touch on your own words.
 *
 * The input half. Everything here already exists in the product under another
 * name — /scripture, /pray, /sense are slash commands, and highlight, underline
 * and the plain mark are formatting. Two things are new: /story and /learned,
 * and the fact that all of them are one category with one word for it.
 *
 * What must stay true (Principle 3): the writing surface is sacred. Nothing
 * here asks a question while the cursor is live. The plain mark stays one
 * gesture with no decision attached — a kind is something you reach for, never
 * something you are asked for.
 */

const PARA =
  'I have the sense that I am being handed something to carry rather than something to fix. I do not know what to do with that yet.'
const PICKED = 'I am being handed something to carry rather than something to fix'

export function MarkingView() {
  const [applied, setApplied] = useState<Marking[]>([])
  const [hue, setHue] = useState<Hue>('amber')

  function add(kind: MarkingKind) {
    setApplied((prev) => {
      if (prev.some((m) => m.kind === kind)) return prev.filter((m) => m.kind !== kind)
      return [...prev, { kind, quote: PICKED, para: 0, ...(kind === 'highlight' ? { hue } : {}) }]
    })
  }

  const on = (k: MarkingKind) => applied.some((m) => m.kind === k)
  const top = applied[applied.length - 1]
  const before = PARA.slice(0, PARA.indexOf(PICKED))
  const after = PARA.slice(PARA.indexOf(PICKED) + PICKED.length)

  return (
    <div className="desk">
      <div className="mk">
        <div className="mk__leaf">
          <div className="leaf__head">
            <time className="leaf__date">Oct 9, 2024</time>
            <span className="leaf__year">2024</span>
            <span />
          </div>

          <p className="mk__para said">
            {before}
            <span
              className={[
                'mk__sel',
                on('highlight') ? 'hl' : '',
                on('underline') ? 'ul' : '',
                on('mark') ? 'setapart' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              data-hue={on('highlight') ? hue : undefined}
              data-declared={applied.find((m) => KIND_META[m.kind].family === 'declared')?.kind}
              data-empty={applied.length === 0 ? 'true' : undefined}
            >
              {PICKED}
            </span>
            {after}
          </p>

          {/* What comes back later. The margin fills as you mark. */}
          <div className="mk__margin">
            {applied.length === 0 ? (
              <span className="mk__margin-empty">the margin, later</span>
            ) : (
              applied.map((m, i) => (
                <div className="note" key={i} data-kind={m.kind}>
                  <Glyph kind={m.kind} hue={m.hue} size={24} />
                  <div className="note__body">
                    <p className="note__quote">{m.quote}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/*
          The palette. Two families, one category — not "commands" and
          "formatting", which is how the product describes them to itself.
        */}
        <aside className="pal">
          <div className="pal__group">
            <p className="pal__label">you named the act</p>
            {DECLARED.map((k) => (
              <button key={k.kind} type="button" className="pal__row" data-on={on(k.kind) ? 'true' : undefined} onClick={() => add(k.kind)}>
                <Glyph kind={k.kind} size={22} />
                <span className="pal__name">{k.label}</span>
                <span className="pal__cmd">{k.command}</span>
              </button>
            ))}
          </div>

          <div className="pal__group">
            <p className="pal__label">you emphasised the words</p>
            {TOUCH.filter((k) => k.kind !== 'quote').map((k) => (
              <button key={k.kind} type="button" className="pal__row" data-on={on(k.kind) ? 'true' : undefined} onClick={() => add(k.kind)}>
                <Glyph kind={k.kind} hue={k.kind === 'highlight' ? hue : undefined} size={22} />
                <span className="pal__name">{k.label}</span>
              </button>
            ))}
            <div className="pal__hues">
              {HUES.map((h) => (
                <button
                  key={h}
                  type="button"
                  className="hue"
                  data-hue={h}
                  data-on={hue === h ? 'true' : undefined}
                  aria-label={h}
                  onClick={() => {
                    setHue(h)
                    setApplied((prev) => prev.map((m) => (m.kind === 'highlight' ? { ...m, hue: h } : m)))
                  }}
                />
              ))}
            </div>
          </div>

          <p className="pal__gloss">{top ? KIND_META[top.kind].gloss : ' '}</p>
        </aside>
      </div>
    </div>
  )
}
