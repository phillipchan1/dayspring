# Visitation — a page that arrives for a span, and then is gone

> **Status:** Draft 1, 2026-08-28. **Nothing here is decided.** This is the frame and the
> test plan for an idea from Phil, run through `/ideate`. A `DECISIONS.md` row gets
> written only after it survives a call — and one part of it needs a row *before* it can
> be built at all (see § The doctrine change).
>
> Click-through: [`prototypes/visitation/`](../../prototypes/visitation/) — screen-share
> only, do not send cold.

---

## The idea, and why it is seven ideas

Phil's framing: *"a report that tells you, over a period of time, insights into your life
without being an oracle, with the purpose of fueling further prayer towards God."*

The instinct is right and it is the most on-strategy thing in the backlog — VISION's
three-year picture **is** a time-bounded page, and *"the year-in-review is the payoff"* is
already written down. But it arrived as one object and it is seven, and they do not all
survive. Separating them is most of the work:

| | | Verdict |
|---|---|---|
| **A** | A page covering a span of time | **Build.** Nothing in the product is shaped like it. |
| **B** | A heart diagram — sentiments and emotions felt | **Decline as posed.** The legal version is stronger. |
| **C** | A council of contemplative fathers, quoted | **Test — and it needs a doctrine row first.** |
| **D** | Temporary, not editable, savable as paper | **Build, and it is load-bearing.** |
| **E** | Forward it into a new entry | **Build.** The strongest idea in the set. |
| **F** | The entries that support it | Already the architecture. |
| **G** | Replaces Ascent, Threads, parts of Lamp | Threads yes. Ascent maybe. Lamp no. |
| **H** | The hook model without being addictive | **Decline the mechanism, keep the goal.** |

---

## Whose problem is this

**P2, The Dry Season**, primarily — *"Is anything actually happening, or have I been
standing still for two years?"* and *"Was I closer to God before? When did it change?"*

**P1, The Archivist** is served incidentally: *"Am I the same person?"* But P1 already has
the Ascent and now Pages. The reason to build this is P2, which SURFACES' coverage table
shows is the persona the product's *heart* is built for and its *surface area* is not.

**It is not P3.** That matters, because a recurring page that arrives on a schedule is
exactly the shape a P3 feature request takes, and P3 requests get logged, not built. The
thing that separates this from a P3 feature is tenure (below). If tenure slips, this
**becomes** a P3 feature, and it should be killed on that basis alone.

---

## Which principles it serves

- **P5, value compounds** — and its corollary, *design for the dip*. A span page pays out
  in a month with four entries. That is the $7/month argument in a surface.
- **P4, grounded** — every movement is a count, a date, a declared marking, or a verbatim
  line. Nothing on the page is a sentence the app wrote about her.
- **P1, light not verdict** — no vertical axis anywhere; brightness is recency, which is
  the Covenant sky's own encoding.
- **P3, the writing surface is sacred** — and it does something no Return surface has
  done: it *feeds* the editor rather than only drawing from it.

---

## Which principles it risks, adversarially

### P2 — this is where it lives or dies

A recurring page is a habit mechanic wearing vestments unless one property holds:

> **No occasion may accrue.** *(RECALL.md § Tenure, already written down.)*

Every weekly review anybody has shipped is **pending** tenure — it waits, it counts, and
being behind on it is the mechanic. That is why this product has no weekly review today.
An **occasional** page that simply expires has none of that, and the tradition's own
scheduling works this way: Advent arrives whether or not you were faithful, then leaves.

**Phil's "temporary artifacts" is therefore not a detail about export. It is the licence.**

**The test, and it is checkable:**

> A hook works by making you feel bad if you do not come back.
> An occasion works by being there whether or not you did.

The page must expire **unread** exactly as it expires read, and nothing may record which
happened. No badge, no "you missed", no count of unopened ones, **no archive of past
ones**. If a future build adds a list of previous pages, this surface has become an inbox
and the argument is over.

#### On "randomised"

Phil framed the draw as randomised-but-insightful, explicitly reaching for variable
reward. Decline the mechanism — it is the compulsion lever, and naming it insight does
not change what it does. It also breaks **P4** on its own: if the same span yields a
different page on Tuesday than on Wednesday, the app has admitted the selection was
arbitrary.

**Deterministic is both safer and better.** The same span always produces the same page;
the variety comes from her life differing season to season, which is real variety. And
she can show it to her husband and it still says the same thing.

### P1 and H2 — the heart, as posed, is forbidden

An inferred-sentiment view fails three independent tests, any one of which is fatal:

| | |
|---|---|
| **H2** | Never infer someone's interior state. |
| **P1** | No vertical axis — a falling line beside a span containing her mother reads as *you are doing worse*. |
| **D-016** | The writer supplies the signal. Recurrence is a count; significance is a verdict. |

`looking/README.md` also closed the rescue: a **declared** sentiment mark is still "Sense
with a mood attached", and any arrangement of it over time rebuilds the axis P1 forbids.

**What survives is stronger and it was already in the product.** The heart is not a
diagram of her emotions — it is **the shape of what she declared**: six chambers, six
declared kinds (`/pray`, `/desire`, `/sense`, `/story`, `/learned`, `/scripture`). She
cannot dispute it, which is what an inferred version could never claim.

Three constraints, all load-bearing:

- **Equal chambers.** Sizing by count makes the biggest cell the biggest thing in her
  heart, which is a portrait, and a portrait is the most total verdict a machine renders.
- **The count is printed.** A number you can read is arithmetic; a shape you can only
  feel is a claim.
- **Brightness is recency, and the page says so.** An unexplained visual encoding is what
  a reader fills in with a verdict.

*(The prototype's `shoji` reading argues the same six facts read better as light through
a screen than as chambers, on the grounds that **a chamber has an inside** and a screen
does not. Cost: it is dark, which fights the page's own light-on-dark argument and its
printability.)*

### H4 and P6 — the council

The largest risk in the whole idea, and the reason § The doctrine change exists.

- **H4 — never counsel, diagnose, prescribe.** Phil's own words were *"nudging or
  suggesting what they should do"*, which is H4's prohibition verbatim. **Selection is
  counsel**: if the app reads a season and reaches for a passage on perseverance, it has
  told her what her season means and what to do about it. Chrysostom's voice does not
  launder that — it makes it worse, because the advice now carries sixteen centuries of
  authority.
- **H3 — never invent.** Patristic quotation is a swamp; much of what circulates under
  Augustine's name he never wrote. A fabricated father is a *worse* failure than a
  misquoted verse, because there is no concordance in the reader's head to catch it.
- **H1 — never the divine voice.** A saint counselling a reader in the second person is
  the same failure at one remove. Nobody gets a voice, an avatar, or a persona.
- **P6 — their words, their theology.** A council is tradition-specific and this cost
  cannot be designed away, only mitigated (broadly-received writers, opt-in, the council
  named and visible on screen).

### P5 — the thin span

The honest failure mode is a page that arrives on schedule with nothing in it. The rule:
**the threshold is printed, the arrangement stops, and the page hands back the pages
themselves.** It never says she wrote less, did not keep it up, or has been away —
absence is not ours to interpret.

**And never a comparison, ever.** Not entry counts, not marking counts, not words.
GUARDRAILS' ✅ column permits *"You wrote 4 times this month, down from 14 in May"* as an
alternative to a verdict — but a delta printed at the top of a **recurring** page is a
streak counter in vestments, and P2 does not care what it is wearing. Scope, once. Never
a delta.

---

## The doctrine change, which is the real decision

The council is **the first thing Dayspring would ever show a user that is not theirs.**
Everything the product has ever displayed traces to a row she wrote. That rule has always
implied a second one nobody had to write down: *the app may show her nothing but her own
words.*

The proposed relaxation, narrow enough to state in a sentence:

> **Two grounded corpora — hers and the church's — and nothing between them.**

A passage is as verbatim, as cited, and as un-generated as one of her own sentences. It
comes out of a table, the same architecture the scripture layer already uses. What is
forbidden is the sentence that would sit *between* the two: any bridge, gloss,
application, or "this may speak to your season."

That bridge sentence is **the only sentence on the whole surface that would trace to no
row.** P4's test — *"for any sentence the app shows about the user, can we name the row it
came from?"* — fails on exactly that line and nothing else. It is a one-sentence
violation, warm and helpful and the kind anyone would wave through, which is what makes
it worth building a screen that shows it struck out.

**This needs a `DECISIONS.md` row before a line of it is built**, not after. It is a
change to what the product is, not a feature.

### The mechanism that keeps the model out of the chair

Three hops, all arithmetic, all auditable:

```
a word she wrote  →  a theme (a fixed editorial lexicon)
                  →  passages carrying that theme
```

No embedding, no model call, no network. Two properties matter more than accuracy:

- **It is the same for every user.** A model choosing per-person is characterising a
  person. A lookup table cannot characterise anybody — it does not know who you are.
- **The pin is always on screen.** Every passage carries the word of hers that reached
  it, so a wrong pin is *visibly* wrong. A model-selected passage offers nothing to check.

**Silence is a result.** A word with no theme, or a theme with no passage, gets nothing.
P4 is called "grounded, **or silent**" and the second half is the half everybody drops.

### The corpus is the feature, and it is a library problem

Building this for real means someone sitting with public-domain editions and typing.
Weeks, not tokens. And `edition` is the field that decides the budget, because **the
translation is the part that is owned**:

- Public domain, and Victorian: ANF (1885), Pusey's Augustine (1838), Warrack's Julian
  (1901), Longfellow's Teresa.
- In copyright, and what a modern reader wants: Ward's desert fathers above all.

**Archaic-and-free or contemporary-and-licensed** is a decision with a budget attached,
and it comes before the build.

*Also worth correcting gently:* the genuinely first-century Christian corpus outside the
New Testament is tiny — 1 Clement, the Didache, Ignatius' letters. The range is the first
four centuries plus the desert, and the desert sayings are the best fit anyway: short,
concrete, non-doctrinal, and already named in RECALL's `the word` mechanism.

---

## Where it lands

A **Return** surface, and it obeys the Return rule — you go there to see, never to do —
with one deliberate exception that is the whole point:

> **The last movement is a blank page.**

`SURFACES.md` splits Write and Return and the arrow only ever points one way: you write,
and later you return. Nothing has ever pointed back. **This is the only Return→Write path
in the app**, and it is the structural version of Phil's *"fuel prayer rather than be an
oracle."* Intent does not survive contact with a surface; structure does.

What may be in the new entry: **her own line, verbatim, as a blockquote, with its date.**
Not a prompt we wrote — the instant the app types a sentence into her journal it has
co-authored her prayer life, and there is no undo.

### What it does to the other surfaces

- **Threads & Ropes** — absorbed. It is flag-off with fixtures only and no users, and
  D-005 says *ship or delete*. This resolves D-005 as a side effect.
- **Ascent** — a real candidate, later. SURFACES already flags it as *"the surface most
  likely to make a user feel graded"* and P1 as *"genuinely at risk here"*. A span page
  with no vertical axis is a strictly safer form of the same job. But Ascent is shipped
  to beta, so this is a question to answer *after* the calls, from what people say about
  the span page — never by arguing about the Ascent.
- **Lamp** — no. Lamp answers "which verses kept finding me" across all time; it is
  permanent tenure and this is occasional. Take a *movement* (the verses in this span),
  never the surface.

---

## What would make us kill it

Ordered by how cheaply each fires.

1. **They ask to keep them all.** The moment "can I see last season's?" is a real request
   we are being asked to build the inbox, and the inbox is the thing P2 forbids. *(This is
   the most likely killer and the fastest to observe.)*
2. **The thin page reads as shame.** Show the three-entry span to someone in a dry
   season. If they feel scored rather than seen, the surface deepens the exact wound P2
   came in with, and no copy fixes it.
3. **Nobody catches the bad pin.** The fixture pins Augustine's restless heart to
   `want` — and one of the lines carrying it is a four-year-old not wanting to go into
   school. If a reader does not notice, the pin-is-visible defence of the council is
   decoration, and the council goes.
4. **They skim the questions.** They are the only movement already addressed to somebody.
   If people scroll past them, the "fuels prayer" claim is decoration too.
5. **They would not write anything at `onward`.** Then the terminal act is reading, the
   page is a conclusion, and it is an oracle after all.
6. **Anyone says "verdict", "grade" or "score" unprompted.** P1 failing out loud.
7. **The expiry reads as pressure rather than relief.** The licence does not hold.

---

## The cheapest way to find out

**Instrument what exists before building any of it.**

- The **Ascent** is the closest live analogue and we are not reading it. Visit rate,
  revisit rate, and time-on-surface for Ascent among beta users would tell us whether a
  retrospective surface gets opened at all, at the cost of an event.
- The **council** can be tested with *zero* corpus work: put two passages in front of five
  people on a call and ask whose voice it is. If the answer is "the app's", the whole
  doctrine change is moot and the library never gets typed.
- **Tenure** is the one thing that cannot be tested by asking. People will say they want
  to keep every page. Watch instead for whether they *ask* — an unprompted request is
  signal; a yes to "would you like to?" is politeness, and PERSONAS.md says so.

---

## Verdict

- **A (the span page) — Build**, smallest version: the head, `what you set apart`, `what
  you asked`, and `onward`. No council, no vocabulary. Four movements, all arithmetic, no
  model call anywhere.
- **D (expiry) — Build, first.** It is the licence for everything else.
- **E (onward) — Build.** Her line, never a prompt.
- **B (the heart) — Build the declared version.** Decline the inferred one permanently.
- **C (the council) — Test first, and write the `DECISIONS.md` row before building.**
- **H (variable reward) — Decline.** Deterministic per span.
- **G — Threads absorbed; Ascent revisited after the calls; Lamp untouched.**

---

## How to run the test

Method: **reaction piece inside a live call.** Not a link sent cold.

The click-through is [`prototypes/visitation/`](../../prototypes/visitation/). Open
`#notes` before the call. Press `S` to hide the route bar before sharing.

**Never say** *report, insights, review, summary, council, fathers, visitation*. The
screen says **Summer** and a year. If they ask what it is, the only sanctioned answer is
*"it showed up"* — then be quiet.

1. Run PERSONAS.md Q4 first, before anything is shown: *"When was the last time you went
   back and read something you wrote a year ago? What made you do it?"*
2. Share screen on `arrives`. Let them scroll the whole thing. Then: *"What is this?"*
   Silence. **The second thing they say is the true thing.**
3. `heart` — chambers, then shoji, then the mood line. *"Which of these would you rather
   have?"* If they pick the mood line, write it down; do not talk them out of it.
4. `council` — do not flag the passages. *"Whose voice is this?"* Then toggle the bridge.
5. `onward` — *"What would you write here?"*
6. `thin` — say nothing. Watch their face.
7. `gone` — *"What would you want to happen to it?"*
8. Never ask *"would you use this?"*

Record verbatim phrases. Per PERSONAS.md Q11 those become copy, and they will be better
than anything we write.

---

## Results

*(Fill in after the calls. Move statements from hypothesis to finding with the date
attached, then write the `DECISIONS.md` row — or write the row that kills it.)*

| Date | Who | Named it | Heart pick | Caught the bad pin? | Asked to keep them? | Verbatim phrases |
|---|---|---|---|---|---|---|
| | | | | | | |

---

## Related

- `PRINCIPLES.md` — 1 (light not verdict), 2 (never gamify), 4 (grounded), 5 (compounds)
- `GUARDRAILS.md` — H1–H4, and the denominational-neutrality test the council must pass
- `RECALL.md` § Tenure — where the expiry rule came from, and the six contemplative mechanisms
- `SURFACES.md` — the Write/Return split this puts an arrow back through
- `DECISIONS.md` — D-005 (Threads: ship or delete), D-016 (the writer supplies the signal)
- [`prototypes/visitation/`](../../prototypes/visitation/) — the click-through and the full argument
- [`prototypes/looking/`](../../prototypes/looking/) — the wall this sits downstream of
