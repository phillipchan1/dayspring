---
description: Audit the live app against the stated product principles and surface promises
---

Audit Dayspring against what we said we believed. Scope: **$ARGUMENTS** (default: all surfaces)

Read first: `docs/product/PRINCIPLES.md`, `docs/product/SURFACES.md`,
`docs/product/GUARDRAILS.md`, `docs/product/PERSONAS.md`.

This is a **drift check**, not a code review. The question is never "is this code good"
— it's "does the app still do what we said it does, and has it drifted into something
we said we wouldn't build."

## For each surface in scope

Read the actual implementation, then answer:

**1. Promise check.** Does the live UI deliver the promise in `SURFACES.md`? Quote the
strings it actually shows.

**2. Persona check.** Does it still answer its persona question, or has it drifted into
feature-collection?

**3. Run its audit note.** `SURFACES.md` lists a specific failure mode per surface —
those are the ones that actually happen. Run that one deliberately.

**4. Principle violations.** Search the implementation for:
- **P1** — any score, rank, grade, streak-adjacent count, progress-toward-maturity,
  or **vertical encoding where height implies better/worse**
- **P2** — any copy that creates obligation or guilt; any notification that fires on
  *absence* of activity
- **P3** — anything added to the editor's render or input path; any AI in the composing
  surface; any upsell during a writing session
- **P4** — any displayed claim about the user that can't be traced to a row; any
  paraphrase presented as a quote
- **P5** — any surface that generates output below its data threshold instead of showing
  an honest EMPTY/INSUFFICIENT state
- **P6** — tradition-specific vocabulary in default copy; assumed translation; any
  doctrinal claim
- **P7** — anything that could leak across tenants; privacy copy that implies E2E

**5. Guardrail violations** for anything that generates language: H1 (divine voice),
H2 (verdict), H3 (invention / unquoted paraphrase / model-memory scripture), H4
(counsel, diagnosis, prescription).

## Report

Order findings **most severe first**. For each:
- Surface + `file:line`
- Which principle or guardrail
- The actual string or code
- Whether it's a **violation** (fix it) or **drift** (the doc is now wrong — update the doc)

That last distinction matters. Sometimes the app is right and the doc is stale; say so
rather than forcing the app to match an outdated claim. When the doc is what's wrong,
propose the edit and the `DECISIONS.md` row.

End with:
- **Coverage gaps** — persona questions with no surface (`SURFACES.md` has a table)
- **The one thing to fix first**, with why

Be genuinely critical. An audit that finds nothing is an audit that wasn't run — and
the failure mode for this product is accretion: reasonable additions that individually
pass and collectively turn a sacred surface into a dashboard.
