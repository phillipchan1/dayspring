# Product Principles

Seven tie-breakers. These exist to settle arguments, not to inspire — so each one is
written to be **testable** and each names **what it forbids** and **where it costs us**.
A principle that never blocks anything isn't a principle, it's a slogan.

When a proposed feature conflicts with one of these, the principle wins by default.
Overriding one is allowed, but it requires a row in `DECISIONS.md` saying so out loud.

---

## 1. Light, not verdict

Dayspring illuminates what happened. It never grades how you're doing.

The Altar already encodes this: a cairn's **heft** is how often a matter has been
brought, its **span** is how long it's been carried, and light means *God met you
here* — never *you did well here*. There is deliberately no vertical axis, because a
vertical axis would imply *better* and *worse*, and the app has no business making
that call about a person's walk with God. *(That no-vertical-valence rule is the one
thing that survived the abandoned Covenant/Sky redesign — see D-009.)*

**Forbids:** scores, grades, "spiritual health" metrics, progress bars against a
notion of maturity, any ranking of entries or seasons by quality, sentiment badges.

**Costs us:** scores are legible and demo well. "Your faith score is up 12%" is a
screenshot people share. We are giving up a viral mechanic on purpose.

**Test:** could a user screenshot this UI and feel judged by it? Then it's a verdict.

---

## 2. Never sermonize, never gamify

Already law in the codebase (`onboardingCopy.ts:2`), promoted here to product-wide.

Dayspring does not preach at the user and does not manufacture compulsion. The user
brought their own faith; they don't need ours. And devotion driven by a streak counter
is devotion corrupted — the moment someone writes to protect a number, we have made
their prayer life worse.

**Forbids:** streaks, badges, XP, "don't break the chain," guilt-shaped notifications
("you haven't written in 5 days"), inspirational quotes we chose, any copy that
instructs the user how to be a better Christian.

**Costs us:** streaks are the single most reliable retention mechanic in consumer
software. We are declining the best-known lever in the category.

**Test:** does this feature work by making the user feel *bad* if they don't act?
Then it's out, no matter how well it retains.

---

## 3. The writing surface is sacred

The editor is the soul of the product. Nothing gets to make it slower, busier, or
more interrupting.

Every millisecond of input latency, every element of chrome, every "just a small
badge" is a tax on the one experience users have with us *every single day*. AI
features live downstream of the writing, never inside it.

**Forbids:** anything that adds perceptible keystroke latency, AI suggestions or
autocomplete in the composing surface, upsells or nudges during a writing session,
modal interruptions while the cursor is active.

**Costs us:** inline AI writing assistance is what every competitor is shipping and
what a certain kind of user will ask for by name.

**Test:** does this change touch the editor's render or input path? Then it needs a
performance justification, not just a product one.

---

## 4. Grounded, or silent

Every claim Dayspring makes about a user's life must trace to something they actually
wrote. Facts are computed in code; the model's job is to **select and phrase**, never
to supply substance.

This is the existing architecture of the rollup pipeline and it should stay that way:
counts, dates, ranges, and frequencies come from queries; quotes are verbatim; the
model picks which true thing to say. A hallucinated memory in a spiritual journal
isn't a bug, it's a betrayal — the user cannot distinguish it from their own past.

**Forbids:** paraphrasing a user's words back as if quoted, inferred emotions
presented as fact, invented scripture references, any statement whose source entry
can't be pointed at.

**Costs us:** ungrounded generation is more fluent and more impressive in a demo.

**Test:** for any sentence the app shows about the user, can we name the row it came
from? If not, don't ship it.

---

## 5. Value compounds — don't fake it early

Dayspring is honest that it is thin on day one and rich in year three. We would rather
show an empty state that tells the truth than a manufactured insight that impresses.

This is why the processing engine has explicit `EMPTY` / `INSUFFICIENT` / `READY`
states instead of always rendering something. A weekly reflection built from two
entries is not a weekly reflection; it's a mirror pretending to be a window.

**Forbids:** generating synthesis below a data threshold, padding a sparse reflection
to look substantial, hiding the fact that a surface needs more history.

**Costs us:** day-one wow. New users see less than they would with a product willing
to bluff, and trial conversion is harder as a result.

**Test:** would this output embarrass us if the user compared it against their actual
entries for that period?

**Corollary — design for the dip.** At $7/month we must be worth it in the months
when someone writes four times. Retrospective surfaces have to keep paying out when
the writing habit doesn't.

---

## 6. Their words, their theology

Dayspring reflects the user's own language back to them. It does not adjudicate
doctrine, correct interpretation, or supply spiritual direction.

The Concordance exists for exactly this: it learns names and spellings — never moods,
never verdicts — so the app speaks the user's vocabulary rather than a generic
evangelical register. A Reformed user and a charismatic user should both feel the app
is theirs, and neither should feel corrected.

**Forbids:** doctrinal claims, interpreting a passage for the user, prescribing
practices, denominational assumptions in default copy, "God is telling you…"
constructions, any first-person divine voice.

**Costs us:** a strong theological point of view is a real marketing asset in this
category, and we're declining it.

**Test:** would a thoughtful Christian from a tradition different than Phil's read
this string and feel like a guest in someone else's house?

---

## 7. Private by default, and say so plainly

A spiritual journal is the most sensitive text a person owns. We are not end-to-end
encrypted, because cloud synthesis is the product — so the obligation is to be
**unambiguous** about that rather than to imply more privacy than we deliver.

**Forbids:** privacy language that implies E2E, training on user content, third-party
analytics on entry text, any surface that could leak one tenant's content to another,
sharing defaults that aren't explicitly chosen.

**Costs us:** "end-to-end encrypted" is a phrase that sells, and we can't say it.

**Test:** could a user read our privacy copy, then read our architecture, and feel
misled? Then the copy is wrong.

**Open item:** the cache-purge tenant-isolation bug is a live violation of this
principle and gates the multi-user rollout. It is the highest-priority correctness
issue in the product.

---

## Using these

For any new idea, the `/ideate` flow asks:

1. Which persona, and which of *their* questions does it answer?
2. Which principle does it serve?
3. Does it violate any principle? If yes — is this a deliberate override
   (→ `DECISIONS.md`) or a bad idea?
4. Which surface does it land on (`SURFACES.md`)?
5. What would make us kill it?

Ideas that can't answer 1 and 5 don't get built.
