# Product Decision Log

Newest first. One row per decision that shapes the product.

**The load-bearing column is "What would change our mind."** Without it this is an
archive; with it, it's an instrument you can re-run against new evidence. A decision
with no kill condition isn't a decision, it's a preference.

**Format:**

```
## D-00N — Title
**Date** · **Status:** Decided | Open | Superseded | Reversed
**Decision:** what we're doing
**Why:** the reasoning, honestly
**What would change our mind:** the falsifier
**Cost accepted:** what we're giving up
```

Seeded 2026-07-26 with decisions already implicit in the product, plus the open
questions the doc set surfaced. **D-001 through D-007 are OPEN** — they're the live
agenda.

---

## D-021 — Account deletion refuses rather than leave someone billed
**2026-08-10** · **Status:** Decided
**Decision:** deleting an account cancels any Stripe subscription first, and is
**refused** while the App Store is still set to renew — with the App Store pointed at,
and the reason said plainly. The gate reads Apple's live `autoRenewStatus`, not our
`plan`, so someone who cancelled an annual plan yesterday can delete today rather than
in eleven months.
**Why:** Guideline 5.1.1(v) forced the feature; the shape of it is ours. Once the
profile row is gone we hold no handle on either store, so a charge after deletion is
one nobody at Dayspring can stop or even see. Refusing is worse product for ten
seconds; the alternative is worse for a year, silently, and costs the user money.
**What would change our mind:** Apple shipping a server-side cancel. Then the refusal
has no excuse and both stores get cancelled on the way out.
**Cost accepted:** an App Store subscriber makes two trips, and we carry a live Apple
API call on a path that would otherwise be pure database work — which means deletion
can fail for a reason that isn't the user's fault. We block on "we don't know" anyway:
uncertainty about somebody's money resolves in their favour, not ours.

## D-008 — Product docs live in the repo, not Notion
**2026-07-26** · **Status:** Decided
**Decision:** `docs/product/` is the product source of truth. Notion holds anything a
human reads without a checkout — raw interview notes, launch copy, shared roadmaps.
Never dual-maintain a doc; one home each, link across.
**Why:** Docs only anchor building if they load into context automatically. Git diffs
also make drift visible: a PR that changes the paywall *and* `POSITIONING.md` is one
review. The proof is `personal-ai-journal-requirements.md` — it forbade multi-tenancy,
payments, and onboarding, all three shipped, and nothing caught it because nothing
forced it back into view.
**What would change our mind:** non-technical collaborators need to edit these regularly.
**Cost accepted:** slightly higher friction to edit; invisible to anyone without the repo.

## D-009 — The Covenant/Sky redesign is abandoned
**2026-07-26** · **Status:** Decided (reverses the 2026-06-24 direction)
**Decision:** Fully reverted, unshipped. The Altar→"Covenant" rename and the night-sky
visualization (`Sky.tsx`, ~156 lines of CSS, the Sky tab) are gone. The surface remains
**"Altar."**
**Why:** Phil's call — "I don't like the idea anymore." Chose full revert over parking it.
**What survived:** the **no-vertical-valence** rule, promoted to Principle 1. Height must
never imply better/worse in any Altar visualization.
**What would change our mind:** nothing currently. Don't re-propose the sky. The
bonds/constellations idea (matters that rise together around a shared root) was never
built and is the only piece worth revisiting.
**Cost accepted:** ~425 lines of working, tested code discarded.

---

# OPEN — the live agenda

## D-001 — "Obsidian for Christians" or "the journal that shows you God's faithfulness"?
**Status: OPEN — the most important unresolved question in the product.**
**The fork:** Dayspring's *surface area* is built for A (Tauri, CodeMirror, markdown,
shortcuts, no iOS) but its *soul* and best surfaces serve B (a near-universal emotional
job). Current implicit bet: **acquire A, deliver B.**
**What would settle it:** interview Q4 and Q11 (`PERSONAS.md`). If beta users describe
Dayspring in **craft** terms, we're A — go narrow, deep, premium. If they describe it in
**remembrance** terms, we're B — and desktop-first/markdown-first is costing us reach.
**Blocking:** all acquisition spend. A and B need different front doors; building the
wrong one is the most expensive available mistake.

## D-002 — The 14-day trial can't demonstrate the core value
**Status: OPEN.** Value compounds (Principle 5) and we refuse to fake depth — so a
fresh-start user sees the editor and essentially nothing else before being asked to pay.
Import users are fine; the backfill produces something immediately.
**Options:** longer trial for fresh starts · start the trial at first reflection rather
than signup · a guided first-week arc · accept that fresh-start is not a viable
acquisition path and that everyone arrives via import.
**What would settle it:** fresh-start vs import trial-conversion rates. **We are not
currently measuring this and should be.** → depends on D-003.

## D-003 — Instrument the onboarding fork
**Status: OPEN — cheapest high-value action available.**
The veteran/fresh fork in `OnboardingFlow.tsx` is a live persona experiment we aren't
reading. Split rate and per-branch trial conversion would directly test `VISION.md`
Bet 3 and settle D-002.
**Constraint:** Principle 7 — no analytics on entry *text*. Funnel events only.

## D-004 — Is there an invitational answer to consistency?
**Status: OPEN.** P2's question *"is journaling one more thing I'll fail at?"* is
uncovered by design — the obvious answers (streaks, reminders, guilt) all violate
Principle 2. Open question: is there an **invitational** form of support that survives a
Principle 2 review on its own merits?
**Default if unresolved:** stay uncovered. Better to serve fewer people honestly.
**Note:** feature requests in this shape are usually the P3 persona leaking through —
log them, don't build them.

## D-005 — Ship or delete Threads & Ropes
**Status: OPEN.** Built to P0–P1 on mock fixtures, flagged off, `data/` only, no shipped
UI. A half-built flagged surface carries maintenance cost with zero user value.
**Decide:** wire it to real data (one swap per dimension) or delete it.
**Lean:** delete unless it answers a persona question that Ascent and Altar don't. It
currently doesn't have one written down, which is itself the answer.

## D-006 — Do we ever answer "is this normal?"
**Status: OPEN — lean NO.** P2's loneliest question. Answering well seems to require
aggregate or comparative data, which collides with Principle 7 (privacy) and H2 (never
render a verdict) — comparison *is* a verdict with extra steps.
**Lean:** permanently uncovered, deliberately. But decide it rather than drift into it.

## D-007 — Crisis content has no handling
**Status: OPEN — most serious safety gap in the product.**
Entries may contain self-harm or suicidal ideation. Today, retrospective surfaces would
treat that content like any other text — summarizing it, reflecting it back, potentially
surfacing it months later without warning.
**Needed:** detection that *excludes* such content from retrospectives, plus a plain,
non-clinical resources card. Never analyze, never reflect, never surface.
**Why open, not decided:** needs care to avoid false positives that would feel like
surveillance — a serious Principle 7 and H4 risk in the other direction. But the status
quo (nothing) is worse.

---

# Historical — decisions already made, recorded for the "why"

## D-010 — Multi-tenant subscription product
**~2026-06** · **Status:** Decided. Reverses the founding single-user spec.
**Why:** other people wanted it; the value proposition generalizes.
**Cost accepted:** per-tenant isolation became a correctness requirement.
**⚠️ Outstanding:** the **cache-purge tenant-isolation bug** is a live Principle 7
violation and the highest-priority correctness issue in the product.

## D-011 — No end-to-end encryption
**Status:** Decided. E2E is incompatible with cloud synthesis, which is the entire value.
**Obligation accepted:** be unambiguous rather than imply more privacy than we deliver
(Principle 7). Never use language that implies E2E.
**What would change our mind:** on-device models good enough for multi-year synthesis.

## D-012 — Grounded architecture: facts in code, model only selects
**Status:** Decided. Load-bearing.
**Why:** a hallucinated memory in a spiritual journal is uniquely harmful — the user
can't distinguish it from their own past, and may retell it as testimony.
**Cost accepted:** less fluent, less impressive output than free generation.
**Now:** Principle 4 and Guardrail H3. **Next step:** make it structurally enforced —
a CI assertion that every generated quote string-matches a source entry.

## D-013 — No streaks, badges, or gamification
**Status:** Decided. Now Principle 2.
**Why:** devotion driven by a streak counter is devotion corrupted. If someone writes to
protect a number, we've made their prayer life worse.
**Cost accepted:** the single most reliable retention mechanic in consumer software.
**What would change our mind:** nothing. This is identity, not tactics.

## D-014 — Import from Day One and Diarly as the wedge
**Status:** Decided; **least-validated bet in the product.**
**Why:** people with existing archives have both the need and the switching trigger.
**What would change our mind:** import path stays cold, or importers churn faster than
fresh starts (which would mean we're setting expectations synthesis can't meet).
**Measurement:** D-003.

## D-015 — Alpha/stable channel split
**Status:** Decided. `master` → alpha (Phil only), `stable` → beta users.
**Why:** ship fast to one user, deliberately to everyone else. Notably, handwriting scan
shipped unflagged because the alpha channel *is* the gate.
