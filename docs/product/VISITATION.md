# Visitation — a page that arrives for a span, helps you ask better, and is gone

> **Status:** Draft 2, 2026-08-28. **Nothing here is decided.** Draft 1 framed this as a
> time-bounded page that *shows* you your season. That framing was redundant with
> surfaces we already ship, and it has been replaced — see § The turn. A
> `DECISIONS.md` row gets written only after it survives a call, and one part of it needs
> a row *before* it can be built at all.
>
> Click-through: [`prototypes/visitation/`](../../prototypes/visitation/) — screen-share
> only, do not send cold.

---

## The thesis

> **Every other Return surface shows you *what*. None of them does anything with it.
> This page helps you ask better.**

Ascent arranges seasons, Lamp gathers verses, Altar follows prayers, Pages hands back the
archive. All four *display*. This one performs an act on material the others already hold,
and the act is: **it puts your own unanswered questions back in front of you, with a
question somebody else asked long ago beside them, and it answers neither.**

---

## The turn, and why it is the most useful thing in this file

Draft 1's central movement was a grid of her declared markings — six chambers of `/pray`,
`/sense`, `/desire`, `/story`, `/learned`, `/scripture`, each holding a verbatim line.
Every guardrail cleared: grounded, no vertical axis, counts printed, writer-supplied.

It still had to be cut, and not for a guardrail:

> **It was a time-sliced Altar beside a time-sliced Lamp.**

Slicing an existing surface by date is a filter, not a surface. The only genuinely new
part — that four of the six mark kinds have no home yet — is an argument for giving them
one, not for building a page around them.

**A feature can clear every guardrail in the product and still not deserve to exist.**
That test is not written down anywhere in `PRINCIPLES.md` or `SURFACES.md`, and on the
evidence of this build it should be: SURFACES asks whether a surface can state its promise
and its persona question, and this one could do both while still being a duplicate.

*Proposed addition to the SURFACES audit, if this survives:* **6. Is there an existing
surface that already answers this, differently sliced?**

### What "ask better" fixes, in one pass

1. **It kills the oracle by construction.** A page whose output is a question has no
   answer in it to be wrong about. Phil's original worry — *"without being an oracle"* —
   stops being a matter of tone and becomes a property of the object.
2. **It stops being redundant.** The contribution is no longer new data; it is a new act.
3. **It threads H4.** Counsel, diagnosis and prescription are all assertions. A question
   is none of the three.

---

## Whose problem is this

**P2, The Dry Season.** Every question `PERSONAS.md` attributes to them is literally a
question: *"Is anything actually happening, or have I been standing still for two years?"*
· *"Was I closer to God before? When did it change?"* · *"Has He answered anything?"*

The product's current answer is to answer them. This surface's bet is that **a better
question is worth more than a partial answer** — which is also the only honest position,
because the app does not know the answers and Principle 4 forbids it guessing.

**P1, The Archivist** is served incidentally. **It is not P3**, and tenure is the only
thing keeping it that way (below). If tenure slips, this *becomes* a P3 feature and should
be killed on that basis alone.

---

## Which principles it serves

- **P4, grounded** — every question on the page is either hers, verbatim, or a cited
  passage from a fixed corpus. Nothing is generated.
- **P5, value compounds** — and *design for the dip*: gathering questions needs no
  threshold, no recurrence and no corpus. Only the grouping does. A three-entry span still
  pays out.
- **P1, light not verdict** — no encoding of any kind, so nothing to read as a grade.
- **P3** — and it does something no Return surface has: it *feeds* the editor.

---

## Which principles it risks, adversarially

### The central risk: a question smuggles a verdict better than a sentence does

This is the finding that matters most and it was not obvious.

A statement can be checked. A question carries its claims as **presuppositions** — the
things you must already have conceded for it to be answerable — and a reader accepts them
without noticing, because they arrive as grammar rather than as content.

*"Where might God be inviting you to be still?"* — nine warm words, three assertions:

| The assertion | The violation |
|---|---|
| that God is inviting | **H1** — intent attributed to God |
| that stillness is what her season was about | **D-016** — the app named the theme |
| that she is not being still yet | **H4**, and **H2** underneath, in the word *might* |

None traceable to a row. It would pass any review that was checking for tone.

**And unlike the mood line, it is invisible by inspection.** The mood line announces
itself — you see an axis and you know. Set a model-written question beside Abba Lot's in
the same typeface and nobody can tell which came out of a book.

> **The only defence is provenance.**

Hence: every quoted question carries a citation, an edition, and **the person it was
originally asked of**. The addressee is not trivia — it is the defence rendered visible.

### H4 and H1 — why a *quoted* question is safe when a written one is not

Not its grammar. This:

> **A question written in 400 AD cannot be a diagnosis of her, because it was not written
> about her.**

Cassian's Abba Moses asked a room of monks what the end of their profession was. He did
not ask her. She is overhearing somebody else's question and deciding whether to take it
up — the one posture in this space that makes no claim about the reader at all.

Two rules enforce it: **nothing is ever addressed to her** (no second person that was not
in the original, no re-pointing; a question that has to be reworded to land does not go in
the corpus), and **the addressee is printed**.

### H3 — the corpus is a library problem, not a prompting problem

Patristic quotation on the internet is a swamp. A fabricated father is a *worse* failure
than a misquoted verse, because there is no concordance in the reader's head to catch it —
she will retell it. So the same architecture as scripture: the text comes from a table,
hand-checked against printed editions by a person, and a row that is not verified does not
render. **Weeks of work, not tokens.**

One invariant is specific to this design and is already enforced in the prototype:
**every row must end in a question mark.** It has fired once, on Augustine's line about
time, which continues past its question into an assertion. The trim was taken: a passage
that lands on an assertion is a passage that tells her something.

### P6 — the cost that cannot be designed away

A council is tradition-specific. Selecting Julian, Teresa or Ignatius of Loyola carries
freight, and GUARDRAILS' test is *"would a thoughtful Christian from a tradition different
than Phil's read this and feel like a guest in someone else's house?"* Spreading the corpus
across schools is the least we can do, not a solution. **This is the strongest argument for
making it opt-in.**

### D-007 — and this is not a design question

Phil's framing included *"a voice of spiritual therapy"*. The posture is right; the
vocabulary is dangerous. A therapeutic register invites disclosure the app cannot handle,
and **crisis content still has no handling.** The moment this surface sounds clinical, that
open gap stops being a logged risk and becomes the thing standing between a user and harm.

> **If this direction proceeds, D-007 ships with it.** Not after.

The tradition's own words — *examen*, *discernment* — carry less liability, and still do
not appear on screen, because both are tradition-specific too.

### P2 — tenure, unchanged from Draft 1 and still load-bearing

`RECALL.md` § Tenure: **no occasion may accrue.** Every weekly review anybody has shipped
is *pending* tenure — it waits, it counts, and being behind on it is the mechanic.

> A hook works by making you feel bad if you do not come back.
> An occasion works by being there whether or not you did.

The page must expire **unread** exactly as it expires read, and nothing may record which.
No archive of past ones. If a future build adds a list of previous pages, this surface has
become an inbox and the argument is over.

**Randomised is worse than deterministic**, on our own terms: variable reward *is* the
compulsion lever, and if the same span yields a different page on Tuesday than Wednesday
the app has admitted the selection was arbitrary. Deterministic per span; the variety comes
from her life differing.

---

## The mechanism, and what keeps the model out of it

Three hops, all arithmetic, all auditable. No embedding, no model call, no network.

```
a word she wrote  →  a theme (a fixed editorial lexicon)
                  →  a question carrying that theme
```

- **It is the same for every user.** A model choosing per-person is characterising a
  person. A lookup table cannot characterise anybody — it does not know who you are.
- **Her word is always on screen**, so a wrong pin is *visibly* wrong.
- **The theme is never rendered.** Printing "memory" over her questions would be the app
  naming what her questions are about — D-016's forbidden side exactly. The heading is her
  own word. **The app's vocabulary never appears on the page at all.**
- **A thread with none of her questions in it is dropped**, or the app finds a theme and
  supplies the question for it, which is the failure arriving through the back door.
- **Silence is a result, and it is most of the page.** On the fixture three of seven
  questions reach nothing and are shown bare. If every question got a father, the fathers
  would mean nothing.

### The native data is input, not output — and one finding from building it

The markings are never listed. They **corroborate** her words. That is where Phil's *bring
the native pieces of data into that* lands, and it is what stops the page duplicating the
Altar.

The stronger version was built and reverted. Letting a declaration **lower the floor** —
one entry is enough if she marked it — returns `blanket`, `ugly`, `coats`, `circumstance`
and forty more, because a marking quote is a whole sentence. `looking/subjects.ts` had
already recorded exactly this.

> **A marking tells you the sentence mattered. It does not tell you which word did** — and
> no amount of arithmetic recovers the difference.

Same shape as `looking`'s pronoun finding, and worth carrying into any future feature that
tries to mine marks for terms.

---

## Where it lands

A **Return** surface, obeying the Return rule — you go there to see, never to do — with
one deliberate exception that is the whole point:

> **The last movement is a blank page.**

This is the **only Return→Write path in the app**. What may be in the new entry: her own
question, verbatim, with its date. Not a prompt we wrote — the instant the app types a
sentence into her journal it has co-authored her prayer life, and there is no undo.

### What it does to the other surfaces

- **Threads & Ropes** — absorbed. Flag-off, fixtures only, no users. Resolves D-005.
- **Ascent** — a question for *after* the calls, not before. SURFACES already flags it as
  the surface most likely to make a user feel graded.
- **Lamp and Altar** — untouched, and now explicitly protected: this page uses their data
  and does not display it.

---

## What would make us kill it

Ordered by how cheaply each fires.

1. **"Hers alone is already the good part."** Show `#asking → hers` — her questions,
   gathered, with nothing beside them — and ask whether that is enough. **If yes, the
   corpus never gets typed**, and we have saved weeks of library work, a rights budget and
   a doctrine row for the price of one question. *This is the cheapest falsifier in the
   file and it should be asked first, every time.*
2. **They resent the tradition's question.** The difference between overhearing someone
   else's question and being interrogated is the entire bet. If it reads as the app
   pressing her, the council goes.
3. **They ask to keep them all.** The inbox request. Tenure is gone and so is the licence.
4. **The thin page reads as shame.** Same occasion, three entries. If they feel scored
   rather than seen, the surface deepens the wound P2 came in with.
5. **They cannot tell the written question from the quoted one, and do not care.** Then
   provenance is not doing the work we are asking it to do, and the only defence has
   failed.
6. **They would not write anything at `onward`.** Then the terminal act is reading and it
   is an oracle after all.
7. **Anyone says "verdict", "grade" or "score" unprompted.** P1 failing out loud.

---

## The cheapest way to find out

- **Falsifier 1 costs one question on the next call and needs no build at all.** Ask it
  before anything else.
- **The council can be tested with zero corpus work**: two questions in front of five
  people, and ask whose voice it is.
- **Her-questions-alone is nearly free to ship.** Lines ending in `?` is a query. It needs
  no model, no corpus, no lexicon, no doctrine change — and it is the half of this that
  falsifier 1 might show is the whole thing.
- **Tenure cannot be tested by asking.** People will say they want to keep every page.
  Watch whether they *ask* — an unprompted request is signal; a yes to "would you like
  to?" is politeness.

---

## Verdict

- **The span page — Build**, smallest version: the head, her questions grouped by her own
  word, the bare rest, and `onward`. **No corpus.** Four movements, all arithmetic, no
  model call anywhere. This is shippable without a single doctrine change.
- **Expiry — Build first.** It is the licence for everything else.
- **`onward` — Build.** Her question, never a prompt.
- **The tradition's questions — Test with falsifier 1 before anything.** If it survives,
  write the `DECISIONS.md` row, then budget the library, then build. In that order.
- **The declared-markings grid — Cut.** Redundant with Altar and Lamp. Kept on a route as
  the record of a feature that cleared every guardrail and still did not deserve to exist.
- **Inferred sentiment — Decline permanently.**
- **Variable reward — Decline.** Deterministic per span.
- **D-007 — ships with this or this does not ship.**

---

## How to run the test

**Reaction piece inside a live call.** Not a link sent cold.

Open `#notes` before the call. Press `S` to hide the route bar before sharing. **Never
say** *report, insights, review, summary, council, fathers, examen, therapy, visitation*.
The screen says *Spring and summer* and a year. If they ask what it is, the only sanctioned
answer is *"it showed up"* — then be quiet.

1. `PERSONAS.md` Q4 first, before anything is shown.
2. `#arrives` — let them scroll it all. Then *"What is this?"* Silence. The second thing
   they say is the true thing.
3. `#asking → hers` — **"Is this enough on its own?"** (Falsifier 1. Ask before showing
   anything else.) Then `from the reading`. Then `one we wrote` — and ask which came out of
   a book *before* explaining.
4. `#onward` — *"What would you write here?"*
5. `#thin` — say nothing. Watch their face.
6. `#gone` — *"What would you want to happen to it?"*
7. Never ask *"would you use this?"*

**Watch especially:** do they notice, unprompted, that *"How much am I supposed to remember
for her?"* (May) and *"How much of her do I get to remember?"* (August) are the same
question turned? Nobody wrote a word about it — detecting it is a shared word above a
printed floor. If that lands on its own, the thesis is alive.

---

## Results

*(Fill in after the calls. Move statements from hypothesis to finding with the date
attached, then write the `DECISIONS.md` row — or write the row that kills it.)*

| Date | Who | Named it | Hers alone enough? | Resented the question? | Saw the turn? | Asked to keep them? | Verbatim phrases |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

---

## Related

- `PRINCIPLES.md` — 1 (light not verdict), 2 (never gamify), 4 (grounded), 5 (compounds)
- `GUARDRAILS.md` — H1–H4, denominational neutrality, and the D-007 gap this direction closes or trips over
- `RECALL.md` § Tenure — where the expiry rule came from
- `SURFACES.md` — the Write/Return split this puts an arrow back through, and the proposed sixth audit question
- `DECISIONS.md` — D-005 (Threads), D-007 (crisis content), D-016 (the writer supplies the signal)
- [`prototypes/visitation/`](../../prototypes/visitation/) — the click-through and the full argument
- [`prototypes/looking/`](../../prototypes/looking/) — the wall this sits downstream of
