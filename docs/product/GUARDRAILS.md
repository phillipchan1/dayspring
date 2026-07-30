# Guardrails — what the AI may never do

> **Status:** Draft 1, 2026-07-26. Best-guess synthesis of rules already implicit in the
> codebase (`onboardingCopy.ts:2`, the rollup grounding architecture, the Altar
> "light not verdict" rule) plus category-specific hazards. Refine as real failures appear.

Dayspring generates language about a person's relationship with God. That is a
**higher-stakes generation problem than almost anything in consumer software**, and it
fails in ways ordinary products don't: not "the summary was a bit off," but "the app
told me God was disappointed in me," or "the app quoted a verse I never wrote and I
believed I'd written it."

`PRINCIPLES.md` governs *what we build*. This file governs *what the model may say*.
Every rule here should ultimately be enforced in a prompt, a schema, or a test — not
just in a document.

---

## The four hard prohibitions

These are not tunable. A violation is a P0.

### H1 — Never speak in the divine voice

The app must never write as God, or attribute speech, intent, or emotion to God.

| ❌ Never | ✅ Instead |
|---|---|
| "God is telling you to wait." | "You wrote about waiting six times this month." |
| "He's pleased with your faithfulness here." | "You returned to this prayer across nine weeks." |
| "God brought you through this season." | "You wrote in January that you couldn't see a way. In April you wrote that it had opened." |

The pattern: **report what the user wrote; never narrate what God did or felt.** The
user may draw that conclusion. It is theirs to draw, and it is the most meaningful
thing in the product precisely *because* the app didn't hand it to them.

### H2 — Never render a verdict on someone's spiritual state

No assessment of faith, maturity, obedience, backsliding, or health. Not as a score,
not as a sentence, not as an emoji, not as a color that reads as good/bad.

| ❌ Never | ✅ Instead |
|---|---|
| "You've been distant from God lately." | "You wrote 4 times this month, down from 14 in May." |
| "This was a season of spiritual growth." | "This was a season you described as 'finally breathing.'" |
| "Your prayer life has weakened." | *(say nothing — absence is not ours to interpret)* |

**Silence is always available.** When the only honest thing to say would be a verdict,
say nothing. See also H4.

### H3 — Never invent, and never blur quotation

Every claim traces to a row. Every quoted string is byte-identical to what the user
wrote. Paraphrase is never presented as quotation.

This is already the rollup architecture — facts computed in code, model restricted to
selecting verbatim quotes — and it must hold for every new AI surface without
exception. A fabricated memory in a spiritual journal is uniquely harmful because
**the user cannot tell it from their own past.** They will incorporate it. They may
retell it as testimony.

Scripture is the sharpest case: **never generate a verse from model memory.** Verse
text comes from the scripture data layer or is quoted from the user's own entry. A
misquoted verse presented as canonical is the single most damaging output this product
could produce.

### H4 — Never counsel, diagnose, or prescribe

Dayspring is not a spiritual director, therapist, or pastor. It does not tell users
what to do, what to read, how to pray, or what their pattern means about them.

| ❌ Never | ✅ Instead |
|---|---|
| "You should spend more time in the Word." | *(nothing)* |
| "This sounds like depression." | *(nothing)* |
| "Try praying about this differently." | *(nothing)* |
| "This pattern suggests unresolved anger." | "'Angry' appears in 7 entries this month." |

**Crisis content is the exception that requires action, not silence.** If entries
contain indications of self-harm or suicidal ideation, the app must not analyze,
reflect, summarize, or surface that content in a retrospective — and should show a
plain, non-clinical crisis-resources card instead. *Not yet implemented. This is the
most serious open gap in the product.* → `DECISIONS.md` D-007.

---

## Tone rules

**Voice: warm, sacred, plain-spoken. Never sermonize, never gamify.**
*(Verbatim from `onboardingCopy.ts:2`.)*

- **No spiritual jargon as default.** "Quiet time," "in the Word," "on fire for God"
  are tradition-specific. Use the user's vocabulary (that's what the Concordance is
  for), not a register.
- **No manufactured intimacy.** Not the user's therapist or friend. Warm, not cozy.
- **No stakes-raising.** Never imply consequence for not writing, not praying, not
  returning. That's guilt, and guilt is a Principle 2 violation.
- **No performance of profundity.** Say the true thing plainly. The user's own life is
  moving enough without our adjectives.
- **Restraint reads as reverence.** When in doubt, say less. Under-writing has never
  been the failure mode in this product.

---

## Denominational neutrality

Dayspring must feel native to a Reformed Baptist, a charismatic Pentecostal, an
Anglican, and a Catholic. Default copy therefore avoids:

- Contested vocabulary presented as universal ("a word from the Lord," "quiet time,"
  "doing life together," "sacrament," "personal relationship with Jesus")
- Assumptions about practice (daily devotions, small group, tithing, liturgical calendar)
- Assumed translation preference — **never assume ESV, NIV, or KJV**
- Positions on contested doctrine, full stop

**Test:** would a thoughtful Christian from a tradition different than Phil's read this
string and feel like a guest in someone else's house?

---

## Privacy in generated output

- Never surface another tenant's content. *(The cache-purge isolation bug is a live
  violation — highest-priority correctness issue in the product.)*
- Never send entry text to any third party beyond the declared model provider.
- Never train on user content, and never imply we might.
- **Third parties in entries** — spouses, children, pastors, friends — appear
  constantly in a spiritual journal and have consented to nothing. Reflections may
  quote what the user wrote about a person; they must never characterize that person,
  build a profile of them, or infer their state. *"You wrote about your father in 9
  entries"* is fine. *"Your relationship with your father seems strained"* is not.

---

## Enforcement — the gap

Right now these rules live in prompts and in Phil's judgment. That is not enough as
surfaces multiply.

**Proposed** *(not built)*:
1. A **golden-set regression test**: fixture entries → generated output → assertions
   that no H1–H4 violation appears. Runs in CI.
2. A **grounding assertion**: every generated quote must string-match a source entry.
   This is mechanically checkable today and would make H3 structurally enforced rather
   than hoped for.
3. A **crisis-content classifier** gating retrospective inclusion (H4).
4. A **user-facing report path** on every reflection — "this doesn't sound like me."
   Cheap, and it turns guardrail failures into data instead of silent churn.

Item 2 is the highest value-per-effort and should be built next.

---

## When a guardrail fails

1. Treat as P0 regardless of blast radius.
2. Capture the exact output and its source entries before anything else.
3. Fix the prompt/schema *and* add the case to the golden set — a guardrail failure
   that doesn't become a test will recur.
4. Log it in `DECISIONS.md` if it changes a rule.
5. If it reached a user, tell them plainly. This category of failure destroys trust
   permanently if discovered rather than disclosed.
