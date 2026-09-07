import { useEffect, useRef, useState } from 'react'
import type { MarkingKind } from './corpus'
import { DECLARED } from './kinds'
import { Glyph } from './Glyph'
import { asSubject, type Held } from './subjects'

/**
 * Look for.
 *
 * ── The typography problem, and the rule that fixes it ──────────────────────
 *
 * The previous sheet had six type styles arguing with each other: a mono
 * uppercase heading, a serif italic gloss on the same line, serif pills, sans
 * pills, mono counts, and a serif paragraph. Every one was individually
 * defensible and together they read as a ransom note.
 *
 * One rule now, and it decides every case:
 *
 *   **Serif is her. Sans is us.**
 *
 * Her subjects are set in the face the journal is written in, because they are
 * her words. Everything the app says about them — labels, glosses, counts,
 * marking names — is sans, one size, one weight, differing only in opacity.
 * There is no mono anywhere in this sheet; mono is for dates, and a date is a
 * fact about a page rather than part of a control.
 *
 * ── And the corollary: one shape ────────────────────────────────────────────
 *
 * Every option is the same pill, whatever it does. What varies is a hairline
 * (kept) against a dashed line (noticed), and colour once something is on.
 * Three different control shapes in one sheet is the same mistake as six type
 * styles, wearing a different hat.
 *
 * ── The gloss follows the choice ────────────────────────────────────────────
 *
 * "how to read it" used to carry a description under every option, which is
 * four explanations for one decision. Now the row is four plain pills and the
 * gloss for the CHOSEN one sits below, so the sheet explains what you picked
 * rather than pre-empting what you might.
 */

export type Chip =
  | { kind: 'subject'; key: string; label: string; subject: Held }
  | { kind: 'mark'; key: string; label: string; mark: MarkingKind }

export type Reading = 'order' | 'thennow' | 'bursts' | 'words'

export const READINGS: { id: Reading; label: string; gloss: string }[] = [
  { id: 'order', label: 'in order', gloss: 'Every page, oldest first.' },
  { id: 'thennow', label: 'then & now', gloss: 'Two spans. Nothing between them.' },
  // Arithmetic, not narrative: a gap opens a burst, and a burst has to be
  // dense. The app never says these are stories.
  { id: 'bursts', label: 'close together', gloss: 'Stretches bounded by silence.' },
  // The only legal form of the sentiment question — see WordsUsed in SubjectPage.
  { id: 'words', label: 'the words you used', gloss: 'Yours, then against now. Never a score.' },
]

interface Props {
  chips: Chip[]
  subjects: Held[]
  offered: Held[]
  markCounts: Map<MarkingKind, number>
  reading: Reading
  onReading: (r: Reading) => void
  onAdd: (chip: Chip) => void
  onRemove: (key: string) => void
  onClear: () => void
  onKeep: (subject: Held) => void
  onDrop: (key: string) => void
  /** How close you are standing. Lives on the surface, not in the sheet. */
  zoom?: number
  onZoom?: (z: number) => void
  standLabel?: string
}

export function FilterBar({
  chips,
  subjects,
  offered,
  markCounts,
  reading,
  onReading,
  onAdd,
  onRemove,
  onClear,
  onKeep,
  onDrop,
  zoom,
  onZoom,
  standLabel,
}: Props) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function away(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [])

  const on = new Set(chips.map((c) => c.key))
  const q = typed.trim().toLowerCase()
  const match = (s: string) => !q || s.toLowerCase().includes(q)
  const searching = q.length > 0

  const held = subjects.filter((s) => match(s.label))
  const noticed = offered.filter((s) => match(s.label) && !subjects.some((k) => k.key === s.key))
  const mine = typed.trim().length >= 3 ? asSubject(typed) : null
  const alreadyMine = mine ? subjects.some((s) => s.key === mine.key) : false
  const nothing = held.length === 0 && noticed.length === 0 && !mine

  return (
    <div className="look" ref={box}>
      <div className="look__row">
        {/*
          The toggle is the opening of a sentence, and the chips complete it:
          "look for — Mom — the prayers". So it carries no box of its own, only
          an ink-well that surfaces under the cursor. A bordered button here
          would read as machinery sitting on top of her writing.
        */}
        <button type="button" className="look__open" data-on={open ? 'true' : undefined} onClick={() => setOpen((v) => !v)}>
          {/*
            A lens, drawn with the same thin hand as the marking glyphs rather
            than lifted from an icon set — this sits two inches from her own
            sentences and a stock magnifier would read as somebody else's
            software. The chevron went with it: the amber state already says
            the sheet is open, and saying it twice is chrome.
          */}
          <svg className="look__lens" viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
            <circle cx="6.9" cy="6.9" r="4.6" stroke="currentColor" strokeWidth="1.2" />
            <path d="M10.3 10.3 14 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span>look for</span>
        </button>

        {chips.length > 0 ? (
          <div className="look__on">
            {chips.map((c) => (
              <button type="button" className="held" data-kind={c.kind} key={c.key} onClick={() => onRemove(c.key)}>
                {c.label}
                <svg viewBox="0 0 8 8" width="7" height="7" fill="none" aria-hidden>
                  <path d="M1.5 1.5 6.5 6.5M6.5 1.5 1.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
            ))}
            <button type="button" className="look__clear" title="Take everything off" aria-label="Take everything off" onClick={onClear}>
              <svg viewBox="0 0 12 12" width="10" height="10" fill="none" aria-hidden>
                <path d="M2.5 2.5 9.5 9.5M9.5 2.5 2.5 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ) : null}

        {/*
          How close you are standing.
          
          On the surface rather than in the sheet, because it is not part of
          what you are looking FOR — and one continuous move rather than named
          stops, because naming them makes you pick a mode instead of simply
          standing closer. The label says where you are; it is not a control.
        */}
        {onZoom ? (
          <label className="stand">
            <span className="stand__where">{standLabel}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={zoom}
              aria-label="How close you're standing"
              onChange={(e) => onZoom(Number(e.target.value))}
            />
          </label>
        ) : null}
      </div>

      {open ? (
        <div className="sheet">
          <div className="sheet__find">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="4.3" stroke="currentColor" strokeWidth="1.25" />
              <path d="M10.4 10.4 14 14" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
            </svg>
            <input
              autoFocus
              value={typed}
              placeholder="a name, or a word you carry"
              aria-label="Find a subject"
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>

          <section className="sheet__g">
            <h3>subject</h3>

            {/*
              First run. An empty row teaches nothing and looks broken, so the
              group opens on what the journal already noticed — with one line
              saying where those came from, because a name appearing without
              explanation is the app claiming to know her.
            */}
            {subjects.length === 0 && !searching ? (
              /* One line. The dashed pills and the + say the rest. */
              <p className="sheet__note">Names you wrote most often. Keep the ones you carry.</p>
            ) : null}

            <div className="sheet__opts">
              {held.map((s) => (
                <span className="pill pill--kept" key={s.key} data-on={on.has(s.key) ? 'true' : undefined}>
                  <button
                    type="button"
                    className="pill__hit"
                    onClick={() =>
                      on.has(s.key) ? onRemove(s.key) : onAdd({ kind: 'subject', key: s.key, label: s.label, subject: s })
                    }
                  >
                    <em>{s.label}</em>
                    <i>{s.pages}</i>
                  </button>
                  {/*
                    Dropping is safe, and that is what makes keeping cheap: the
                    journal still notices the name, nothing she wrote changes,
                    and it is one click from kept again.
                  */}
                  <button type="button" className="pill__aside" title={`Stop keeping ${s.label}`} onClick={() => onDrop(s.key)}>
                    <svg viewBox="0 0 8 8" width="7" height="7" fill="none" aria-hidden>
                      <path d="M1.5 1.5 6.5 6.5M6.5 1.5 1.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </button>
                </span>
              ))}

              {(searching || subjects.length === 0 ? noticed : noticed.slice(0, 5)).map((s) => (
                <span className="pill pill--noticed" key={s.key} data-on={on.has(s.key) ? 'true' : undefined}>
                  <button
                    type="button"
                    className="pill__hit"
                    onClick={() =>
                      on.has(s.key) ? onRemove(s.key) : onAdd({ kind: 'subject', key: s.key, label: s.label, subject: s })
                    }
                  >
                    <em>{s.label}</em>
                    <i>{s.pages}</i>
                  </button>
                  <button type="button" className="pill__aside pill__aside--keep" title={`Keep ${s.label}`} aria-label={`Keep ${s.label}`} onClick={() => onKeep(s)}>
                    <svg viewBox="0 0 10 10" width="9" height="9" fill="none" aria-hidden>
                      <path d="M5 1.4v7.2M1.4 5h7.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </button>
                </span>
              ))}

              {/*
                Detection finds people and cannot find matters — it will never
                return "marriage", because she does not capitalise it. So a
                matter becomes a subject the moment she says so, from here.
              */}
              {mine && !alreadyMine ? (
                <span className="pill pill--noticed pill--mine">
                  <button
                    type="button"
                    className="pill__hit"
                    onClick={() => onAdd({ kind: 'subject', key: mine.key, label: mine.label, subject: mine })}
                  >
                    <em>{mine.label}</em>
                    <i>{mine.pages}</i>
                  </button>
                  <button type="button" className="pill__aside pill__aside--keep" title={`Keep ${mine.label}`} aria-label={`Keep ${mine.label}`} onClick={() => onKeep(mine)}>
                    <svg viewBox="0 0 10 10" width="9" height="9" fill="none" aria-hidden>
                      <path d="M5 1.4v7.2M1.4 5h7.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </button>
                </span>
              ) : null}

              {searching && nothing ? <p className="sheet__note">Nothing in your pages says that.</p> : null}
            </div>
          </section>

          <section className="sheet__g">
            <h3>marking</h3>
            <div className="sheet__opts">
              {DECLARED.map((k) => {
                const n = markCounts.get(k.kind) ?? 0
                const key = `k:${k.kind}`
                return (
                  <span
                    className="pill pill--mark"
                    key={k.kind}
                    data-on={on.has(key) ? 'true' : undefined}
                    data-off={n === 0 ? 'true' : undefined}
                    style={{ ['--tone' as string]: `var(--k-${k.tone})` } as React.CSSProperties}
                  >
                    <button
                      type="button"
                      className="pill__hit"
                      disabled={n === 0}
                      onClick={() => (on.has(key) ? onRemove(key) : onAdd({ kind: 'mark', key, label: k.label, mark: k.kind }))}
                    >
                      <Glyph kind={k.kind} size={13} />
                      {k.label}
                      <i>{n}</i>
                    </button>
                  </span>
                )
              })}
            </div>
          </section>

          {/*
            Four plain pills and ONE gloss — the chosen one. Describing every
            option is four explanations for one decision, and it doubles the
            type in the sheet to do it.
          */}
          {/*
            Never dimmed. Greying this out until a subject was chosen is what
            made "the words you used" impossible to find — you would open the
            sheet on the wall, see a dead group, and never learn what was in it.
            Every reading works on the whole archive.
          */}
          <section className="sheet__g">
            <h3>reading</h3>
            <div className="sheet__opts">
              {READINGS.map((r) => (
                <span className="pill pill--read" key={r.id} data-on={reading === r.id ? 'true' : undefined}>
                  <button type="button" className="pill__hit" onClick={() => onReading(r.id)}>
                    {r.label}
                  </button>
                </span>
              ))}
            </div>
            <p className="sheet__gloss">{READINGS.find((r) => r.id === reading)?.gloss}</p>
          </section>
        </div>
      ) : null}
    </div>
  )
}
