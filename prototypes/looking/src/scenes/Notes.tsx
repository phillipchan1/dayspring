import { QUESTIONS } from '../semantics'
import { DECLARED } from '../kinds'
import type { RouteId } from '../App'

/**
 * Facilitator only.
 *
 * Carries product names, decision numbers and the fixture's own dishonesty
 * budget — so this never goes on a shared screen. Open it before the call.
 */
export function Notes({ onGo }: { onGo: (id: RouteId) => void }) {
  return (
    <div className="surface">
      <div className="inner">
        <div className="notes">
          <h1>Looking — notes</h1>
          <p className="lede">
            One surface, and the arrangement follows from what you put in the bar. The previous pass
            had ten scenes along the bottom; that row was the tell, because ten named destinations is
            a dashboard and choosing one before you have a question is work.
          </p>

          <div className="warn">
            <p>
              <strong>The semantic leg is a fixture.</strong> No model, no network call. Every “near”
              hit was chosen by hand. Say so if anyone asks — we are testing whether the shape is
              legible, not whether retrieval is any good, and that second question needs a real
              archive.
            </p>
          </div>

          <h2>The one thing to watch for</h2>
          <p>
            Put <strong>Mom</strong> in the bar, then <strong>Prayer</strong>. That intersection — a
            subject and a marking at once — is the prayers she prayed about her mother, in order, and
            nothing in the product can answer it today. It stays legal because both halves are hers:
            she wrote the name, she typed the <code>/pray</code>, and code does the intersection.
          </p>
          <p>
            <button type="button" className="notes__go" onClick={() => onGo('looking')}>
              go to it
            </button>
          </p>

          <h2>There is no mode switcher any more</h2>
          <p>
            <code>pages · lines · braid</code> is gone. Naming three arrangements made you pick one
            before you had a question — the same mistake the ten-scene bar made a level up. The
            arrangement is a <strong>consequence</strong> now:
          </p>
          <ul>
            <li>
              <strong>nothing on</strong> → the wall. For coming across something you don’t have in
              mind (D-022).
            </li>
            <li>
              <strong>a subject on</strong> → that subject’s page. The chapter.
            </li>
            <li>
              <strong>only markings on</strong> → those lines, oldest first, across everything.
            </li>
          </ul>
          <p>
            A marking never changes <em>where</em> you are — it narrows what you are already looking
            at. Mom, then Prayer, stays on Mom’s page and leaves the prayers.
          </p>

          <h2>On sentiment — read this before the call</h2>
          <p>
            The obvious build is a mood line: score each entry about Mom, plot it, show the curve.{' '}
            <strong>It is forbidden three times over</strong> and every one is load-bearing —
            GUARDRAILS H2 (never infer someone’s interior state), Principle 1 (no vertical axis,
            because a vertical axis implies better and worse), and D-016 (the writer supplies the
            signal). A falling curve over a subject called “Mom” reads as{' '}
            <em>you care less about your mother now</em>, rendered by a machine.
          </p>
          <p>
            <strong>A sentiment MARK does not rescue it either.</strong> Declared, it would be legal
            in principle — but it is <code>Sense</code> with a mood attached, and Gift and Absence
            were just cut for being kinds nobody could read off the label. Adding a valence kind
            reintroduces exactly that, and then any arrangement of it over time rebuilds the axis
            Principle 1 forbids.
          </p>
          <p>
            What <em>is</em> sanctioned is her own vocabulary — GUARDRAILS’ approved example is
            literally “‘Angry’ appears in 7 entries this month.” So{' '}
            <strong>the words you used</strong> shows the words on her pages about a subject in one
            span and not the other. No number beside any word, ordered by first appearance, never
            sorted into good and bad, and the page count for each span always on screen.
          </p>
          <p>
            On Mom it returns <em>appointment · routine · sharp · worst · scared</em> before 2025,
            and <em>laughed · garden · tomatoes · held · hand · child · smaller · afternoon</em>{' '}
            since. Nobody scored anything and the shift is unmistakable — which is the whole
            argument: the reader draws it, and per RECALL that is “the most meaningful thing in the
            product precisely because the app didn’t hand it to them.”
          </p>
          <div className="warn">
            <p>
              <strong>The argument still to have.</strong> RECALL takes “the words you use here”{' '}
              <em>off</em> person pages: on a matter it is a portrait of her own interior life, on
              her husband it reads as a portrait of the marriage and a bad month puts a bad word at
              the top. The counter is that the words on her pages about her mother are about{' '}
              <em>her</em> — what she was carrying — and the failure is framing, not fact. Headed
              with the subject’s name it reads as being about the subject; headed “what you were
              carrying” it reads as being about her. That is a real call and it belongs on a call.
            </p>
          </div>

          <h2>Where this fits — scene 2</h2>
          <p>
            <button type="button" className="notes__go" onClick={() => onGo('fit')}>
              where it fits
            </button>
            <strong>Entries is deleted. Pages replaces it, and becomes a Return surface.</strong>{' '}
            The rail holds one thing under Write and four under Return.
          </p>

          <h2>The list is a distance, not a surface</h2>
          <p>
            D-018 deleted the entries list on exactly this reasoning — “the wall beats a 30px row at
            every job the row does.” D-022 reversed it <strong>three days later</strong>, and what
            fired was narrow and real: “browsing for a half-remembered entry becomes reliably
            slower.” A row shows ~25 entries a screen; the wall at its densest shows fewer.
          </p>
          <p>
            D-018’s own kill note said what to do about it, and nobody did it:{' '}
            <em>“an argument for a list-tight end of the zoom rather than for a second surface.”</em>
          </p>
          <p>
            So the list is now the far end of the slider. Same wall, same <code>look for</code>, same
            chapters — at <strong>25px rows, 30 a screen at 900px</strong>, which is measured rather
            than asserted and beats what the panel gave. Push the slider back up and the same pages
            become cards, then leaves. Standing right back inside a chapter gives you that subject’s
            pages as a list, which is what the panel would have had to become.
          </p>

          <h2>Two things changed since D-018 that make the second attempt stronger</h2>
          <ul>
            <li>
              <strong>⌘K Find was never the list’s job and always beat it.</strong> “I know exactly
              what I want” is answered instantly, locally, offline. The list only ever won the{' '}
              <em>half</em>-remembered case.
            </li>
            <li>
              <strong><code>look for</code> did not exist.</strong> D-018’s wall had a lighting bar.
              It had no kept subjects, no markings group, no chapter. “It was about Mom” is usually
              more retrievable than “it was March 2019”, and that path is new.
            </li>
          </ul>

          <h2>The real danger, which is not density</h2>
          <p>
            The panel is currently how you get back to what you were writing. Delete it and the wall
            is the only way back to your own draft — a <strong>Principle 3</strong> problem wearing a
            navigation costume. If returning to today’s entry costs a zoom and a hunt, the editor got
            further away, and the editor is why anyone opens the app.
          </p>
          <p>
            So the newest page is marked <code>today</code> in the rows and its date is lit, and every
            row opens to write on a double-click — the same gesture the cards take.{' '}
            <strong>This is the thing to watch on the call</strong>, not the density.
          </p>

          <h2>And the rail gets sharper</h2>
          <p>
            Write holds one item. That looks thin and is actually the correct statement: the
            product’s thesis is Write versus Return, writing really is one act, and everything else
            is returning. Return holds Pages, Ascent, Lamp, Altar — and SURFACES’ own words say why
            Pages belongs there: the other three “all interpret… <strong>None of them hands back the
            archive. This does.</strong>”
          </p>
          <p>
            <strong>Costs.</strong> Shortcuts renumber (⌘1 Write, ⌘2 Pages, then ⌘3–⌘5). The open
            book moves to Pages. And D-018’s ~2,800 deleted lines come off again — this time with the
            zoom end that was supposed to replace them.
          </p>

          <h2>“look for”, not “filter”</h2>
          <p>
            A filter is something you configure; this is something you do, and the word has to sound
            like the act rather than the machinery. It is the opening of a sentence the chips
            complete — <em>look for · Mom · the prayers</em> — so it carries no box of its own; an
            ink-well surfaces under the cursor instead.
          </p>

          <h2>One type rule</h2>
          <p>
            The sheet had six type styles arguing with each other. One rule now, and it decides every
            case: <strong>serif is her, sans is us.</strong> Her subjects are set in the face the
            journal is written in; everything the app says about them is sans, one size, one weight,
            differing only in opacity. <strong>No mono in the sheet at all</strong> — mono is for
            dates, and a date is a fact about a page rather than part of a control.
          </p>
          <p>
            The corollary is <strong>one shape</strong>: every option is the same pill, whatever it
            does. What varies is a hairline (kept) against a dashed line (noticed), and colour once
            something is on. And the gloss follows the choice — <code>how to read it</code> is four
            plain pills with one line underneath describing the chosen one, because describing every
            option is four explanations for one decision.
          </p>

          <h2>Questions are gone</h2>
          <p>
            The semantic leg is not something we are ready to build, so it is off the surface.{' '}
            <code>semantics.ts</code> stays in the tree with its fixture and its verbatim validator,
            because D-020’s finding is worth keeping written down: <em>a vector hit has no word to
            light</em>, and the answer was to light the nearest <strong>line</strong> and put her own
            sentence on the chip. If it comes back, that is where it starts.
          </p>

          <h2>The results stay in the page view</h2>
          <p>
            Earlier passes swapped the wall for a column of sentences the moment you asked a real
            question, which meant the surface stopped looking like a journal exactly when it got
            interesting. <strong>Everything is cards now</strong> — in date order, in two spans, or
            grouped into stretches. You are always scanning pages.
          </p>
          <p>
            What keeps that honest against “the line is the unit of memory” is that each card{' '}
            <strong>leads with the line that matched</strong>. You get the sentence and the page it
            came from, with its date, which is what a bare list of lines threw away.
          </p>

          <h2>Subject + marking, in the preview</h2>
          <p>
            When both are on the card has to say two things at once — <em>this page is about Mom</em>{' '}
            and <em>this is the prayer you made on it</em> — and saying them in the same channel means
            they compete. So they use different ones:{' '}
            <strong>the marking is colour</strong> (its own tone on the card’s inside edge, its glyph
            in the corner), <strong>the subject is the lit word</strong> inside her sentence. Neither
            restates the other, and there is no badge, label or count anywhere on the page.
          </p>

          <h2>Subjects: keeping, dropping, and the first run</h2>
          <p>
            The fixture now opens with <strong>nothing kept</strong>, because that is the only part
            anyone has to be taught. The group opens on what the journal noticed — six names, all
            correct — with one sentence saying where they came from, and a <code>keep</code> on hover.
            Kept ones carry an <code>✕</code> on hover to drop again.
          </p>
          <p>
            Dropping is safe, and that is what makes keeping cheap: the journal still notices the
            name, nothing she wrote changes, and it is one click from being kept again. That is what
            keeps this from becoming the tag manager SURFACES.md forbids.
          </p>

          <h2>The old filter, and why it went</h2>
          <p>
            Every earlier version put controls between her and her own writing before she had asked
            for anything — a scene bar, then a mode switcher, then two rows of always-on chips. Each
            was quieter than the last and each was still furniture in a room whose whole point is the
            thing on the walls.
          </p>
          <p>
            At rest the surface is one word: <code>filter</code>. What is <em>on</em> shows beside it,
            because state you cannot see is worse than a control you can. What is not on is behind it,
            in three groups, in the order the question actually gets asked:
          </p>
          <ul>
            <li><strong>what subject</strong> — the thing you are looking for</li>
            <li><strong>what markings</strong> — the kind of gesture you made about it</li>
            <li><strong>the thread</strong> — how to read what comes back</li>
          </ul>
          <p>
            The third group is the one that took three passes to place.{' '}
            <strong>then &amp; now is not a filter and not a global mode</strong> — it is a way of
            READING a thread, so it belongs beside the other ways of reading a thread and nowhere
            else. Naming the group is what makes that obvious, and it leaves an honest slot for the
            arrangements we have not built.
          </p>
          <p>
            It is a dropdown, not a filter panel: closed unless asked for, applies as you touch it,
            no Apply, no verb in it anywhere.
          </p>

          <h2>Three ways to read a thread</h2>
          <ul>
            <li><strong>in order</strong> — oldest first, every line. No top eight, ever (D-016).</li>
            <li>
              <strong>then &amp; now</strong> — two spans, no arrow between them. An arrow is a
              vertical axis laid on its side. The entry count for each span stays on screen.
            </li>
            <li>
              <strong>close together</strong> — stretches bounded by silence. A story in a journal is
              not a theme, it is an <em>episode</em>, and an episode has a detectable shape: a burst
              of entries with quiet on both sides. Pure arithmetic — a gap opens a burst, and a burst
              has to be dense, or five entries across three months would count as one and that would
              be the app deciding something happened.{' '}
              <strong>Every heading is a count.</strong> "Five entries in 59 days, after 10 quiet
              months", then one sentence she typed. A title would be a claim about what it was; she
              supplies the word "story".
            </li>
          </ul>

          <h2>The old bar, and why it went</h2>
          <p>
            The previous version put everything behind one field, which was elegant on paper and
            wrong in the hand: you had to <em>know to type</em> before the surface would show you
            what it could do. A field is a recall interface, and this whole product exists because
            people cannot recall what they wrote.
          </p>
          <p>
            So her subjects and her markings are on the bar, always — there are only ever a handful
            of each, and <strong>four subjects is a handful, forty is a filing system.</strong> Typing
            is the escape hatch behind <em>something else</em>: names she has not kept, a matter she
            wants to keep, a question. Most of the time it goes untouched.
          </p>
          <p>
            It is type, not controls. Her subjects are set in the serif the journal is written in
            because they are her words; the markings are small and lettered because they are
            gestures. Nothing has a box around it and there is no verb anywhere.
          </p>

          <h2>The subject page</h2>
          <ul>
            <li>
              <strong>Provenance in one line</strong> — <em>kept</em> or <em>noticed</em>, then the
              counts. Nothing else about a subject is worth a word.
            </li>
            <li>
              <strong>The band</strong> — every month she wrote it. Rhythm and gaps, and{' '}
              <strong>no height anywhere</strong>. A bar chart of mentions-per-month has a Y axis, and
              a falling one reads as <em>you care less about your mother now</em> — a verdict on a
              relationship rendered by a machine. Every cell is the same size; only its warmth
              changes, and warmth has no better and worse. Ramp is the Lamp’s ember→gold.
            </li>
            <li>
              <strong>The rails</strong> — her markings around this subject, ordered by act, never by
              count.
            </li>
            <li>
              <strong>then / now</strong> lives here now, not at the top of the app. “How has this
              changed” is a question about a <em>thing</em>, not about an archive. No arrow between
              the columns, ever (Principle 1), and the entry count for each span stays on screen
              because an uneven comparison reads as a verdict on the thinner side.
            </li>
            <li>
              <strong>Person pages are smaller, deliberately.</strong> GUARDRAILS lets us quote what
              she wrote about someone and forbids characterising them. So no vocabulary portrait (on
              a husband it reads as a portrait of the marriage, and a bad month puts a bad word at
              the top) and no co-occurrence network (the closest thing here to a dossier).
            </li>
          </ul>

          <h2>Subjects: offered, and kept</h2>
          <p>
            RECALL Act one, mechanism 1.2 — <em>it offers, you keep</em> — which it already calls
            probably the strongest. Typing opens one list holding names, markings, offered words and
            questions together, because from where the writer sits those are all just “the thing I am
            looking for”. Whichever you pick, what lands is a chip, and every chip comes off the same
            way. <strong>Asking is not a mode; it is a row in the list.</strong>
          </p>
          <p>
            “You keep writing” is arithmetic, not a recommendation: words appearing in four or more
            separate entries, ordered by first appearance. Kept subjects order by <em>when they were
            kept</em>, never by count — Riverside above Mom at 31 pages to 14 would be the app ranking
            what someone carries.
          </p>

          <h2>The markings, after the cut</h2>
          <p>
            Gift and Absence were removed on 2026-08-26. The six that remain:{' '}
            {DECLARED.map((k) => k.label).join(' · ')}.
          </p>
          <p>
            <strong>Name the casualty rather than hiding it.</strong> “When did I feel far from God?”
            no longer has a <em>declared</em> answer, and that was the best screen in the last pass —
            five marks she made by hand against six pages a machine picked. The declared-versus-
            retrieved argument now runs on <strong>desire</strong> (three sentences, three years, one
            wish). The <code>consolation</code> arrangement in the <code>recollection</code> prototype
            cannot survive this cut at all; the idea was sound and the vocabulary is what failed.
          </p>
          <p>
            In the fixture the existing marks were remapped rather than deleted: gift → story,
            absence → sense.
          </p>

          <h2>Where the fixture is built to lose</h2>
          <p>
            A hand-picked semantic fixture that always wins is a sales pitch. The wrong hits render{' '}
            <strong>identically</strong> to the real ones — no label, no styling. If nobody spots them,
            that is the finding, and it is a finding <em>against</em> this leg.
          </p>
          <ul>
            {QUESTIONS.filter((q) => q.near.some((h) => h.wrong)).map((q) => (
              <li key={q.id}>
                <strong>{q.text}</strong> — the wrong page is{' '}
                <code>{q.near.find((h) => h.wrong)!.entryId}</code>: “{q.near.find((h) => h.wrong)!.quote}”
              </li>
            ))}
            <li>
              <strong>how did I grow this year?</strong> — returns nothing, on purpose. Ask what they
              expected. A search box is the wrong shape for that question, and the empty state is how
              the prototype admits it.
            </li>
            <li>
              <strong>Literal-only pages</strong> are computed in code from each question’s terms,
              never listed by hand, so the comparison cannot be rigged.
            </li>
          </ul>

          <h2>The page-layout argument, on its own screen</h2>
          <p>
            <button type="button" className="notes__go" onClick={() => onGo('leaves')}>
              a page that runs long
            </button>
            Today a page at reading zoom scrolls inside its own box, so you scroll inside a page while
            the wall scrolls behind it. Here it <em>continues</em> onto the next leaf and the date
            prints on the first leaf only — that absence is the whole continuation cue. Flip to{' '}
            <code>scrolls</code> to watch the second scrollbar come back.
          </p>
          <p>
            The cost, named: the wall’s uniform row height is what lets a 3,500-page archive window
            cleanly, and a page now occupies a variable <em>number</em> of fixed-size leaves. Cheap at
            reading zoom specifically, which is where the app version should start.
          </p>

          <h2>Questions worth asking, in order</h2>
          <ul>
            <li>Before anything is shown: “Show me how you’d find something you wrote about last spring.”</li>
            <li>On a semantic hit: “Why do you think this page came back?” — then be silent.</li>
            <li>On <strong>lines</strong>: “What is this?” Then: “Which of these would you have wanted last week?”</li>
            <li>Never: “would you use this?”</li>
          </ul>

          <h2>Banned vocabulary</h2>
          <p>
            This topic attracts every one of them: <em>track, review, insights, score, progress, goal,
            dashboard, analytics, journey, inbox, workflow.</em> None appears on any screen. If one
            comes out of your mouth on the call, the data is contaminated.
          </p>
        </div>
      </div>
    </div>
  )
}
