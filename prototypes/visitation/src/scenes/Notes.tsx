import { unverifiedCount } from '../fathers'
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
          Press <code>S</code> to hide the route bar. Keys <code>1</code>–<code>6</code> switch scenes. Start on{' '}
          <a href="#arrives" onClick={() => onGo('arrives')}>
            arrives
          </a>{' '}
          with the bar already hidden.
        </p>

        <h2>Never say these words on the call</h2>
        <p>
          <b>Report. Insights. Review. Summary. Council. Fathers. Visitation.</b> PERSONAS.md: the instant you
          explain a feature the data is contaminated. The screen says <b>Summer</b> and a year. Let them name it —
          and write down exactly what they call it, because that is the copy.
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
            <b>heart</b> — show <i>chambers</i>, then <i>shoji</i>, then the mood line. Ask which of the three they
            would rather have. <b>If they pick the mood line, that is a real finding</b> — do not talk them out of
            it on the call, write it down.
          </li>
          <li>
            <b>council</b> — do not flag the passages. Ask: <i>“Whose voice is this?”</i> Then toggle{' '}
            <i>a bridge</i> and ask whether it changed anything. The bridge is one sentence long and it is the
            whole H4 violation.
          </li>
          <li>
            <b>onward</b> — <i>“What would you write here?”</i> If the answer is “nothing”, the surface has failed
            at the only thing it was for.
          </li>
          <li>
            <b>thin</b> — the same page over three entries. Watch their face. This is the shame test.
          </li>
          <li>
            <b>gone</b> — <i>“What would you want to happen to it?”</i> If they ask to keep them all, say nothing
            and record it; that request is the inbox, and it is the one that kills this.
          </li>
        </ul>

        <h2>What to watch for, specifically</h2>
        <ul>
          <li>
            <b>Do they catch the bad pin?</b> On <i>arrives</i> the passage is pinned to <code>want</code>, and one
            of the two lines carrying it is Mira not wanting to go into school. Augustine on the restless heart
            sits under a four-year-old at the car door. It renders identically to a good pin.{' '}
            <b>If nobody notices, that is a finding against the mechanism</b>, not against the fixture.
          </li>
          <li>
            <b>Does the expiry read as a relief or as pressure?</b> It is the line the whole surface's legality
            rests on and it has never been tested on a person.
          </li>
          <li>
            <b>Do they scroll past the questions?</b> They are the only movement already addressed to somebody.
            If they skim them, the “fuels prayer” claim is decoration.
          </li>
          <li>
            <b>Does anyone say the word “verdict”, “grade”, or “score”?</b> Unprompted, that is the surface
            failing at Principle 1 and it is worth stopping the call for.
          </li>
        </ul>

        <h2 className="warn">What is fake, and how badly</h2>
        <p className="warn">
          <b>
            All {unverifiedCount()} passages are unchecked against a printed source. They were written down from
            memory.
          </b>{' '}
          That is precisely the failure the feature exists to prevent, reproduced inside the prototype that argues
          for it — deliberately, because it is the finding: <b>the council is a library problem, not a prompting
          problem.</b> Do not read them to a beta user as though they are quotations. If one gets quoted back to
          you later, that is H3 happening in miniature.
        </p>
        <p className="warn">
          The mood line's numbers on <i>heart</i> are invented outright. A shipped version would have a model
          produce them, which would not make them any more hers — only harder to notice.
        </p>
        <p>
          Everything <i>Anna</i> wrote is verbatim from the corpus and gated on load: a quote that stops being a
          substring of her paragraph logs loudly and the console stays clean otherwise. Same gate as{' '}
          <code>looking</code> and <code>recollection</code>.
        </p>

        <h2>The arguments this cannot settle</h2>
        <ul>
          <li>
            <b>Which span.</b> Anna writes monthly, so a month is one page and a season is five. Phil writes ~26 a
            month. The span is a property of the archive, not a product decision, and nothing here proves which
            rule picks it.
          </li>
          <li>
            <b>Whether the council belongs in the product at all.</b> It is the first thing Dayspring would ever
            show a user that is not theirs. That is a genuine doctrine change and it wants a{' '}
            <code>DECISIONS.md</code> row, not a prototype.
          </li>
          <li>
            <b>Whether this replaces the Ascent.</b> Do not raise it on a beta call. It is an internal question
            and the answer depends on what they say about <i>arrives</i>, not on what they say about the Ascent.
          </li>
        </ul>

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
