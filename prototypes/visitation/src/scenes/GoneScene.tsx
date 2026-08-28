import { useState } from 'react'
import { Dawn, Rig } from '../parts'

/**
 * After it has gone — the screen that makes the whole surface legal.
 *
 * ── Tenure, and the rule the product already wrote ──────────────────────────
 *
 * RECALL.md § Tenure: "NO OCCASION MAY ACCRUE. A weekly page that is gone on
 * Monday is a liturgy. The same page still there in March is a chore about
 * someone's prayer life, and no amount of gentle copy fixes it."
 *
 * That is why Dayspring has no weekly review today. Every weekly review anyone
 * has shipped is PENDING tenure — it waits, it counts, and being behind on it
 * is the mechanic. Phil's throwaway detail, "temporary artifacts", is not a
 * nice-to-have. It is the single property that separates this from the thing
 * Principle 2 forbids, and it should be the first line of the spec.
 *
 * ── The test, and it is checkable ───────────────────────────────────────────
 *
 * A hook works by making you feel bad if you do not come back.
 * An occasion works by being there whether or not you did.
 *
 * So the page must expire UNREAD exactly as it expires read, and nothing
 * anywhere may record which happened. No badge, no "you missed", no count of
 * unopened ones, no archive of past ones to fall behind on. If a future build
 * adds a list of previous pages, this surface has become an inbox and the
 * argument is over.
 *
 * ── On "randomised" ─────────────────────────────────────────────────────────
 *
 * Phil framed the draw as randomised-but-insightful — the hook model's
 * variable reward, deliberately. Two problems, and the fix is free.
 *
 * Variable reward IS the compulsion mechanic; calling it insight does not
 * change what it does. And randomising undercuts Principle 4 on its own: if
 * the same span yields a different reading on Tuesday than on Wednesday, the
 * app has admitted the selection was arbitrary.
 *
 * DETERMINISTIC IS BOTH SAFER AND BETTER. The same span always produces the
 * same page. The variety comes from her life differing season to season, which
 * is real variety rather than manufactured — and it means she can show the page
 * to her husband and it is still there, saying the same thing.
 */
const STATES = [
  { id: 'lit', label: 'while it is here' },
  { id: 'gone', label: 'after' },
  { id: 'inbox', label: 'the version that accrues' },
] as const

type StateId = (typeof STATES)[number]['id']

export function GoneScene() {
  const [state, setState] = useState<StateId>('gone')

  return (
    <div className="surface">
      <Dawn />

      <Rig label="tenure">
        {STATES.map((s) => (
          <button key={s.id} type="button" data-on={state === s.id ? 'true' : undefined} onClick={() => setState(s.id)}>
            {s.label}
          </button>
        ))}
      </Rig>

      {state === 'lit' ? (
        <div className="gone">
          <p className="gone__line">Summer is here until September 22, and then it is gone.</p>
          <p className="gone__note">
            Occasional tenure. It exists because of a date and it expires on one. Nothing records whether she
            opened it.
          </p>
        </div>
      ) : null}

      {state === 'gone' ? (
        <div className="gone">
          {/*
            Nothing. Not "your summer page has expired", not "you missed it",
            not a link to bring it back. The absence of a notice is the whole
            design — a notice about a thing that left is a thing that did not
            leave.
          */}
          <p className="gone__line">Nothing is here.</p>
          <p className="gone__note">
            September 23. The page is not archived, not restorable, and not counted. If she kept it, she has it
            on paper — which means the remembering was hers, in a product whose villain is forgetting.
          </p>
          <p className="gone__note">
            Note what is absent: no notice that it went, no offer to regenerate it, no record that she did or did
            not read it. A page that leaves a trace has not left.
          </p>
        </div>
      ) : null}

      {state === 'inbox' ? (
        <div className="gone">
          {/*
            The failure mode, drawn plainly. This is what every weekly review
            in the category looks like after four months, and it is the reason
            the product has never shipped one.
          */}
          <p className="gone__line" style={{ color: '#c49a9a' }}>
            4 readings waiting · Spring, Summer, Autumn, Winter
          </p>
          <p className="gone__note" style={{ color: '#a06a6a' }}>
            Pending tenure. It waits, it counts, and being behind on it is the mechanic — Principle 2, and no
            amount of gentle copy fixes it. This is one product decision away at all times: the moment somebody
            asks "can I see last season's?", this is the answer they are asking for.
          </p>
          <p className="gone__note" style={{ color: '#a06a6a' }}>
            The honest reply to that request is that she can keep any page she wants — on paper, at the time. The
            app does not hold them for her, because a shelf of unread readings about her own prayer life is the
            exact object this product exists not to build.
          </p>
        </div>
      ) : null}
    </div>
  )
}
