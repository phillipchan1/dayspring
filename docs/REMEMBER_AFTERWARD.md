# Afterward — what to do with the Remember engine

**Status:** Proposal + prototypes, 2026-09-15. **Nothing here is decided.** No app code
was touched. The click-through is [`docs/prototypes/remember-afterward.html`](prototypes/remember-afterward.html) —
open it in a browser; keys `1`–`5`, `c`, `?`, and `S` hides the chrome before a screen-share.

> **Which engine this reads.** "The Remember engine" here means
> [`src/lib/remember.ts`](../src/lib/remember.ts) — `collectPassages()` and its four
> sources. If you meant The Keeping / Movements engine
> ([`docs/THE_KEEPING.md`](THE_KEEPING.md)), say so and this gets rewritten against that
> instead; the shapes below mostly survive the swap, the rules do not.

---

## 1. The trigger: an engine with no consumer

`collectPassages()` returns every passage the writer set apart — marks, blockquotes,
markdown emphasis, and declared `/pray` and `/sense` blocks — across the whole corpus,
newest first, dated, verbatim, source-tagged.

**Nothing in the app calls it.** Grep says so:

| Export | Read by |
|---|---|
| `passagesForEntry` | `features/pages/PageReader.tsx`, `features/pages/pageExcerpt.ts` |
| `passageKey` | `features/pages/pageExcerpt.ts` |
| **`collectPassages`** | **`remember.test.ts`, and nothing else** |

That is not an oversight, it is the shape D-020 left behind. `useMarks.ts` says it in its
own header: *"the half that read the whole corpus out of IndexedDB to derive passages went
with the surface that needed it."* The corpus-wide half survived as a function and lost its
caller.

What that function holds is the only body of text in the product that is **significant by
the writer's own hand** and spans years. Everything else we have is either one page
(`passagesForEntry`), model-inferred (`spiritual_items.source = 'scanned'`, 6,257 rows), or
a filter over pages. On the real archive `collectPassages` seeds **404 passages on day one** (D-016's figure, scripture already excluded),
before anyone is asked to adopt a habit.

---

## 2. The idea I picked, and the ones I passed over

**Picked: the ephemeral offer.** One passage the writer already set apart, handed back
**after the writing is done.** `MOVEMENTS.md` calls it tenure #2 — *"after writing is
complete, one grounded earlier passage may appear because it connects to what was just
written. Never in the editor."* `RECALL.md` Act four puts re-entry after the writing.
`prototypes/recollection/#comesto` drew it once as the null hypothesis. Nothing has been
built.

**Why this one over the alternatives:**

| Candidate | Why not |
|---|---|
| The passage list back as a surface | D-020 killed it and said why — *"the passage list in particular was a real idea; it lost to being a filter instead."* Don't re-propose it. |
| A person/subject page of passages | Pages + `look for` already does it, and `prototypes/looking/` is the reference implementation. |
| A twice-a-year paced read (`#sitdown`) | Needs an occasion, and an occasion that can be missed is the one thing here that can rot into an inbox. |
| A printed book of remembrance | Genuinely interesting, and a side quest. It is an export, not a loop. |

And the positive case, which is the real argument:

- **It is the only idea whose requirement is `collectPassages`'s exact shape** — whole
  corpus, one flat dated list, source-tagged. Every other use works off entries and already
  has a home.
- **It cannot become a filter**, so it does not re-litigate D-020.
- **No model, no migration beyond one small log, no cold start.** 404 passages exist the
  day someone imports Day One.
- **Nothing accrues.** It is the cheapest thing in the product that could change whether
  people come back, without a streak. Principle 2 gets to stay intact.

---

## 3. The hard question, and why there are several prototypes

Handing back **one** passage means something selected it. D-016 is blunt about that:
*a subset means something selected it, and selection is significance* — and significance is
a verdict.

The answer is that **the rule is arithmetic, and the rule is on the screen.** The app never
looks at what a passage *says*. She decided which of her lines mattered when she set them
apart; all the app decides is when to be quiet and when to hand one back, on a rule she can
read in one sentence.

So the prototypes differ by **rule** first and by **shape** second. Three rules are
implemented and measured against the fixture — 66 passages from 47 entries over four years.
Every line on every screen is computed live; nothing is typed in by hand.

### Rule 1 · the walk

> *The oldest line you set apart and have not met.*

Strictly forward, in the order she wrote them. **Nothing is selected at all** — this is the
only rule with no selection pressure anywhere in it, and it is the only rule that
eventually hands back everything.

- **Fires:** every sitting, until the pool runs out. 66 lines here; 404 on the real archive on day one.
- **The risk:** a position in a walk is progress-shaped. Show the **date of the line**,
  never how far along she is, and never a count of what is left. A "42 of 404" on this
  screen is Principle 1 with the serial numbers filed off.
- **The other cost, named:** at one per sitting this is finite. 404 passages is years, and
  then it is empty. Wrapping round turns it into rule 4.

### Rule 2 · your own words

> *A line you set apart that shares a run of words with the page you just closed.*

Longest common run of four words or more, literal, computed in code. **It shows its work**
by lighting the shared run on both sides — which is the exact hole D-020 named on its way
out: *"a vector hit has no word to light."* This one has words to light, because it is not
a vector hit.

- **Fires:** 6 of 47 sittings — **13%**.
- **It is the most convincing return in here and by far the rarest.** When it fires it is
  extraordinary: *"roommates who share a calendar"* returning ten months later, *"I want to
  be praying about"* returning eighteen months later. When it half-fires it is junk —
  *"i sat in the"*, *"did not say it"*.
- **Measured, and this is the open question:**

  | Minimum run | Fires | What comes back |
  |---|---|---|
  | 3 words | 34% | mostly *"i keep thinking"*, *"that i am"* — coincidence |
  | 4 words | 13% | two superb hits, four junk ones |
  | 5 words | 4% | both real, ten and eighteen months apart |

  A rarity test — the run must appear in no more than two entries in the whole archive —
  drops *"i want to be"* and *"i sat in the"*, still lets *"did not say it"* through, and
  lands at 6%. **There is no setting that is both frequent and good.** Tuning this is the
  only hard engineering question in the feature, and it is a Concordance question: the run
  needs to carry a word that is rare *in her own vocabulary*, which is arithmetic we
  already compute.

### Rule 3 · the same week

> *A line you set apart in this same week of an earlier year.*

The same arithmetic as the shipped `features/pages/anniversaries.ts`, returning **the line**
instead of the page. The calendar comes round whether or not she was faithful, and then it
leaves — which is the tradition's answer to *when*, and it needs nobody's permission.

- **Fires:** at ±7 days, 17 of 39 eligible sittings — **44%**. At the ±3-day window the wall
  actually ships, **26%**, and it returns nothing on the prototype's day.
- **The risk:** silent for most of the year on a thin archive, and **silent for the whole of
  year one** — there is no earlier year to reach back to. It cannot be the floor.

### The finding that matters

Run all three against the same sitting and you get **three different lines, all hers, all
verbatim, none chosen for what it says.** That is the `c` screen, and it is the one to argue
over.

**No single rule fires often enough to be the whole feature, and the best one fires least.**
So the shape is: the walk is the floor, and the other two interrupt it when they fire. That
is a composition decision, not a ranking — and it is the thing I'd want a beta user to react
to before any of it is built.

---

## 4. Five shapes, and two states every shape must answer

| # | Screen | Rule it carries | What it is arguing |
|---|---|---|---|
| 1 | `#word` | the walk | One line, the whole screen, nothing else. The desert's unit of memory is a single saying. The way out is delayed four seconds on purpose — a next control available immediately makes it a slideshow. |
| 2 | `#hairline` | your own words | The page she just closed, a hairline, and the earlier line beneath it with the shared run lit on both sides. **The strongest screen in the set**, because the reason it came is visible. |
| 3 | `#facing` | the same week | Today on the left, the earlier line on the right, one spine between them. The arrangement a bound notebook physically cannot do. |
| 4 | `#again` | — | **Not a fourth rule; a modifier on any of them.** The Exercises do not advance to new material and lectio chews one line. The only thing that changes on a second serving is one line of sans: no badge, no count, **a second meeting is not an achievement.** |
| 5 | `#nothing` | — | **The control, and the screen that has to be here.** When the rule returns nothing, the answer is the blank next page — not a weaker line, not a second rule wheeled in to cover the gap, not a prompt. *Grounded, or silent* is the fourth principle and silence is the half nobody builds. |

`c` runs all three rules against one sitting. `?` is the facilitator page — open it before a
call, not during it.

---

## 5. Tenure, and why nothing here can become a chore

`prototypes/recollection/README.md` has the axis right, and this feature sits on the safe
end of it:

| Tenure | Property | This feature |
|---|---|---|
| Permanent | always there, grows | no |
| Occasional | exists because of a date, gone when it passes | no |
| **Ephemeral** | **appears once beside something she just did, stored nowhere** | **yes** |
| ~~Pending~~ | waits for her, accrues | never |

It appears once, after a page is closed, and it is gone. There is no horizon, nothing
unread, nothing to be behind on, and no "you missed last week's." The served log is not a
read receipt and nothing is ever counted from it.

**It never touches the editor.** Principle 3's test is whether a change touches the editor's
render or input path; this runs after the page is put down, which is also what D-026 and
RECALL Act four already require.

---

## 6. What it would cost

1. **One widening of `DeclaredRow` in `remember.ts`.** It reads `/pray` and `/sense`; the
   product now also has `/story`, `/desire` and `/learned`. That is 19 of the fixture's 66
   passages — a third of the pool, for one line of code.
2. **One served log** — a passage key and a date. Local-first, same shape as `marks`.
3. **The composition** — which rule gets to interrupt the walk, and how often.
4. **No model call. No new interpretation. No migration beyond the log.**

The load-bearing exclusions are already in the engine and must stay: **scripture refs out**
(284 of 563 on the real archive — including them makes this half a second Lamp), and
**everything with `spiritual_items.source = 'scanned'` out**. D-020 left a standing warning
about that second filter: *"if a future surface reads `spiritual_items`, that filter has to
come back."* This is that future surface. It comes back.

---

## 7. What would change our mind

- **She hunts for more.** If the first thing anyone does on `#word` is look for a next
  button, it is a feed and it should not be built.
- **The overlap rule cannot be tuned above junk.** If nothing beats 13% firing with two
  junk hits in six, cut rule 2 and ship the walk alone — or cut the whole thing, because
  rule 2 is most of the magic.
- **"I have seen this" is a complaint.** `#again` is falsified the moment a second serving
  reads as the app running out of material rather than as recognition.
- **Anyone reads the walk's position as progress.** If the date on screen becomes "how far
  along am I," the walk is Principle 1 in disguise and only the interrupting rules survive.
- **It reads as being watched.** An unasked-for line from four years ago is a different
  emotional event from one you went looking for, and we have no evidence about which way
  that lands. Nothing in the Notion interview database says a beta user wants this. **It is
  a hypothesis, not a finding.**

---

## 8. What I did not build, on purpose

- **No settings screen.** `#pencil`'s finding stands — off-by-default in a settings pane is
  the safest place to put something and the least findable — and this feature has nothing
  to configure that isn't the composition question.
- **No notification.** MOVEMENTS is explicit: no notification is required for the first
  version. A push that says *here is a line from your journal* is the guilt-shaped thing
  Principle 2 forbids, one rewrite away.
- **No "write from here."** MOVEMENTS names it as the one quiet transition a reading may
  end on. It is right, and it is a second feature.
- **No semantic leg.** A vector hit has no word to light. `prototypes/looking/semantics.ts`
  keeps the argument written down for whenever it comes back.

---

## Related

- [`src/lib/remember.ts`](../src/lib/remember.ts) — the engine, and the reasoning for every
  exclusion in it
- [`docs/product/DECISIONS.md`](product/DECISIONS.md) — D-016 (the writer supplies the
  signal), D-019, D-020 (Remember deleted), D-026, D-029
- [`docs/product/MOVEMENTS.md`](product/MOVEMENTS.md) — pull, push, and tenure
- [`docs/product/RECALL.md`](product/RECALL.md) — the four acts, the contemplative mechanisms
- [`prototypes/recollection/`](../prototypes/recollection/) — ten arrangements, including
  `#comesto` and `#again`, and the corpus this prototype reuses
- [`prototypes/looking/`](../prototypes/looking/) — the reference implementation for D-025

