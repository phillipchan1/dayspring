# Visitation

A page that arrives for a span of time, helps you ask better, and then is gone.
Slug `visitation`, served at `/visitation/`. A click-through for a screen-share, not a
self-guided link.

```bash
npm install && npm run dev     # → localhost:5190/visitation/#arrives
```

`S` hides the route bar before you share. `#notes` is the facilitator page — open it
before the call, never during it. Keys `1`–`7` switch scenes.

**Never say "report", "insights", "review", "council", "examen", "therapy" or
"visitation" on a call.** The screen says *Spring and summer* and a year. PERSONAS.md: the
instant you explain a feature the data is contaminated. Let them name it, and write down
the words they use.

---

## The thesis

> **Every other Return surface shows you *what*. None of them does anything with it.
> This page helps you ask better.**

That sentence arrived second, and it replaced a version of this prototype that was
grounded, legal, pretty and redundant. The story of the swap is most of what this
prototype is worth, so it is written down rather than tidied away.

**What the first build did.** Its central movement was a grid of her declared markings —
six chambers of `/pray`, `/sense`, `/desire`, `/story`, `/learned`, `/scripture`, each
holding a verbatim line. Every guardrail cleared. And it was **a time-sliced Altar beside
a time-sliced Lamp.** Slicing an existing surface by date is a filter, not a surface, and
the only genuinely new part — that four of the six mark kinds have no home yet — is an
argument for giving them one, not for building a page around them.

That is a sharper kill than any principle fired, and it is worth keeping in view: **a
feature can clear every guardrail in the product and still not deserve to exist.**
`#heart` keeps the cut version on a route for exactly that reason.

**Why "ask better" is the real thesis.** It does three things at once, which is how you
can tell:

1. **It kills the oracle by construction.** A page whose output is a question has no
   answer in it to be wrong about.
2. **It stops being redundant.** The contribution is no longer new data — the Altar
   already has the data — it is a new *act* performed on it.
3. **It threads H4.** Counsel, diagnosis and prescription are all assertions. A question
   is none of the three.

---

## Where a question may come from — `#asking`

Three sources at the same fidelity, so the difference is seen rather than argued.

### hers

Every line in the span ending in a question mark. No corpus, no lexicon, no rights
budget, no doctrine change — a rule a person could run by hand.

**Show this first on a call and ask whether it is already enough.** If the answer is yes,
the tradition corpus does not get built, and you have saved weeks of library work and a
`DECISIONS.md` row for the price of one question. It is the cheapest possible falsifier
for the most expensive part of the idea.

### from the reading

The bet the rest of the surface makes: that a question you asked in May, handed back in
August with something beside it, is worth more than the same question alone.

**The unlock is that the contemplative tradition is largely a literature of questions.**
Cassian opens with Abba Moses asking a room of monks *"What is the goal and what is the
end of your profession?"* Augustine's Confessions is one long interrogation. Ignatius'
Exercises are three questions before a crucifix. Abba Lot's *"now what more should I
do?"*

That matters more than it sounds, because it changes what the defence rests on:

> **A question written in 400 AD cannot be a diagnosis of her, because it was not
> written about her.**

She is overhearing somebody else's question and deciding whether to take it up, which is
how spiritual reading has always worked and is the one posture in this space that makes
no claim about the reader at all.

Two rules fall out and both are enforced in the fixture:

- **Nothing is ever addressed to her.** No second person that was not in the original, no
  "for you", no re-pointing. A question that has to be reworded to land does not go in.
- **The addressee is printed on the page.** *"asked of a room of monks"*, *"asked of his
  elder"*. Not trivia — it is the defence made visible. A question with no stated
  addressee starts to read as though it were addressed to whoever is holding the page.

### one we wrote — and why it is the dangerous screen

*"Where might God be inviting you to be still?"*

**A question smuggles a verdict better than a sentence does.** Its claims arrive as
presuppositions — the things you must already have conceded for it to be answerable —
and a reader accepts them without noticing, because they arrive as grammar rather than as
content. That one has three:

| | |
|---|---|
| that God is inviting | **H1** — intent attributed to God |
| that stillness is what her season was about | **D-016** — the app named the theme |
| that she is not being still yet | **H4**, and **H2** underneath, in the word *might* |

None traceable to a row, all in nine warm words, and it would sail through any review
that was checking for tone.

And here is the part that makes it worse than the mood line: **the mood line announces
itself.** You see an axis and you know. This does not. Set it beside Abba Lot in the same
typeface and nobody can tell which came out of a book. **The only defence is provenance**
— which is the whole reason for the citation, the edition and the addressee.

---

## The native data is input, not output

Phil's instinct — *bring the native pieces of data into that* — is where the redundancy
gets fixed. The markings are never listed on the page. They **corroborate** her words:
`also inside what you marked · Sense · Learned`. The Altar keeps its job; this page uses
its data without showing it again.

### One finding worth carrying into the real feature

The obvious stronger move is to let a declaration **lower the floor**: a word needs two
entries to count, unless she declared it inside a marking, in which case one is enough,
because she already told us it mattered. It sounds like the strongest possible form of
D-016.

Built, and on this fixture it returns `blanket`, `ugly`, `coats`, `wake`, `circumstance`
and forty more — every noun in every marked sentence. `looking/subjects.ts` had already
written down why, and the note was sitting in the tree the whole time: *"a marking quote
is a whole sentence and drags the same ordinary English along with it."*

> **A marking tells you the sentence mattered. It does not tell you which word did** —
> and no amount of arithmetic recovers the difference.

Same shape as `looking`'s pronoun finding. So a declaration cannot promote a word,
because it does not point at one; it can only corroborate one recurrence already found.
Reverted, and the reasoning is kept in `span.ts`.

---

## How a question reaches a question

Three hops, all arithmetic, all auditable. No embedding, no model call, no network.

```
a word she wrote  →  a theme (fathers.ts LEXICON, editorial, fixed)
                  →  a question carrying that theme (questions.ts)
```

Two properties matter more than accuracy:

- **It is the same for every user.** A model choosing per-person is characterising a
  person. A lookup table cannot characterise anybody — it does not know who you are.
- **Her word is always on screen.** If the pin is wrong it is *visibly* wrong. A
  model-selected question offers nothing to check.

**The theme is never rendered.** Printing "memory" over her questions would be the app
naming what her questions are about, which is exactly D-016's forbidden side — *a subject
the writer named* is legal, *a theme the app named* is not. So the heading is her own
word (`remember`, `keep · still`) and the theme stays invisible plumbing. **The app's
vocabulary never appears on the page at all.**

**A thread with none of her questions in it is dropped.** Otherwise the app finds a theme
and supplies the question for it, which is the failure mode arriving through the back
door.

**One question, once per reading** — `keep` and `still` both reach `staying`, and without
this the same saying appears twice on one page, which reads as the machine having a
single trick.

### Silence is a result, and it is most of the page

Three of her seven questions in the span reach nothing and are shown bare under **and
these**. That is Principle 4's second half — *grounded, **or silent*** — and it is also
the only thing keeping the matched ones honest: **if every question got a father, the
fathers would mean nothing.**

---

## What the fixture actually produces

On *Spring and summer 2026*, eight pages:

**keep · still** — *also inside what you marked · Sense · Learned*
> Jun 22 — What if the new thing is only that I keep showing up?
> Aug 16 — What am I supposed to do with a love that only knows how to sit still?

> Father, according as I am able I keep my little rule, and my little fast, my prayer,
> meditation and contemplative silence; and according as I am able I strive to cleanse my
> heart of my thoughts: now what more should I do?
> — *Abba Lot, to Abba Joseph · asked of his elder*

**remember**
> May 9 — How much am I supposed to remember for her?
> Aug 4 — How much of her do I get to remember?

Same question, three months apart, and it turned. **Nobody wrote a word about it** —
detecting it is a shared word above a printed floor. If a reader notices that unprompted,
the thesis is alive; it is the single best thing on the screen and the app takes no credit
for it.

---

## The corpus is the feature

**All 9 questions are unchecked against a printed source.** They were written down from
memory — precisely the failure the feature exists to prevent, reproduced inside the
prototype that argues for it. Deliberate, and it is the finding:

> **This is a library problem, not a prompting problem.**

Patristic quotation on the internet is a swamp; much of what circulates under Augustine's
name he never wrote. A fabricated father is a *worse* H3 failure than a misquoted verse,
because there is no concordance in the reader's head to catch it — she will retell it.

`validateAsking()` cannot check a quote against a book. It checks the invariants that
keep the corpus checkable, and one of them is specific to this design:

> **Every row must end in a question mark.**

It has already fired once, on Augustine's line about time, which continues past its
question into an assertion. The gate was right and the trim was taken: **a passage that
lands on an assertion is a passage that tells her something**, and the whole reason this
corpus is questions is that a question makes no claim about the reader. Where the
tradition's best line is a question followed by an answer, the answer is somebody else's
and it does not go on her page.

**A clean console is the check.**

### The rights problem underneath it

`edition` is required because **the translation is the part that is owned.**

- Public domain, and Victorian: ANF (1885), Pusey's Augustine (1838), Warrack's Julian
  (1901), Gibson's Cassian (1894), Mullan's Ignatius (1909).
- In copyright, and what a modern reader actually wants: Ward's desert fathers above all.

**Archaic-and-free or contemporary-and-licensed** is a decision with a budget attached
and it comes before the build. Note also that the genuinely first-century corpus outside
the New Testament is tiny — 1 Clement, the Didache, Ignatius' letters. The range is the
first four centuries plus the desert, and the desert sayings fit best anyway: short,
concrete, non-doctrinal, and already named in RECALL's `the word` mechanism.

### Two costs that cannot be designed away

**P6.** A council is tradition-specific. Selecting Julian, Teresa or Ignatius of Loyola
carries freight, and a Reformed Baptist may be delighted or may not. The corpus is spread
across schools deliberately — desert, Augustinian, English mystical, Ignatian, à Kempis —
which is the least we can do about it, not a solution.

**D-007.** Phil's framing included *"a voice of spiritual therapy"*. The posture is right
and the vocabulary is dangerous: a therapeutic register invites disclosure the app cannot
handle, and **crisis content still has no handling.** The moment this surface sounds
clinical, that open gap stops being a logged risk and becomes the thing standing between
a user and harm. If this direction proceeds, D-007 comes with it. The tradition's own
words — *examen*, *discernment* — carry less liability and still do not appear on screen,
because both are tradition-specific too.

---

## Tenure — `#gone`

Phil put "temporary artifacts" in as a detail about export. It is the load-bearing beam.

RECALL.md § Tenure already worked out why the product has no weekly review:

> **No occasion may accrue.** A weekly page that is gone on Monday is a liturgy. The same
> page still there in March is a chore about someone's prayer life, and no amount of
> gentle copy fixes it.

Every weekly review anybody has shipped is **pending** tenure — it waits, it counts, and
being behind on it is the mechanic. An **occasional** page that expires has none of that,
and the tradition's own scheduling works exactly this way: Advent arrives whether or not
you were faithful, and then it leaves.

> **The test, and it is checkable:** a hook works by making you feel bad if you do not
> come back. An occasion works by being there whether or not you did.

The page must expire **unread** exactly as it expires read, with nothing recording which.
`#gone` holds all three states including `the version that accrues` — what this becomes
the day somebody asks *"can I see last season's?"*.

### Randomised is worse than deterministic, on our own terms

Variable reward *is* the compulsion mechanic; calling it insight does not change what it
does. It also breaks Principle 4 on its own: if the same span yields a different page on
Tuesday than on Wednesday, the app has admitted the selection was arbitrary.
**Deterministic per span** is safer *and* better — the variety comes from her life
differing season to season, and she can show the page to her husband and it still says
the same thing.

---

## Onward — `#onward`

> **The last thing on the page is a blank page.**

Intent does not survive contact with a surface; structure does. A page that ends in a
conclusion has told her what her season was. A page that ends in the editor has handed
her back her own material and got out of the way. It is also the **only Return→Write path
in the app** — SURFACES splits Write and Return and the arrow has only ever pointed one
way.

Three versions on the route: **her line** (her own question, verbatim, as a blockquote
with its date, then the cursor), **a prompt we wrote** (fluent, warm, H4, and the first
line in her journal that is not hers — there is no undo), and **nothing at all** (safest,
and throws away the only thing the page was for).

**No share button, no image card, no link.** Principle 1 says a screenshot of this must
not be a scoreboard, and the surest way is not to build the affordance that wants one.
Export is for her — and there is a nice inversion in it: the app forgets the page; *she*
keeps it, in a product whose villain is forgetting.

---

## The same season, twice — `#arrives` and `#thin`

Both are **Spring and summer**. 2026 has eight pages; 2024 has three. Same occasion, same
shape, the archive doing all the differing — which is the most useful pairing on the
facilitator's screen, because it makes the span question concrete without anybody
explaining it.

**The span is a property of the archive, not a product decision.** Anna writes about once
a month, so a monthly page for her is one entry with a headline on it. Phil writes ~26 a
month, where a monthly page is rich. No fixed cadence is right for both, and the rule that
picks it is a real open question this prototype cannot settle.

**The thin page degrades into its own last movement**, not into a different page: it
shows her questions, bare, which is exactly what `and these` is on the full page. That
falls out of the thesis — gathering questions needs no threshold, no recurrence and no
corpus; only the *grouping* does. So even three entries pay out something real, which is
Principle 5's own corollary, design for the dip.

The threshold is printed. The page does **not** say she wrote less than usual, did not
keep it up, or has been away. Absence is not ours to interpret. On the fixture her two
questions are *"Where did the spring go?"* and *"Is anyone hearing any of this, or am I
talking to the ceiling?"* — and the app says nothing at all. Watch their face. This is the
shame test.

**And never a comparison.** Not entry counts, not marking counts, not words. A delta at
the top of a recurring page is a streak counter wearing vestments, and Principle 2 does
not care what it is wearing. The scope line says *8 pages*; it never says *up from 3*.

---

## Small decisions that are actually rules

- **The occasion is a season and a year, never a name for what the season was.** "Spring
  and summer" is when it happened. "A Season of Waiting" would be the app telling her
  what it meant.
- **The dates on the page are her dates, not the calendar's.** The span runs March 1 –
  August 31; the line reads *March 1 – August 16*, because those are the days she wrote.
  A container you partly filled is a container you partly failed to fill.
- **Every question of hers in a thread, never a selection.** A view showing the best three
  of nine has made a judgment, and selection is significance, and significance is a verdict.
- **Never sorted or grouped by whether a question is still being asked.** A reader
  supplies the word *answered*, and it is theirs to supply. Nothing on screen says
  `answered`, `resolved` or `no longer`.
- **Names are not vocabulary.** *Mira*, *David* and *Mom* come out — a name is a person,
  and people are handled by subjects, which have their own rules about somebody who
  consented to nothing.
- **The stop list removes closed-class words, never dull ones.** Its first draft held
  *still*, *want* and *keep*, which is most of what her spring is about. `said` and `told`
  stay in, and that is the correct direction to be wrong in.

---

## Elegance, and where it is deliberately absent

- **The app is dark and this page is lit.** It is the only lit thing in Dayspring — Luke
  1:78, first light. A surface you go to should look like the app; a thing that arrives
  should look like it came from somewhere else. It also settles a build question for free:
  **this page prints**, with no second stylesheet.
- **The dawn** — one warm radial behind the sheet. You should not be able to say what it
  is, only notice the page looks lit from behind rather than pasted on.
- **Warm shadow, never black.** A neutral drop shadow on a dark ground reads as a hole,
  and a page is not a hole.
- **Serif is her. Sans is us. Mono is a date.** Inherited from `looking`, extended by one
  line: **display is the occasion**, used exactly once. A second use of Fraunces turns an
  occasion into a brand.
- **The expiry never counts down.** No "2 days left", no colour change as it nears.
- **The kumiko lattice** on the shoji panels is a fine repeating grid, not one cross — the
  first pass drew a single muntin down each axis and it read as a redaction mark through
  her sentence.
- `prefers-reduced-motion` removes every transform.

## Rules every screen holds

- No vertical axis anywhere. The only element with a height encoding is the mood line,
  which exists to be pointed at.
- Nothing on a page but the writer's words, their date, and their markings.
- No answer, ever, to any question on the page.
- Nothing compares this span to the last one.
- Nothing accrues. No archive, no backlog, no record of what was read.
- Banned vocabulary: *report, insights, review, track, score, progress, goal, dashboard,
  analytics, journey, inbox, workflow, examen, therapy.*

## The routes

| | | |
|---|---|---|
| `#arrives` | **the product** | the page, whole |
| `#asking` | the argument it rests on | hers · from the reading · one we wrote |
| `#heart` | argued and cut | chambers · shoji · the one we cannot build |
| `#council` | the earlier design | the tradition supplying statements instead of questions; toggle `a bridge` |
| `#onward` | the last movement | her line · a prompt we wrote · nothing at all |
| `#thin` | the shame test | the same occasion, 2024 |
| `#gone` | tenure | while it is here · after · the version that accrues |
| `#notes` | the facilitator | never on a shared screen |

## The corpus

Anna, 47 entries, 2023–2026 — carried over from [`../looking/`](../looking/), which took
it from [`../recollection/`](../recollection/) and [`../recall/`](../recall/). Same woman,
same voice.

Three gates run on load: her markings must be verbatim, the statement corpus must stay
auditable, and every tradition question must end in a question mark.

## Related

- `docs/product/VISITATION.md` — the frame, the doctrine line, the falsifiers, the test plan
- `docs/product/RECALL.md` § Tenure — where the expiry rule came from
- `docs/product/GUARDRAILS.md` — H1–H4, denominational neutrality, and D-007
- `DECISIONS.md` — D-005 (Threads), D-007 (crisis content), D-016, D-020, D-022, D-025
- [`../looking/`](../looking/) — the wall this sits downstream of
