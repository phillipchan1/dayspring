# Scripture in the journal flow — validating OPP-K2 / OPP-K3

> **Status:** Draft 1, 2026-08-18. **Nothing here is decided.** This is the frame and the
> test plan for a scripture opportunity cluster from one real beta interview. A
> `DECISIONS.md` row gets written only after a walkthrough comes back, and only if
> something survives.
>
> **Click-through:** [prototypes.usedayspring.app/scripture/#intro](https://prototypes.usedayspring.app/scripture/#intro)
> (short: [scripture.prototypes.usedayspring.app](https://scripture.prototypes.usedayspring.app/#intro)) ·
> [`prototypes/scripture/`](../prototypes/scripture/). Local:
> `cd prototypes/scripture && npm install && npm run dev`. Self-guided — opens on
> `#intro`, footer notes on every screen. Safe to send the link.

---

## The cluster

One interview — Kristi (Aug 4), strong ICP fit — produced two opportunities under a
parent job on the opportunity-solution tree:

| | Opportunity | ID |
|---|---|---|
| **Parent** | Scripture engagement without leaving the journal flow | OPP-KG1 |
| **K2** | Wants to read the whole chapter/book around a verse without leaving journal flow | OPP-K2 |
| **K3** | A pasted or typed verse needs to count as scripture landed on, so it can be returned to later | OPP-K3 |

Judy's interview (Aug 12) does not mention this job. **Evidence is n=1.**

**They are one loop: Land → Sit → Return.** A verse that lands in the entry is worth
nothing if she can't sit with its context; a verse she sits with is worth nothing if it
doesn't light Lamp when she pasted it from bible.com.

---

## What she actually said

**K2 — sit with the chapter.** She already leaves Dayspring for bible.com, finds a verse,
and pastes it. `/scripture` works for a topic or a specific reference; it fails when she
types a book (`Colossians`) because the parser intentionally ignores bare book names. After
a verse hits, she wants the rest of the chapter:

> "If I just want to journey through Colossians… I haven't been able to find a way… to
> just have the Bible somewhere."

> "A lot of times I want to then read the whole chapter of James 4… sit with that… God,
> what else are you saying there."

Phil told her the full Bible isn't in-app for copyright. The interview's own assumption
test: prototype "open surrounding passage" **even via an external link**, and watch whether
they stay in flow.

**K3 — a pasted verse has to count.** Copy/paste is her real capture path. Lamp only
lights from `/scripture` blocks and parsed references, so paste looks like her own typing:

> "When I go to my ascent or returns, it is not captured… because I copied and pasted in.
> It looks just like my typing."

The insight in Notion: **tracking the "God highlighted this" moment matters more than a
pretty insert.**

---

## Constraints that kill some ideas

- **VISION.md** — not a Bible app or reading plan. YouVersion owns that. Dayspring is
  downstream of reading.
- **Principle 3** — the editor is sacred. A Bible chrome layer during writing is a tax.
- **Principle 6 / GUARDRAILS** — don't interpret the passage, don't prescribe "you should
  read the rest," don't silently assume a translation.
- **H3** — verse text comes from the ESV layer or the user's own words — never model memory.
- **Crossway** — the existing ESV API helper is licensed for **quoting** (attribution in
  settings), not for shipping a reader. Fetching *one chapter of context* is a different
  legal shape than "journey through Colossians."

Useful distinction: **passage expansion** (James 4 around 4:8) vs **Bible browsing** (pick
any book, keep going). Kristi asked for both. Only the first is obviously ours.

---

## ESV API / Crossway limits (what "in-app" can actually show)

Source: [api.esv.org](https://api.esv.org/) and [Crossway permissions](https://www.crossway.org/permissions/).
The app already quotes under the short-form attribution in settings (`api/_lib/esv.ts`).

**Rate limits are not the bottleneck.** 5,000 queries/day, 1,000/hour, 60/minute. Cache
hits (our `scripture_text` table) don't count.

**Display / store / query cap — this is the product constraint:**

| Limit | Rule |
|---|---|
| Per query | Up to **500 verses, or half a book, whichever is less** (single- and double-chapter books excepted) |
| On one page | Same: **500 verses or half a book** |
| Local cache | Same: **500 verses or half a book** |
| Redistribute | 500 verses, and not 50% of a book, and not 50% of the surrounding work |

That maps cleanly onto the prototype bets:

| Idea | Typical size | Inside the cap? |
|---|---|---|
| Quote one verse (today's `/scripture`) | 1 verse | Yes. This is what we already do. |
| **C. Read-around one chapter** | James 4 = 17 verses. Longest chapter in the Bible is Psalm 119 = 176. | **Yes, always.** One chapter never hits 500. Half-book is the only watch-out on tiny books (Jude, Philemon, 2–3 John) — and those are excepted as single-chapter. |
| **D. Journey a whole book** | Colossians = 95 verses, 4 chapters. Half of Colossians ≈ 47 verses. | **Whole book: no.** Chapter-by-chapter display of *one chapter at a time* is fine; paging through and *keeping* the whole book in cache/on screen is not. |
| Full canon / Bible app | ~31k verses | Formal license. Crossway licenses to **organizations, not solo developers**. |

**The bigger catch is commercial use.** The free API is for **non-commercial** sites: no
charge for access, not primarily designed to sell a service. Dayspring is a $7/mo journal.
Quoting a verse the user asked for is the existing (attribution) path. Shipping a chapter
reader on the paid product is a different shape — likely needs a commercial license, or
we **link out to esv.org** (A) and never display the chapter ourselves.

Practical reading: **C is legally the same size as quoting, commercially maybe not.** A
is the cheap disproof that needs no license change. D is over the half-book line even
before commercial status.

---

## Solution bets (ideate, then show)

### K2 — read around

| Idea | What it is | Kill if |
|---|---|---|
| **A. Link to ESV.org** | Verse block → `esv.org/James+4:8` (chapter in context) | On a call she says "that's what I already do with bible.com" |
| **B. Open in *her* Bible** | Preference: ESV.org / bible.com / YouVersion | She wanted it *in* the journal, not a better handoff |
| **C. In-app read-around** | Click verse → quiet pane of **that chapter only**, journal still visible | She tries to keep tapping "next chapter" and is annoyed it stops |
| **D. Book journey** | Type `Colossians` → chapter 1 full text, next/prev | Treat as contrast — this *is* a Bible app |
| **E. Don't build reading** | "Keep a Bible nearby" | She keeps leaving for bible.com and paste still doesn't track |

**Lean:** **C** is product-shaped. **A** is the cheap disproof. **D** is overreach we show
so you can feel it.

### K3 — pasted verse counts

| Idea | What it is | Kill if |
|---|---|---|
| **G. Mark selection** | Highlight → "keep as scripture" | She never remembers to mark. **Parked — we don't want her to do work.** |
| **H. Auto-land** | Paste from bible.com → recognized as James 4:8 → becomes a scripture block, Lamp lights. No confirm. | A wrong match is shown as "your verse" (H3). Or she doesn't notice it happened. |
| **I. Body match against ESV** | Fuzzy-match pasted paragraph to canon | Instant kill if a false match is presented as canon |

**Lean:** **H** is the hero. Same chrome as `/scripture`. Writer pasted the words; we only
recognize and wrap. Confirm chips and mark-toolbars are work.

**Not in prototype:** recommending passages, reading plans, guilt about "the Word,"
translation picker, or anything inside the real editor.

---

## Prototype scenes

Self-guided walkthrough. Intro + five ideas. Footer notes on every screen — safe to send the link.

| Step | Scene | What it shows |
|---|---|---|
| 1 | **intro** | What this is and how to use it |
| 2 | **today** | Control — Colossians gap, pasted verse stays plain text |
| 3 | **link** | A — tap verse → ESV.org chapter |
| 4 | **around** | B — one chapter beside journal + link out to go deeper |
| 5 | **land** | C — paste auto-becomes scripture block |
| 6 | **prefer** | Pick A / B / C / something else → Resend email to hello@usedayspring.app |

Full book browse was removed — not shippable under Crossway limits and product scope.

---

## What would change our mind

- **K2 survives** if, on a walkthrough, she reaches for "read around" before asking about
  Lamp — context is the blocker, not tracking.
- **K3 survives** if she notices the pasted verse became a scripture block without being
  asked, and says that's how she actually captures.
- **A only** if she says ESV.org link is enough and in-app reading feels like scope creep.
- **D only** if C feels incomplete and she explicitly wants book-level journey — then
  revisit copyright and vision non-goals deliberately, not by accretion.
- **Both killed** if she says "I'll keep bible.com open beside me" and doesn't care about
  Lamp for pasted verses — then OPP-KG1 is mis-scoped for this ICP.

Nothing ships from this doc. Prototype first, Kristi second pass after.
