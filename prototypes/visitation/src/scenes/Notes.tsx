import { unverifiedCount } from '../fathers'
import { unverifiedQuestions, QUESTIONS } from '../questions'
import { Dawn } from '../parts'
import type { RouteId } from '../App'

/**
 * The facilitator page. Open it before the call, never during it.
 *
 * Everything on it is the stuff that must not be said out loud while someone
 * is reacting to a screen — the names, the doctrine, the seams, and the things
 * we are hoping they notice without being told.
 */
export function Notes({ onGo }: { onGo: (id: RouteId) => void }) {
  return (
    <div className="surface">
      <Dawn />
      <div className="notes">
        <h1>Before the call</h1>
        <p>
          Press <code>S</code> to hide the route bar. Keys <code>1</code>–<code>7</code> switch scenes. Start on{' '}
          <a href="#arrives" onClick={() => onGo('arrives')}>
            arrives
          </a>{' '}
          with the bar already hidden.
        </p>

        <h2>What this surface is now</h2>
        <p>
          Every other Return surface shows you <b>what</b>. None of them does anything with it.{' '}
          <b>This page helps you ask better.</b> That is the whole thesis, and it is what makes the page
          non-redundant — the contribution is not new data, it is a new <i>act</i> performed on data the Altar and
          the Lamp already hold.
        </p>
        <p>
          It also kills the oracle by construction: a page whose output is a question has no answer in it to be
          wrong about. And it threads H4, because counsel, diagnosis and prescription are all assertions, and a
          question is none of the three.
        </p>

        <h2>Never say these words on the call</h2>
        <p>
          <b>Report. Insights. Review. Summary. Council. Fathers. Examen. Therapy. Visitation.</b> PERSONAS.md:
          the instant you explain a feature the data is contaminated. The screen says <b>Spring and summer</b> and
          a year. Let them name it — and write down exactly what they call it, because that is the copy.
        </p>
        <p>
          If they ask what it is, the only sanctioned answer is <b>“it showed up.”</b> Then be quiet.
        </p>

        <h2>The order, and the one question after each</h2>
        <ul>
          <li>
            <b>arrives</b> — let them scroll the whole thing without saying anything. Then: <i>“What is this?”</i>{' '}
            Silence. The second thing they say is the true thing.
          </li>
          <li>
            <b>where the question comes from</b> — start on <i>hers</i>. Ask{' '}
            <i>“is this enough on its own?”</i> before showing anything else.{' '}
            <b>If they say yes, the council does not get built</b>, and you have saved a rights budget and a
            doctrine change for the price of one question. Then <i>from the reading</i>, then <i>one we wrote</i>.
          </li>
          <li>
            <b>the heart (cut)</b> — only if they ask what else was considered. It was legal and it was still cut,
            for redundancy rather than for a guardrail. The mood line lives here too.
          </li>
          <li>
            <b>the statement version</b> — the earlier design, where the tradition supplied statements instead of
            questions. Useful only to show why questions won. Toggle <i>a bridge</i>: it is one sentence and it is
            the whole H4 violation.
          </li>
          <li>
            <b>onward</b> — <i>“What would you write here?”</i> If the answer is “nothing”, the surface has failed
            at the only thing it was for.
          </li>
          <li>
            <b>the same season, 2024</b> — literally the same occasion, three entries instead of eight. Watch
            their face. This is the shame test.
          </li>
          <li>
            <b>after</b> — <i>“What would you want to happen to it?”</i> If they ask to keep them all, say nothing
            and record it; that request is the inbox, and it is the one that kills this.
          </li>
        </ul>

        <h2>What to watch for, specifically</h2>
        <ul>
          <li>
            <b>Do they answer the tradition's question, or resent it?</b> The single most important reaction on
            the call. It is the difference between overhearing someone else's question and being interrogated.
          </li>
          <li>
            <b>Do they notice the two questions that turn?</b> <i>“How much am I supposed to remember for her?”</i>{' '}
            in May, <i>“How much of her do I get to remember?”</i> in August. Same question, three months apart,
            and it moved. Nobody wrote a word about it. If that lands unprompted, the thesis is alive.
          </li>
          <li>
            <b>Can they tell which question came out of a book?</b> On <i>one we wrote</i>, ask before you
            explain. Unlike the mood line, the forbidden version here is invisible by inspection — the only
            defence is provenance, which is why every quoted question carries who it was asked <i>of</i>.
          </li>
          <li>
            <b>Does the expiry read as relief or as pressure?</b> The whole surface's legality rests on that line
            and it has never been tested on a person.
          </li>
          <li>
            <b>Does anyone say “verdict”, “grade” or “score”?</b> Unprompted, that is Principle 1 failing out
            loud, and it is worth stopping the call for.
          </li>
        </ul>

        <h2 className="warn">What is fake, and how badly</h2>
        <p className="warn">
          <b>
            All {unverifiedQuestions()} of {QUESTIONS.length} questions — and all {unverifiedCount()} statements
            on the older route — are unchecked against a printed source. They were written down from memory.
          </b>{' '}
          That is precisely the failure the feature exists to prevent, reproduced inside the prototype that argues
          for it — deliberately, because it is the finding: <b>this is a library problem, not a prompting
          problem.</b> Do not read them to a beta user as though they are quotations. If one gets quoted back to
          you later, that is H3 happening in miniature.
        </p>
        <p className="warn">
          The mood line's numbers are invented outright. A shipped version would have a model produce them, which
          would not make them any more hers — only harder to notice.
        </p>
        <p>
          Everything <i>Anna</i> wrote is verbatim and gated on load. The questions corpus carries one extra gate:
          <b> every row must end in a question mark</b>. It has already fired once, on Augustine's line about
          time, which continues past its question into an assertion — and a passage that lands on an assertion is
          a passage that tells her something. <b>A clean console is the check.</b>
        </p>

        <h2>The arguments this cannot settle</h2>
        <ul>
          <li>
            <b>Which span.</b> Anna writes monthly, so a season is five entries; Phil writes ~26 a month. The span
            is a property of the archive, not a product decision, and nothing here proves which rule picks it.
            That is why <i>arrives</i> and <i>the same season, 2024</i> are the same six months two years apart.
          </li>
          <li>
            <b>Whether quoting the tradition belongs in the product at all.</b> It is the first thing Dayspring
            would ever show a user that is not theirs. That is a doctrine change and it wants a{' '}
            <code>DECISIONS.md</code> row before a line of it is built, not after.
          </li>
          <li>
            <b>P6, and it cannot be designed away.</b> A council is tradition-specific. A Reformed Baptist may be
            delighted by Julian of Norwich or may not. Spreading the corpus across schools is the least we can do
            about it, not a solution.
          </li>
          <li>
            <b>Whether this replaces the Ascent.</b> Do not raise it on a beta call.
          </li>
        </ul>

        <h2 className="warn">One thing that is not a design question</h2>
        <p className="warn">
          Phil's framing included “a voice of spiritual therapy”. The posture is right; the vocabulary is
          dangerous. A therapeutic register invites disclosure the app cannot handle, and <b>D-007 — crisis
          content has no handling — is still open and unimplemented.</b> The moment this surface sounds clinical,
          that gap stops being a logged risk and becomes the thing standing between a user and harm. If this
          direction proceeds, D-007 comes with it.
        </p>

        <h2>Related</h2>
        <p>
          <code>docs/product/VISITATION.md</code> — the frame, the doctrine line, and the falsifiers ·{' '}
          <code>docs/product/RECALL.md</code> § Tenure — where the expiry rule came from ·{' '}
          <code>prototypes/looking/</code> — the wall this sits downstream of
        </p>
      </div>
    </div>
  )
}
