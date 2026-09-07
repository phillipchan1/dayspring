import { useMemo, useState } from 'react'
import { ENTRIES, type MarkingKind } from '../corpus'
import { Glyph } from '../Glyph'
import { DECLARED, KINDS, TOUCH } from '../kinds'

/**
 * The opt-in.
 *
 * Off by default, and that is the whole point: Principle 3's own test is
 * whether a change touches the editor's render or input path, and a feature
 * nobody has turned on does not. The default writing surface stays exactly as
 * sacred as it was.
 *
 * What opt-in does NOT buy is D-016. Consenting to be judged is still being
 * judged — a switch cannot turn a verdict into evidence. That is pencil's job,
 * and the two stack rather than substituting for each other.
 *
 * The honest cost, named: Kristi did not find the slash commands for two or
 * three weeks. Off-by-default in a settings pane is the safest possible place
 * to put something and the least findable. Whatever makes this safe is the same
 * thing that makes it invisible, and there is no version of this where that
 * trade goes away.
 */

type Permission = 'used' | 'chosen'

export function SettingsView() {
  const [margin, setMargin] = useState(true)
  const [on, setOn] = useState(false)
  const [permission, setPermission] = useState<Permission>('used')
  const [chosen, setChosen] = useState<Record<string, boolean>>({ desire: true, learned: true, story: true })
  const [seasons, setSeasons] = useState(false)

  /** How often the writer has reached for each kind. A count, never a ranking. */
  const used = useMemo(() => {
    const c = new Map<MarkingKind, number>()
    for (const e of ENTRIES) for (const m of e.markings ?? []) c.set(m.kind, (c.get(m.kind) ?? 0) + 1)
    return c
  }, [])

  return (
    <div className="desk">
      <div className="set">
        <div className="leaf leaf--flat">
          <p className="set__group">While you write</p>

          {/*
            The vessel, before what fills it. Turning this off leaves a bare page
            — no rule, no glyphs, nothing on the right at all — and the marks
            still exist everywhere else. Someone who wants only the writing
            surface should be able to have only the writing surface.
          */}
          <label className="set__row set__row--main">
            <span className="set__label">
              <span className="set__title">Show the margin</span>
              <span className="set__note">
                A hairline down the right of the page, with your marks on it. The panel stays shut
                until you open it. Off, the page is bare and your marks are still everywhere you
                look back.
              </span>
            </span>
            <Switch on={margin} onChange={(v) => { setMargin(v); if (!v) setOn(false) }} label="Show the margin" />
          </label>

          <label className="set__row set__row--main" data-off={!margin ? 'true' : undefined}>
            <span className="set__label">
              <span className="set__title">Let the journal notice</span>
              <span className="set__note">
                It never marks anything itself. What it notices arrives in pencil — it counts for
                nothing and reaches nothing until you keep it. One tap to keep, one tap to say not
                this. Shutting the margin while you write silences it too.
              </span>
            </span>
            <Switch on={on} onChange={setOn} label="Let the journal notice" disabled={!margin} />
          </label>

          <div className="set__reveal" data-on={on ? 'true' : undefined} aria-hidden={!on}>
            <p className="set__group">What it may notice</p>

            <label className="set__row set__row--pick">
              <input
                type="radio"
                name="permission"
                checked={permission === 'used'}
                onChange={() => setPermission('used')}
              />
              <span className="set__label">
                <span className="set__title">Only the kinds you use yourself</span>
                <span className="set__note">
                  Nothing to set up, and nothing to maintain. A kind you have never reached for is
                  never noticed.
                </span>
              </span>
            </label>

            {permission === 'used' ? (
              <ul className="set__kinds">
                {[...DECLARED, ...TOUCH.filter((k) => k.kind === 'quote')].map((k) => {
                  const n = used.get(k.kind) ?? 0
                  return (
                    <li key={k.kind} data-off={n === 0 ? 'true' : undefined}>
                      <Glyph kind={k.kind} size={18} pencil={n === 0} />
                      <span>{k.label}</span>
                      <span className="set__n">{n === 0 ? 'never used — never noticed' : `you have marked ${n}`}</span>
                    </li>
                  )
                })}
              </ul>
            ) : null}

            <label className="set__row set__row--pick">
              <input
                type="radio"
                name="permission"
                checked={permission === 'chosen'}
                onChange={() => setPermission('chosen')}
              />
              <span className="set__label">
                <span className="set__title">Choose them yourself</span>
                <span className="set__note">
                  More control, and one more thing to keep up to date.
                </span>
              </span>
            </label>

            {permission === 'chosen' ? (
              <ul className="set__kinds set__kinds--pick">
                {KINDS.filter((k) => k.family === 'declared').map((k) => (
                  <li key={k.kind}>
                    <label>
                      <input
                        type="checkbox"
                        checked={!!chosen[k.kind]}
                        onChange={() => setChosen((c) => ({ ...c, [k.kind]: !c[k.kind] }))}
                      />
                      <Glyph kind={k.kind} size={18} />
                      <span>{k.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : null}

            {/*
              The promise, in the plainest words available. Both halves are
              load-bearing: the first is D-016, the second is the verdict line.
            */}
            <p className="set__promise">
              It will never mark anything without you, and it will never say what an entry is about.
            </p>
          </div>

          {/*
            A second group, and a different kind of consent entirely. Noticing
            is permission to read; this is permission to assume a practice.
            GUARDRAILS forbids assuming a liturgical calendar in default copy —
            Advent and Lent are broadly held and Ordinary Time is not, and a
            Reformed Baptist opening the app to find it keeping her seasons for
            her is the "guest in someone else's house" test failing.

            So it is off, and the switch is the whole disclosure. Off, a day
            that comes around is just a day that comes around, which needs no
            permission from anybody.
          */}
          <p className="set__group">When something comes around</p>

          <label className="set__row set__row--main">
            <span className="set__label">
              <span className="set__title">Keep the seasons</span>
              <span className="set__note">
                Advent, Lent and Eastertide, and what you wrote in them before. Three occasions in a
                year, not fifty-two — most days it is nothing, and there is no week you can miss.
                Off, a day that comes around is only a day that comes around.
              </span>
            </span>
            <Switch on={seasons} onChange={setSeasons} label="Keep the seasons" />
          </label>
        </div>
      </div>
    </div>
  )
}

function Switch({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className="sw"
      disabled={disabled}
      data-on={on ? 'true' : undefined}
      onClick={() => onChange(!on)}
    >
      <span className="sw__dot" />
    </button>
  )
}
