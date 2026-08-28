# Visitation

A page that arrives for a span of time, and then is gone. Slug `visitation`, served
at `/visitation/`. A click-through for a screen-share, not a self-guided link.

```bash
npm install && npm run dev     # → localhost:5190/visitation/#arrives
```

`S` hides the route bar before you share. `#notes` is the facilitator page — open it
before the call, never during it. Keys `1`–`6` switch scenes.

**Never say "report", "insights", "review", "council" or "visitation" on a call.** The
screen says *Summer* and a year. PERSONAS.md: the instant you explain a feature the data
is contaminated. Let them name it, and write down the words they use.

---

## The name

Luke 1:78 — *"the dayspring from on high hath visited us."* The product is named after
the visit; this is the surface that behaves like one. A visitation arrives, is not
asked for, does not stay, and is not owed. Every one of those turns out to be a
constraint rather than a metaphor.

---

## What Phil asked for, taken apart

The idea arrived as one thing. It is seven, and they do not all survive, so separating
them is most of the work:

| | | Verdict |
|---|---|---|
| **A** | A page covering a span of time | **Build.** It is the VISION three-year picture, and nothing else in the product is shaped like it. |
| **B** | A diagram of the heart — sentiments and emotions felt | **Decline as posed, and the legal version is better.** See below. |
| **C** | A council of contemplative fathers, quoted, never impersonated | **Test.** Genuinely novel, and it needs a doctrine change written down first. |
| **D** | Temporary, not editable, savable as PDF or image | **Build — and it is load-bearing.** This is the property that makes the whole surface legal. |
| **E** | Forward it into a new entry to reflect on | **Build.** The strongest idea in the set, and the only Return→Write path in the app. |
| **F** | The entries that support it | **Already the architecture.** |
| **G** | Replaces Ascent, Threads, maybe parts of Lamp | **Threads yes, Ascent maybe, Lamp no.** |
| **H** | The hook model, without being addictive — randomised but insightful | **Decline the mechanism, keep the goal.** The tradition already solved this. |

---

## D is the one to notice first

Phil put "temporary artifacts" in as a detail about export. It is the load-bearing beam.

RECALL.md § Tenure already worked out why the product has no weekly review:

> **No occasion may accrue.** A weekly page that is gone on Monday is a liturgy. The
> same page still there in March is a chore about someone's prayer life, and no amount
> of gentle copy fixes it.

Every weekly review anybody has shipped is **pending** tenure — it waits, it counts, and
being behind on it is the mechanic. An **occasional** page that simply expires has none
of that, and the tradition's own scheduling works exactly this way: Advent arrives
whether or not you were faithful, and then it leaves.

So the expiry is not a nicety, it is the licence. It should be the first line of the
spec and it is stated at the top of the artifact itself, in the app's own voice, because
a rule you hide is a rule you are embarrassed by.

**The test, and it is checkable:**

> A hook works by making you feel bad if you do not come back.
> An occasion works by being there whether or not you did.

The page must expire **unread** exactly as it expires read, and nothing anywhere may
record which happened. `#gone` holds all three states, including `the version that
accrues` — what this becomes the day somebody asks "can I see last season's?".

### And "randomised" is worse than deterministic, on our own terms

Variable reward *is* the compulsion mechanic; calling it insight does not change what it
does. It also quietly breaks Principle 4: if the same span yields a different page on
Tuesday than on Wednesday, the app has admitted the selection was arbitrary.

**Deterministic is both safer and better.** The same span always produces the same page.
The variety comes from her life differing season to season, which is real variety rather
than manufactured — and it means she can show the page to her husband and it is still
there, saying the same thing.

---

## B: the heart, and the three rules it walks into

"A diagram of a heart — the sentiments and emotions you felt." Every word of that is
right about the *want* and wrong about the *mechanism*, in a way the codebase has
already litigated twice.

An inferred-sentiment view is forbidden three times over, and each is independently
fatal:

- **GUARDRAILS H2** — never infer someone's interior state.
- **Principle 1** — no vertical axis, because a vertical axis implies better and worse.
  A falling line beside a span containing her mother reads as *you are doing worse*.
- **D-016** — the writer supplies the signal. Recurrence is a count; significance is a
  verdict.

`looking/README.md` also killed the obvious rescue: a **declared** sentiment mark is
still "Sense with a mood attached", and any arrangement of it over time rebuilds the
axis Principle 1 forbids.

`#heart` → **the one we cannot build** renders the mood line properly, at full fidelity,
with the three rules printed under it. A strawman proves nothing on a call, and Phil
will meet the real version in somebody else's app anyway.

### What survives is stronger, and it was already in the product

The heart is **not a diagram of your emotions. It is the shape of what you declared.**
Six chambers, six declared kinds — `/pray`, `/desire`, `/sense`, `/story`, `/learned`,
`/scripture`. Every line in it is an act she named with her own hand while writing.

She cannot dispute it, which is exactly what an inferred version could never claim.

Three constraints, all load-bearing:

- **Every chamber is the same size.** Sizing by count would make the biggest cell the
  biggest thing in her heart, which is a portrait, and a portrait is the most total
  verdict a machine can render about a person.
- **The count is printed.** A number you can read is arithmetic; a shape you can only
  feel is a claim.
- **Brightness is recency** — the Covenant sky's own encoding, Principle 1 verbatim.
  Dim means *a while ago* and means nothing else, and the page says so in one clause,
  because an unexplained visual encoding is what a reader fills in with a verdict.

### Shoji, and why it is the better of the two

`#heart` → **shoji** is the same six facts as light through a screen, and the word turns
out to carry the argument:

> **A chamber has an inside.** Rendering "what is inside your heart" implies the app has
> seen in there, and that implication does damage even when every line is verbatim. A
> screen has no interior — only panels, and however much light comes through each.

**Cost, named:** it is dark, so it either forces a dark inset into a page that prints or
the page stops printing well. That is a real conflict with this surface's own
light-on-dark argument, which is why it is a reading to choose between rather than a
second movement to add.

---

## C: the council, and the doctrine change it needs

This is the most novel idea in the set and the most dangerous, and it needs a
`DECISIONS.md` row before a line of it ships — because it is **the first thing Dayspring
would ever show a user that is not theirs.**

The rule that makes it possible:

> **Two grounded corpora — hers and the church's — and nothing between them.**

A passage is as verbatim, as cited, and as un-generated as one of her own sentences. It
comes out of a table. What is forbidden is the sentence that would sit *between* the
two: any bridge, gloss, application, or "this may speak to your season."

`#council` → **a bridge** writes that sentence and strikes it through. It is worth
seeing how small the violation is — one warm, helpful sentence that any product manager
would wave through, and it converts the whole arrangement from a quotation into counsel.
It is also **the only sentence on the entire surface that traces to no row.**

### The model is not in this loop, and that is the point

The obvious build is: embed the span, embed the corpus, return the nearest passage. It
fails H4 on contact. **Selection is counsel** — if the app reads a dry season and reaches
for a passage on perseverance, it has told her what her dry season means and what to do
about it, and Chrysostom's voice does not launder that. It makes it worse, because now
the advice arrives with sixteen centuries of authority behind it.

So the join is arithmetic, in three hops, all auditable:

```
a word she wrote  →  a theme (fathers.ts LEXICON, editorial, fixed)
                  →  passages carrying that theme (fathers.ts tags)
```

No embedding, no model call, no network. Two properties fall out that matter more than
accuracy:

- **It is the same for every user.** A model choosing per-person is characterising a
  person. A lookup table cannot characterise anybody — it does not know who you are.
- **The pin is always on screen.** Every passage carries the word of hers that reached
  it. If the pin is wrong, it is *visibly* wrong. A model-selected passage offers
  nothing to check.

### Not a séance

Nobody is given a voice, an avatar, a persona, or a second-person address. There is a
passage, a name, a date, a book, and a translator — the apparatus of a quotation, which
is what keeps it a quotation. H1 is the reason this matters more than it looks: a
fabricated saint counselling a reader in the second person is the divine-voice failure
at one remove.

### Silence is a result

A word with no theme, or a theme with no passage, gets **nothing**. Principle 4 is called
"grounded, **or silent**" and the second half is the half everybody drops. On this
fixture `maybe` is one of the loudest words in her year — *"Maybe it is that I am still
here, still asking"*, *"I said maybe, which was a coward's answer"* — and the reading has
nothing for it. Leaving it bare is the feature working. Reaching one shelf over is how
every quotation engine ever built became a fortune cookie.

### The corpus is the feature

**All 13 passages in this fixture are unchecked against a printed source.** They were
written down from memory — which is precisely the failure the feature exists to prevent,
reproduced inside the prototype that argues for it. That is deliberate, and it is the
finding:

> **The council is a library problem, not a prompting problem.**

Patristic quotation on the internet is a swamp; a large share of what circulates under
Augustine's name he never wrote. A fabricated father is a worse H3 failure than a
misquoted verse, because there is no concordance in the reader's head to catch it — she
will retell it. Building this for real means someone sitting with public-domain editions
and typing, and the work is measured in weeks.

`validateCouncil()` cannot check a quote against a book. What it *can* check is that the
corpus never quietly loses the thing that makes it checkable — a citation, an edition, a
theme that reaches something. A row that has stopped being auditable is a row that has
started being model memory with extra steps. **A clean console is the check.**

### And the rights problem underneath it

`edition` is a required field because **the translation is the part that is owned.**

- Safely public domain, and Victorian: Ante-Nicene Fathers (1885), Pusey's Augustine
  (1838), Warrack's Julian (1901), Longfellow's Teresa.
- In copyright, and what a modern reader actually wants: Ward's desert fathers above all.

**The real choice is archaic-and-free or contemporary-and-licensed**, and it is a
decision with a budget attached. It should be made before a line of this ships. Note
what it does to Phil's "first century" instinct: the genuinely first-century Christian
corpus outside the New Testament is tiny — 1 Clement, the Didache, Ignatius' letters.
The range is in the first four centuries plus the desert, and the desert sayings are the
best fit anyway: short, concrete, non-doctrinal, and already named in RECALL's `the word`
mechanism.

### The cost nobody can design away

**P6 — their words, their theology.** A council is tradition-specific. Selecting Julian,
or Teresa, or Ignatius carries freight, and GUARDRAILS' test is *"would a thoughtful
Christian from a tradition different than Phil's read this and feel like a guest in
someone else's house?"* A Reformed Baptist may be delighted or may not.

Mitigations exist — broadly-received writers, opt-in, the council visible and named —
but this is a real cost and it should be named rather than solved away. It is the
strongest argument for opt-in.

---

## E is the best idea in the set

> **The last thing on the page is a blank page.**

Phil's framing was *"not to be an oracle but to funnel and fuel prayer."* Intent does not
survive contact with a surface; **structure** does. A page that ends in a conclusion has
told her what her season was. A page that ends in the editor has handed her back her own
material and got out of the way.

It also closes a loop the product has never had. SURFACES splits Write and Return and the
arrow only ever points one way. This is the **only Return→Write path in the app.**

`#onward` holds three versions of what goes in the new entry:

- **her line** — her own most recent question, verbatim, as a blockquote with its date,
  then the cursor. Pages.css rule 1 holds: nothing but the writer's words, their date,
  their markings.
- **a prompt we wrote** — fluent, warm, and the moment the app co-authored her prayer
  life. H4, and the first line in her journal that is not hers. There is no undo.
- **nothing at all** — safest, and throws away the only thing the page was for.

**Note what is absent from the artifact: no share button, no image card, no link.**
Principle 1 says a screenshot of this must not be a scoreboard, and the surest way is to
not build the affordance that wants one. Export is for her — and there is a nice
inversion in it: the app forgets the page; *she* is the one who keeps it, in a product
whose villain is forgetting.

---

## The thin season — `#thin`

The same page over three entries, and the most important screen nobody would build.

Principle 5: *"we would rather show an empty state that tells the truth than a
manufactured insight that impresses."* So the threshold is printed, the arrangement
stops, and the page does **not** say she wrote less than usual, did not keep it up, or
has been away. Absence is not ours to interpret (H2).

What it still does is hand back the pages themselves, which costs no model and no
threshold — so even the thinnest occasion pays out something real. That is Principle 5's
own corollary: **design for the dip.**

On the fixture the pages are *"Tired. Nothing to say. Writing it down so the page is not
empty."* and *"I have not written since March."* Watch their face. This is the shame
test, and it is the highest-value guardrail check in the whole prototype.

**And never a comparison.** Not entry counts, not marking counts, not words. A delta at
the top of a recurring page is a streak counter wearing vestments, and Principle 2 does
not care what it is wearing. The scope line says *5 pages*; it never says *down from 14*.

---

## Small decisions that are actually rules

- **The occasion is a season and a year, never a name for what the season was.** "Summer"
  is when it happened. "A Season of Waiting" would be the app telling her what it meant.
- **The dates on the page are her dates, not the calendar's.** The span runs June 1 –
  August 31; the line reads *June 3 – August 16*, because those are the days she wrote.
  Printing the calendar bounds frames the season as a container she partly filled — and a
  container you partly filled is one you partly failed to fill.
- **The chamber quote is the most recent of its kind, not the best one.** Recency is
  arithmetic; "the best" is selection, and selection is significance, and significance is
  a verdict.
- **One passage, once.** The first build let `keep` and `still` both reach Abba Moses's
  cell, four inches apart. Two of her words answered by one sentence reads as the machine
  having a single trick, and it retroactively cheapens the pin that was good.
- **Names are not vocabulary.** *Mira*, *David* and *Mom* came out of "the words you kept
  saying" — a name is a person, and people are handled by subjects, which have their own
  rules about somebody who consented to nothing. Leaving them in would have made this a
  second, weaker person-view that skips those rules.
- **The stop list removes closed-class words, never dull ones.** Its first draft held
  *still*, *want*, *keep* and *time*, which is most of what her summer is about. Nothing
  that carries meaning comes out, even when it is common — so `said` and `told` stay in,
  and that is the correct direction to be wrong in.
- **Every question, in date order, never grouped by whether it is still being asked.**
  A reader supplies the word *answered*, and it is theirs to supply.

---

## Elegance, and where it is deliberately absent

- **The app is dark and this page is lit.** It is the only lit thing in Dayspring. A
  surface you go to should look like the app; a thing that arrives should look like it
  came from somewhere else, and the cheapest honest way to say that is light. It also
  settles a build question for free: **this page prints**, with no second stylesheet.
- **The dawn** — one warm radial behind the sheet. You should not be able to say what it
  is, only notice the page looks lit from behind rather than pasted on.
- **Warm shadow, never black.** A neutral drop shadow on a dark ground reads as a hole,
  and a page is not a hole.
- **Serif is her. Sans is us. Mono is a date.** Inherited from `looking`. Extended by
  one line: **display is the occasion**, used exactly once, on the span's name. A second
  use of Fraunces turns an occasion into a brand.
- **The expiry never counts down.** No "2 days left", no colour change as it nears. A
  date, once.
- `prefers-reduced-motion` removes every transform.

## Rules every screen holds

- No vertical axis anywhere. The only element with a height encoding is the mood line,
  which exists to be pointed at.
- Nothing on a page but the writer's words, their date, and their markings.
- Nothing compares this span to the last one.
- Nothing accrues. No archive, no backlog, no record of what was read.
- Banned vocabulary: *report, insights, review, track, score, progress, goal, dashboard,
  analytics, journey, inbox, workflow.*

## The corpus

Anna, 47 entries, 2023–2026 — carried over from [`../looking/`](../looking/), which took
it from [`../recollection/`](../recollection/) and [`../recall/`](../recall/). Same woman,
same voice, so a follow-up call can walk both prototypes without a discontinuity.

Her markings are verbatim-gated on load (`validateMarkings()`); the council is gated on
staying auditable (`validateCouncil()`). **A clean console is the check.**

## Related

- `docs/product/VISITATION.md` — the frame, the doctrine line, the falsifiers, the test plan
- `docs/product/RECALL.md` § Tenure — where the expiry rule came from
- `docs/product/GUARDRAILS.md` — H1–H4, and the denominational-neutrality test the council has to pass
- `DECISIONS.md` — D-005 (Threads), D-016, D-020, D-022, D-025
- [`../looking/`](../looking/) — the wall this sits downstream of
