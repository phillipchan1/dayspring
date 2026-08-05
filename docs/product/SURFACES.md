# Surfaces

> **Status:** Draft 1, 2026-07-26. Inventory verified against `src/features/` and
> `Rail.tsx`. The **promise** and **persona question** columns are best guesses —
> that's the point: they're claims to check the live app against, not descriptions of it.

This is the audit instrument. Every surface must be able to answer:

1. **What does it promise?** (one sentence, in the user's terms)
2. **Which persona question does it answer?** (from `PERSONAS.md`)
3. **Which principle does it serve, and which does it risk?**
4. **What's its state?**

A surface that can't answer 1 and 2 is either unfinished or shouldn't exist.

---

## The organizing structure

The rail splits into **Write** and **Return** — and that split is the product's whole
thesis, not a nav convenience.

| | Surfaces | Job |
|---|---|---|
| **Write** | New entry, Entries | Capture. Must be frictionless and sacred (Principle 3). |
| **Return** | Ascent ⌘2, Lamp ⌘3, Altar ⌘4, Remember ⌘5 | **Reflective, never operational.** Reveal what a paper journal can't. |

**The rule for every Return surface: you go there to *see*, never to *do*.** No tasks,
no maintenance, no inbox. The moment a Return surface asks the user to *work*, it has
become a to-do list about their prayer life — which is a Principle 1 and 2 violation
wearing a UI. *(This rule survived the abandoned Sky redesign and is the most valuable
thing that came out of it.)*

---

## Write surfaces

### The Editor — `features/journal/`
- **Promise:** "Writing here feels better than anywhere else, and nothing gets in the way."
- **Answers:** *(all personas, daily)* — the reason they open the app at all.
- **Serves:** P3 (sacred writing surface). **Risks:** nothing, if kept clean.
- **State:** ✅ Shipped, mature. CodeMirror 6, focus mode, typewriter scrolling,
  paragraph dimming, themes, fonts, offline-first with outbox sync.
- **Audit:** *Has anything been added to the editor since last review that adds latency
  or chrome?* This surface degrades by accretion, one reasonable addition at a time.

### Capture — `features/capture/`
Inline commands (`/pray`, `/sense`, `/scripture`, `/image`), voice dictation, handwriting scan.
- **Promise:** "Get it down the way it comes out — typed, spoken, or on paper."
- **Answers:** *"Will this fit how I actually journal?"*
- **Serves:** P3. **Risks:** P3 — every new inline affordance is editor surface area.
- **State:** ✅ Voice + inline commands shipped. Handwriting scan shipped to alpha only
  (unflagged; the alpha channel is the gate). Attaching the original photo deferred.
- **Audit:** *Is the command palette still discoverable without being intrusive?*
  Handwriting scan is an **A-persona feature aimed at a B-persona behavior** (paper
  journalers) — if the A/B question in `POSITIONING.md` resolves toward B, this becomes
  much more strategically important than it looks today.

---

## Return surfaces

### The Ascent — `features/ascent/` · ⌘2 · *"The climb through your seasons"*
- **Promise:** "See the shape of where you've been — Valley, Hillside, Ridge, Summit."
- **Answers:** P2 *"Is anything actually happening, or have I been standing still?"* ·
  P1 *"Am I the same person?"*
- **Serves:** P4 (grounded), P5 (compounds), P1 (elevation as terrain, not score).
- **Risks:** **P1 is genuinely at risk here.** Elevation is the one metaphor in the
  product with an implied up/down. "Valley" must read as *terrain you passed through*,
  never as *low performance*. This is the surface most likely to make a user feel graded.
- **State:** ✅ Shipped. Arcs, tensions, refrain in rollup JSONB. Verbatim-refrain
  guardrail verified live. ⚠️ Ridge tensions blocked — prod `insights_type_check` is
  missing `'quarterly'` (migration pending via SQL editor).
- **Audit:** Show a Valley to someone in a hard season. Do they feel *seen* or *scored*?
  This is the single highest-value guardrail test in the product.

### Lamp — `features/scripture/` · ⌘3 · *"The verses you return to"*
- **Promise:** "See where Scripture has actually intersected your life."
- **Answers:** P1 *"Which verses kept finding me?"* · P2 *"Has anything been speaking to me?"*
- **Serves:** P4, P6 (their words, their theology — it reflects *their* engagement,
  never assigns reading).
- **Risks:** **H3 (never invent) is at maximum stakes here.** A misquoted verse presented
  as canonical is the most damaging output the product can produce. Also P6 — must not
  drift toward recommending passages.
- **State:** ✅ Shipped P0–P2. Map, seasons, book view with chapter strip + timeline +
  verse threads, live capture on save, editor underline. Backfilled (263 refs). Allusion
  AI pass deferred *(good — it's the highest-hallucination-risk idea in the backlog)*.
- **Audit:** *Is every verse string sourced from the scripture layer or the user's own
  entry — never from model memory?*

### Altar — `features/altar/` · ⌘4 · *"The prayers you return to"*
- **Promise:** "The things you keep bringing to God, and what came of them."
- **Answers:** P1 *"Did God answer any of this?"* · P2 *"Has He answered anything?"*
- **Serves:** P1 (**light = encounter, not verdict** — this surface is where that rule
  was discovered), P4, P5.
- **Risks:** P1, constantly. Any visual encoding of a matter's "status" edges toward
  scoring someone's answered-prayer rate.
- **State:** ✅ Shipped P0–P2, flag graduated (default on). Cairns/arcs/encounters,
  Subjects + Over-time tabs. Backfilled (4 threads).
- **History:** A "Covenant" rename + night-sky visualization was built and **fully
  reverted, unshipped, 2026-07-26.** Its one durable output is the rule now encoded as
  Principle 1: **no vertical valence — height must never imply better/worse.** Don't
  re-propose the sky.
- **Audit:** *Does any encoding here let a user rank their prayers, or rank themselves?*

### Remember — `features/remember/` · ⌘5 · *"What you've set apart"*
- **Promise:** "Get back to what you set apart, and ask the rest."
- **Answers:** P1 *"I have eleven years in here. What's in it? I genuinely don't know."* ·
  the notebook journaler's *"can it help me find the things I highlighted?"*
- **Serves:** P1 (**the writer supplies the signal, never the app** — this is the only
  surface where significance is asserted, and it's asserted by the user), P4 (a passage
  *is* a verbatim quote by construction), P5 (compounds without AI; keeps paying out in
  a month with four entries).
- **Risks:** **PKM drift.** "Search" invites tags, folders, colours, saved queries. The
  rule that holds the line: *marking is one gesture with no decision attached.* Also the
  weather grid — see below.
- **State:** 🚧 Built, flag OFF (`VITE_FF_REMEMBER`). Four sources: marks (`marks` table),
  blockquotes, markdown emphasis, and writer-declared `/pray` blocks. Migration
  `20260802120000_marks.sql` pending — apply via the SQL editor.
- **What it deliberately excludes:**
  - **Scripture refs.** The Lamp owns verses. On the real archive they were 284 of 563
    passages, which would have made this half a second Lamp.
  - **Altar-harvested `spiritual_items`** (`source = 'scanned'`, ~6.2k rows). Those are
    model *inferences*. Showing an inference as something the writer set apart is the app
    asserting significance it decided on. The filter `.is('source', null)` in
    `useRemember.ts` is load-bearing.
- **Audit:** ⚠ **The weather grid is one decision away from a contributions graph**,
  which is a streak grid, which is a Principle 2 violation. It is only ever drawn over
  passages or over the matches for a question — **never over writing activity** — and
  carries no totals, no goal, no current-streak. *Show it to someone in a dry season: does
  it read as weather, or as a record of how often they failed to show up?* Second test,
  per the Return rule: *open it in a month with four entries. A way back, or an inbox?*

---

## Flagged / incomplete

| Surface | State | Assessment |
|---|---|---|
| **Concordance** (`features/concordance/`) | Engine on and populating silently; drawer flag OFF (`VITE_FF_CONCORDANCE`) | **Correctly invisible.** It's infrastructure for P6 — learns names and spellings, never moods. It's what lets the app speak the user's vocabulary instead of a generic evangelical register. Also powers voice-dictation biasing. Keep the UI off unless users ask to curate. |
| **Threads & Ropes** (`features/threads/`) | Flag OFF (`VITE_FF_THREADS_ROPES`), `data/` fixtures only, no shipped UI | **Needs a decision.** Built to P0–P1 on mocks, then parked. Either wire it to real data or delete it — a half-built flagged surface is carrying cost with no user. → D-005. |
| **Reflect** (`features/reflect/`) | Single dir, superseded by Ascent | **Probable dead code.** Ascent replaced the old reflections UI. Verify and remove. |

---

## Supporting surfaces

| Surface | Promise | State | Audit note |
|---|---|---|---|
| **Welcome** (`features/welcome/`) | "Here's what this becomes." | ✅ Carousel, the onboarding front door | Slides carry the strongest positioning copy in the product. Should match `BRANDSCRIPT.md`. **The altar slide's copy was reverted with the Sky work — re-verify it reads correctly.** |
| **Onboarding** (`features/onboarding/`) | "Get your history in, or start today." | ✅ Shipped; veteran/fresh fork | **The fork is a live persona experiment we aren't reading.** Instrumenting split rates + conversion is the cheapest validation available. → D-003 |
| **Paywall** (`features/paywall/`) | "$7/mo, 14 days free." | ✅ Stripe; system browser on desktop | Trial can't demonstrate core value for fresh starts. → D-002 |
| **Settings** (`features/settings/`) | Control the writing surface. | ✅ Themes (9 palettes + light/dark), fonts, focus prefs | Serves P3. Healthy. |
| **Shortcuts** (`features/shortcuts/`) | Keyboard-first. | ✅ | An **A-persona artifact**. Its prominence is a signal in the A/B question. |

---

## Coverage check

| Persona question | Surface | Covered? |
|---|---|---|
| "What's in my archive?" | Ascent + import | ✅ |
| "Am I the same person?" | Ascent | ✅ |
| "Did God answer any of this?" | Altar | ✅ |
| "Which verses kept finding me?" | Lamp | ✅ |
| "Is my archive safe / portable?" | Settings export | ⚠️ Works; never *said*. Agreement-plan copy is missing from marketing. |
| "Will this fit how I journal?" | Capture | ✅ |
| **"Is this normal? Do others go through this?"** | — | ❌ **Uncovered.** P2's loneliest question. Answering it well probably requires aggregate/comparative data, which collides with Principle 7 and H2. Possibly correct to leave permanently uncovered — but decide deliberately. → D-006 |
| "Can it help me find the things I highlighted?" | Remember | 🚧 Built, flagged off |
| **"Is journaling one more thing I'll fail at?"** | — | ❌ **Uncovered by design.** The obvious answers are streaks and reminders (Principle 2 violations). The unsolved question is whether there's an *invitational* answer. → D-004 |

---

## Running the audit

Quarterly, or before any major build. For each surface:

1. Does the live UI still deliver the stated promise?
2. Does it still answer its persona question, or has it drifted into feature-collection?
3. Run its **audit note** above — those are the specific failure modes.
4. Any new element that scores, ranks, nudges, or instructs? (P1, P2, H2, H4)
5. Any displayed claim that can't be traced to a user's row? (P4, H3)

Log drift and decisions in `DECISIONS.md`.
