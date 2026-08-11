# Dayspring — Product Documentation

The product layer: *why*, *for whom*, and *what would change our mind*.
Engineering plans live one level up in `docs/`; this directory is the thing they're
supposed to serve.

**Read before proposing product work.** These docs exist to anchor brainstorming to
what's true, and to make "audit the app against what we said we believed" a mechanical
pass instead of a vibe check.

---

## The set

| Tier | Doc | Read it when | Status |
|---|---|---|---|
| **Constitution** | [VISION.md](./VISION.md) | Scoping anything; questioning direction | ✅ Draft 1 |
| | [PRINCIPLES.md](./PRINCIPLES.md) | Two good options conflict | ✅ Draft 1 |
| | [GUARDRAILS.md](./GUARDRAILS.md) | Touching anything the AI *says* | ✅ Draft 1 |
| **Who & why** | [PERSONAS.md](./PERSONAS.md) | Any feature idea; writing copy | ✅ Draft 1 — **hypotheses** |
| | [BRANDSCRIPT.md](./BRANDSCRIPT.md) | Writing user-facing words | ✅ Draft 1 |
| | [POSITIONING.md](./POSITIONING.md) | Competitive or pricing questions | ✅ Draft 1 — best guess |
| **Operating** | [SURFACES.md](./SURFACES.md) | Auditing; adding a surface | ✅ Draft 1 |
| | [DECISIONS.md](./DECISIONS.md) | Making or revisiting a call | ✅ Seeded — **7 open** |
| | [GLOSSARY.md](./GLOSSARY.md) | Naming anything | ✅ Draft 1 |
| | [MEASUREMENT.md](./MEASUREMENT.md) | Adding any event; asking "how would we know?" | ✅ Live 2026-08-11 |

## Commands

| Command | Does |
|---|---|
| `/ideate <idea>` | Runs an idea through the frame: persona → principle → risk → surface → kill condition → verdict |
| `/product-audit [scope]` | Checks the live app against stated promises, principles, and guardrails |

Superseded: [`docs/archive/personal-ai-journal-requirements.md`](../archive/personal-ai-journal-requirements.md)
— the single-user founding spec, kept for architectural history only.

---

## Ground rules

1. **Repo, not Notion, for anything that anchors building.** If Claude should read it
   before writing code, it lives here. If a human should read it without a git
   checkout — interview notes, launch copy, shared roadmaps — it lives in Notion.
   **Never dual-maintain a doc.** One home each, link across.
2. **Mark epistemic status.** Hypothesis vs. finding, with a date. `PERSONAS.md` is
   currently all hypothesis and says so at the top.
3. **Non-goals get updated, not abandoned.** The founding doc rotted because nothing
   forced it back into view. When a non-goal stops being true, change it *and* log why.
4. **Decisions carry a kill condition.** "What would change our mind" is the column
   that turns a log into an instrument.

## The single highest-value open action

`PERSONAS.md` § *How to falsify these* — five 20-minute beta interviews. Everything
in this directory is reasoning until those happen. Generic feedback is a symptom of
generic questions; that script fixes the questions.

Two questions in that script settle the biggest open decision (**D-001**, are we a
craft product or a remembrance product): **Q4** *"when did you last read something you
wrote a year ago?"* and **Q11** *"what would you tell a friend this is?"*

## Open decisions

`DECISIONS.md` carries **6 open items**. The ones that block other work:

- **D-001** — craft product or remembrance product? *Blocks all acquisition spend.*
- **D-002** — the 14-day trial can't demonstrate the core value to fresh-start users
  *(now measurable — the funnel is instrumented; needs a trial cohort to read)*
- **D-007** — crisis content has no handling *(most serious safety gap)*

**D-003 is resolved** (2026-08-11) — the onboarding fork is instrumented. See
[MEASUREMENT.md](./MEASUREMENT.md). It unblocked D-002, which now waits on data
rather than on engineering.
