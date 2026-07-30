---
description: Run a product idea through the Dayspring product frame
---

Run this idea through the product frame: **$ARGUMENTS**

First read these (all of them, before responding):
- `docs/product/VISION.md` — the promise, non-goals, the bets
- `docs/product/PRINCIPLES.md` — the 7 tie-breakers
- `docs/product/PERSONAS.md` — who it's for (**hypotheses**, not findings)
- `docs/product/GUARDRAILS.md` — if the idea generates any user-facing language
- `docs/product/SURFACES.md` — where it would land

Then answer in this order. Be concise and direct — this is a thinking tool, not a report.

**1. Whose problem is this?**
Name the persona and quote the specific question from `PERSONAS.md` it answers. If it
doesn't map to one of their stated questions, say so plainly — that's usually the
finding, and it's often the P3 persona leaking through as a feature request.

**2. Which principle does it serve?**

**3. Which principles does it risk?**
Check all seven, and be adversarial here. Pay special attention to:
- P1 — does it score, rank, or imply better/worse about someone's walk with God?
- P2 — does it work by making the user feel bad if they don't act?
- P3 — does it touch the editor's render or input path?
- P4 — can every claim it makes be traced to a user's row?
- P5 — does it need more data than a new user has?

If it generates language, check H1–H4 in `GUARDRAILS.md` too.

**4. Where does it land?**
Which surface, and is it a **Write** or **Return** surface? Remember the rule: Return
surfaces are for *seeing*, never for *doing*.

**5. What would make us kill it?**
The falsifier. **An idea that can't answer this doesn't get built.**

**6. What's the cheapest way to find out if it's right?**
Prefer instrumenting something that already exists over building something new.

**7. Verdict.** One of:
- **Build** — clears the frame, with the smallest version described
- **Test first** — promising, but cheaper to validate than to build; say how
- **Park** — good idea, wrong time; say what would unblock it
- **Decline** — violates a principle; name which, and whether it's worth a deliberate
  override (which requires a `DECISIONS.md` row)

Don't soften a Decline. The principles exist to lose arguments with, and an idea that
survives every frame is usually an idea nobody examined.

If this results in a real decision, offer to add it to `docs/product/DECISIONS.md`
with a "what would change our mind" line.
