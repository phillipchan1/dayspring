/**
 * Notes for whoever is running the call. Never shown on the screen share —
 * press S to hide the scene bar, and stay off this page.
 */
export function Facilitator() {
  return (
    <div className="desk">
      <div className="notes">
        <div className="leaf leaf--flat">
          <p className="eyebrow">before you share the screen</p>
          <h1 className="title">Notes</h1>
          <p className="lede">
            Keys <b>1–9</b> switch scenes, <b>S</b> hides the bar, <b>?</b> comes back here. Open
            this page before the call, not during it. <b>t</b> is the tenure table — also
            facilitator-only, also never on the share.
          </p>

          <h2 className="notes__h">Ask these first. Show nothing yet.</h2>
          <ol className="notes__ol">
            <li>When was the last time you went back and read something you wrote a year ago? What made you do it?</li>
            <li>Show me how you'd find something you wrote about last spring. <i>Watch what they reach for — it separates "the tool is missing" from "the tool is hidden", and it costs one question.</i></li>
            <li>When you're looking back through your own journal, what are you actually looking for?</li>
          </ol>

          <h2 className="notes__h">Then walk it</h2>
          <p className="notes__p">
            <b>2 marking</b> → <b>3 pencil</b> (opens <i>off</i> — that is the editor as it ships;
            everything else on that screen is something a person went and turned on, at{' '}
            <b>, settings</b>) → <b>4 margin</b> → <b>5 edge</b> → <b>6 wall</b> →{' '}
            <b>7 register</b> → <b>8 after</b> → <b>9 episodes</b> → <b>0 sit down</b>. Then the
            ways of looking back: <b>m moment</b> → <b>g returning</b> → <b>l liturgy</b> →{' '}
            <b>c comes to you</b> → <b>a again</b> → <b>w the word</b> → <b>b consolation</b> →{' '}
            <b>o around now</b> → <b>v the words you use</b> → <b>q what you asked</b>. That is ten,
            which is too many for one call — <b>t tenure</b> is where to pick four before you dial.
            Show <b>c comes to you</b> immediately before <b>a again</b>, always: the repeat only
            lands if they have just seen the thing being repeated. On <b>6 wall</b>,
            scroll to 2024 — the thin stretch is the honest case and it is the one worth their
            reaction. On <b>5 edge</b>, touch a kind and let them watch the rest go quiet before you
            say anything. On <b>3 pencil</b>, run it once on <i>it offers</i> and once on{' '}
            <i>it decides</i> without telling them what changed, and ask which one they just watched.
          </p>

          <h2 className="notes__h">Rules</h2>
          <ul className="notes__ul">
            <li>Never pitch. The instant you explain a feature the data is contaminated.</li>
            <li>Never ask "would you use this?" People say yes to be kind.</li>
            <li>
              After each scene ask only <b>"what is this?"</b> — then be silent. The second thing
              they say is the true thing.
            </li>
            <li>Record verbatim phrases. They become the copy, and they will be better than ours.</li>
          </ul>

          <h2 className="notes__h">What each scene is trying to be wrong about</h2>
          <ul className="notes__ul">
            <li>
              <b>marking</b> — falsified if the kinds feel like a decision they have to make while
              writing. The plain mark has to stay one gesture with nothing attached.
            </li>
            <li>
              <b>pencil</b> — opens off. Two axes, both live arguments. <b>When:</b> Principle 3 forbids
              suggestions in the composing surface outright, so <i>as you write</i> is here to make
              the cost feelable, not because it is allowed — watch whether the margin pulls their
              eye off the sentence they are still typing. <b>How:</b> D-016 rejected model-inferred
              significance, so <i>it decides</i> is the rejected shape built so it can be looked at.
              Falsified if they cannot feel the difference between offering and deciding — because
              then pencil is a distinction only we can see, and the whole defence collapses.
            </li>
            <li>
              <b>margin</b> — falsified if they cannot tell a verse from a prayer from a story
              without the labels. Then the hands are decoration, not language.
            </li>
            <li><b>edge</b> — falsified if it reads as decoration, or if a gap reads as shame.</li>
            <li>
              <b>wall</b> — falsified if leading with the first lines reads better than leading with
              what they marked. That is a real and very cheap finding; the toggle is there for it.
            </li>
            <li>
              <b>register</b> — falsified if they want it long. Five is a handful; forty is a filing
              system.
            </li>
            <li><b>after</b> — falsified if the pairing reads as the app editorialising, or as false comfort.</li>
            <li><b>episodes</b> — falsified if the bursts do not line up with anything they would call an event.</li>
            <li><b>sit down</b> — falsified if it reads as a slideshow.</li>
          </ul>

          <h2 className="notes__h">Ways of looking back</h2>
          <p className="notes__p">
            Each is a different answer to <i>what do you arrange marks by</i> — not a visual
            variation. The one they were replacing grouped by kind, which is a filing decision: it
            put a verse, a prayer and a learning from the same eleven days into three separate
            sections, which is the least useful thing available.
          </p>
          <ul className="notes__ul">
            <li>
              <b>m moment</b> — marks of different kinds that landed close together. Not time-based:
              a moment does not expire and you can always walk back in. The line down the left is
              real days, so a tight moment looks tight. Every heading is a count, because a title
              would be a claim about what it was. <i>Falsified if</i> they read a cluster as
              coincidence — "that was just a busy week."
            </li>
            <li>
              <b>g returning</b> — the same thing said again, at several dates. Also not time-based.
              Every row is the same size, because a size difference would rank moments of someone's
              life, and the repeated words are lit so it shows its work.{' '}
              <i>Falsified if</i> seeing the same thing three times reads as <i>you have not moved</i>.
            </li>
            <li>
              <b>l liturgy</b> — this is the time-based one, and the answer to "not a dashboard, not
              a novel". A dashboard is simultaneous and complete; a novel is prose someone else
              wrote; a liturgy is a fixed order you move through, which narrates nothing and ends in
              prayer. The order is the Examen's. <i>Falsified if</i> they reach to skip ahead —
              wanting to skim means it should have been a page.
            </li>
            <li>
              <b>c comes to you</b> — the null hypothesis, and it earns its place by possibly
              killing the other three. Judy reflects <b>twice a year</b>, which is a real argument
              that a destination sits unvisited. The app says nothing here on purpose: a hairline, a
              date, their own sentence. <i>Falsified if</i> it reads as interruption or as the app
              watching them — this one can fail as <i>creepy</i> rather than as useless, which is a
              separate signal worth catching.
            </li>
            <li>
              <b>w the word</b> — one line, and the whole screen. The desert's own unit of memory is
              a single saying: a monk asks an elder for a word and carries the answer for years. Not
              a shorter result — one sentence and nothing else to look at, which is the only thing
              here that takes Kristi's constraint all the way down. The way on is delayed on
              purpose; a next control available immediately makes it a slideshow.{' '}
              <i>Falsified if</i> the first thing they do is hunt for more.
            </li>
            <li>
              <b>a again</b> — the same line, served a second time. The Exercises do not advance to
              new material; the second and third contemplations repeat the first, and lectio chews
              one line. Every other arrangement here computes a fresh selection each time she
              arrives, which is software's instinct and the opposite of the practice. The earlier
              pick is <b>derived</b> — comes-to-you's own rule run six weeks back — so this is the
              app's real behaviour rather than a story about it. The toggle is whether it admits
              what it is doing. <i>Falsified if</i> "I have seen this" is a complaint rather than a
              recognition.
            </li>
            <li>
              <b>b consolation</b> — where He seemed far, and the last thing she called a gift.
              Ignatius tells the person in desolation to remember that the consolation was real, and
              that instruction is addressed to exactly the one person who cannot carry it out:
              finding it means paging back through a year, which is the reread both interviews
              refuse. Both ends are declared — she marked the absence, she marked the gift — and the
              app writes nothing between them. <b>Deliberately one-way:</b> Rule 10 runs the other
              direction too and we are not building it, because an app raising a shadow while she is
              glad is not the same act as a director doing it. <b>Press "another" through to the two
              oldest</b> — January 2025 and June 2024 both come before she had marked a single
              gift, so there is nothing to set beside them and the honest render is the absence on
              its own. Two of five. That is the case worth their reaction, and it is also the
              answer to "what does this do in a dry year": nothing, plainly. <i>Falsified if</i> it reads as a consolation prize, which
              is counsel.
            </li>
            <li>
              <b>o around now</b> — the tradition's answer to <i>when</i> is a calendar that
              returns, not a review you owe. Advent arrives whether or not she was faithful, and
              then it leaves. Three variants, because the argument is what the occasion belongs to:{' '}
              <i>this day</i> names no season and needs nobody's permission; <i>this season</i> is
              opt-in because GUARDRAILS forbids assuming a practice, and is blank most of the year,
              which is a property and not a bug; <i>where she has been before</i> uses no calendar
              at all and will be sparse. Move the anchor to see each one fire and not fire.{' '}
              <i>Falsified if</i> the date reads as coincidence — or, for the seasons, if a reader
              from another tradition feels like a guest.
            </li>
            <li>
              <b>v the words you use</b> — the growth question with no axis in it, and the only
              thing in the product that can answer "I'm doing the same thing this year that I was
              last year" without rendering a verdict. Sanctioned by GUARDRAILS' own example. No
              number beside any word and the order is first appearance, because a frequency ranking
              would make order into significance. <b>Watch the entry counts:</b> measured on this
              fixture, two years against the two before gives 59 started and 9 stopped — which is
              not a change in how she writes, it is 36 entries against 11. An uneven comparison
              reads as a verdict on the thinner side, so the counts are on the screen.{' '}
              <i>Falsified if</i> the lists come out as circumstance.
            </li>
            <li>
              <b>q what you asked</b> — <b>bring this as an argument, not a recommendation.</b> The
              arithmetic is clean: a line ending in a question mark is a fact, and all of them are
              here in the order she wrote them. The risk is the shape. A question asked four times
              across two years and never again has a visible last date, and a reader supplies the
              word "answered" — which is right when she supplies it and forbidden when the app does.
              So nothing here says <i>answered</i>, <i>resolved</i> or <i>no longer</i>, and the
              groups are never separated by whether she is still asking. Ask directly whether the
              arrangement already says too much on its own.
            </li>
          </ul>
          <p className="notes__p">
            <b>Ask after each:</b> "what is this?" — then be silent. And once, at the end: "which of
            these would you have opened last week?"
          </p>

          <h2 className="notes__h">Standing, or an occasion — and the sharper version</h2>
          <p className="notes__p">
            The material is <b>standing</b> and the occasion is <b>time-based</b>. Moment and
            returning carry no week/month/year control at all — a thing carried for two years does
            not belong inside a week, and nothing here should ever be something you can be behind
            on. Only the liturgy has a horizon, because a liturgy has an occasion. That split is the
            reason there is no "you missed last week's review", which would be guilt, and guilt is
            the one mechanic this product committed never to build.
          </p>
          <p className="notes__p">
            The question was framed as <i>a place you go, or a thing that arrives</i>, and that axis
            turns out not to be the load-bearing one. <b>Tenure</b> is: how long a page exists, and
            whether it can pile up while she is not looking. Permanent pages hold still and grow;
            occasional pages expire; ephemeral pages are stored nowhere at all. The fourth —{' '}
            <b>pending</b>, a page that waits — is the inbox with a nicer name, and it is the only
            one that can produce guilt. Hence the rule: <b>no occasion may accrue.</b> A weekly page
            gone on Monday is a liturgy; the same page still there in March is a chore about
            somebody's prayer life. Full table on <b>t</b>.
          </p>

          <h2 className="notes__h">Two kinds a spiritual director would add</h2>
          <p className="notes__p">
            <b>Gift</b> — the Examen opens with gratitude, and every other kind in the set is either
            effortful or interior. Nothing else in the product can hand back joy.
          </p>
          <p className="notes__p">
            <b>Absence</b> — where He seemed far. The tradition takes the dark night entirely
            seriously and never treats it as failure, and without this a dry season has nowhere to
            go but silence. Its glyph is a line with a <b>gap</b> in it, never an X: absence is a
            gap, not a mark against you. Declared only — inferring that God felt absent to someone
            is a verdict on their interior life. Never counted, never trended, and never shown
            against Gift as a proportion.
          </p>
          <p className="notes__p">
            <b>Deliberately cut:</b> a rule of life or resolve — that is a habit tracker, and VISION
            says never. And consolation/desolation as a scored axis — Ignatius's own category, but
            an app scoring it is exactly what Principle 1 forbids.
          </p>

          <h2 className="notes__h">What the noticing buys</h2>
          <p className="notes__p">
            Coverage, and coverage is what makes a review possible at all. D-016 measured the real
            archive: emphasis in 16% of entries, blockquotes in 4%. A weekly review built only from
            what someone marked unprompted is empty most weeks — and Principle 5 says show the
            truth rather than pad, so it would ship as honest emptiness. Noticing raises the
            coverage; keeping is what leaves every item in the review writer-supplied.
          </p>
          <p className="notes__p">
            That closes a loop the product does not have today: <b>it notices → you keep → the
            review is made of what you kept → the review is worth opening → you keep more.</b>{' '}
            D-016's own line was that nobody bolds a sentence for significance when nothing reads it
            back. The four ways of looking back are what read it back.
          </p>

          <h2 className="notes__h">The opt-in, and what it does not buy</h2>
          <p className="notes__p">
            It is off, and off is the default the product would ship. That answers Principle 3 on
            its own terms — the principle's test is whether a change touches the editor's render or
            input path, and a feature nobody has turned on does not. The default writing surface
            stays exactly as sacred as it was.
          </p>
          <p className="notes__p">
            It does <b>not</b> answer D-016. Consenting to be judged is still being judged; a switch
            cannot turn a verdict into evidence. So <i>it decides</i> is no more legal switched on
            than it was before. The switch gates <i>when</i>, pencil gates <i>what</i>, and they
            stack rather than substituting for each other.
          </p>
          <p className="notes__p">
            <b>Two shapes of consent are on the settings screen.</b> A checkbox per kind is control
            with upkeep — and upkeep is exactly what killed Judy's index sticker. The other is{' '}
            <i>only the kinds you use yourself</i>: it may offer a Story because you have marked
            eleven, and it will never offer a Quote because you have never marked one. Nothing to
            set up, and the permission traces to something you actually did. That is the one to
            watch them react to.
          </p>
          <p className="notes__p">
            <b>The cost, named rather than buried:</b> Kristi did not find the slash commands for
            two or three weeks. Off-by-default in a settings pane is the safest place to put
            something and the least findable, and there is no version of this where that trade goes
            away. Worth asking directly: would you ever have gone looking for this?
          </p>

          <h2 className="notes__h">Pencil and ink</h2>
          <p className="notes__p">
            A marking the writer made is in <b>ink</b>. One the app proposes is in <b>pencil</b> —
            graphite, dashed, and not a marking yet: it carries no weight, appears in no count, and
            reaches no other surface until it is kept. Keeping is the writer supplying the signal,
            which is what leaves D-016 standing. <b>Not this</b> is one tap, costs nothing, and says
            nothing back — an easy, dignified no is what keeps every yes honest.
          </p>
          <p className="notes__p">
            <b>Desire</b> is the new kind and the one most worth arguing about. Declared, it is the
            strongest signal in the set. Inferred, it is the most dangerous thing in the product — a
            machine deciding what someone wants is a characterisation of their heart, which
            GUARDRAILS H2 forbids. So it is exactly the kind where pencil-versus-ink decides whether
            any of this is legal. If one kind should never be proposed, ask them which.
          </p>

          <h2 className="notes__h">The corpus</h2>
          <p className="notes__p">
            Fictional. Anna, 47 entries, 2023–2026 — the same woman as the other click-through, so
            you can walk both without a discontinuity. Two shapes are deliberate: a thin stretch
            from March to August 2024 with almost nothing marked, and a burst of five entries in
            fifty-nine days that autumn after ten quiet months. Every quote in a margin is a
            verbatim substring of the paragraph beside it, checked on load.
          </p>
        </div>
      </div>
    </div>
  )
}
