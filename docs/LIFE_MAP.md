# The Life Map

Branch `life-map`, worktree `/Users/philchan/Work/dayspring-lifemap`, alpha only.
Written 2026-09-07 so the build has one place to check itself against.

**Look at [`docs/prototypes/life-map.html`](prototypes/life-map.html) first.** It is
the design, committed rather than linked, and it is the reference for every visual
decision below. Open it in a browser — it renders standalone, light and dark.

---

## What it is

Four lists and a map: **People · Places · Domains · Matters**. The writer types into
any of them; the ones Dayspring found are marked amber.

On screen it says one thing about itself, and that is the whole explanation:

> Name what's in your journal. It's how Dayspring can show it back to you with
> some intelligence.

## Why it exists

Every surface downstream of this — silence about a subject, the ledger, images of
God over eras, the contradiction retrieval in
[`docs/product/DIRECTOR_MOVES.md`](product/DIRECTOR_MOVES.md) — needs to know that
Vera is a person and Frontier is a church. The engine can guess; only the writer
can confirm. **This is the surface where the guessing gets settled.**

Two things fall out of it that are worth more than the surface itself:

1. **A confirmed name leaves the expensive path.** "Vera" as a known name is a
   literal string match at save time — no model, no latency, no precision gate.
   Only *matters* still need interpretation.
2. **Every keep is a labelled positive and every drop a labelled negative**,
   generated as a byproduct of use. The Keeping has been stalled on having no
   number; this produces one without anybody sitting down to grade anything.

---

## The bones already exist

This is the part that decides whether the build is a week or a month. **Almost
nothing here is new.** The Concordance has been populating silently since June —
its own migration says *"DARK this phase: population runs silently; no feature
reads these tables."* The Life Map is the first reader.

| Life Map | Source | Already built |
|---|---|---|
| **People** | `concordance.kind = 'person'` | `listConcordance()` |
| **Places** | `concordance.kind = 'place'` | " |
| **Domains** | `concordance.kind IN ('org','project')` — unioned in `sectionFor()` | " |
| **Matters** | `concordance.kind = 'term'` | " |
| the keep gesture | `kept_subjects`, keyed `c:<name>` / `word:<typed>` | `keepSubject()` · `dropSubject()` · `listKeptSubjects()` |
| page counts | `concordance.occurrence_count` (distinct entries) | on the row |
| recency | `concordance.last_seen`, from `entries.created_at` | on the row |
| spellings | `concordance.surface_forms` | `displayLabel()` · `mergeItems()` |
| add / confirm / forget | | `editConcordanceItem()` · `confirmConcordanceItem()` · `forgetConcordanceItem()` |

`src/features/lifemap/lifeMap.ts` is pure composition of the above. It queries
nothing.

**A second source exists and is deliberately NOT wired yet:** Altar's
`spiritual_items.subject_tags` (`{label, kind}[]`, kinds `person | place | theme`
from `api/_lib/declared.ts`). It covers matters the Concordance misses, and it is
step 5 — after the Concordance half is proven, so a bad join has one place to
come from rather than two.

---

## The model

### Three provenances

| | Means | Written as |
|---|---|---|
| `mine` | the writer typed it, or corrected the engine into it | `source IN ('explicit','correction')`, or a `word:` kept row |
| `found` | the engine offered it, the writer kept it | `status = 'confirmed'`, or a `c:` kept row |
| `waiting` | the engine offered it, the writer hasn't answered | `status = 'suggested'` |

`dormant` and `superseded` rows never appear.

> **Rule: `explicit` is checked before `status`.** A row the writer created stays
> theirs even after the engine confirms it. Checking status first would relabel
> every typed subject as something the machine found — the one claim this surface
> must never make. There is a test named for it.

### The one visual rule

**Amber means Dayspring found it.** Three redundant channels, no new iconography:

1. the kind glyph turns amber (grey when the writer typed it),
2. an amber wash on the chip,
3. an amber underline under the word — the same sign the editor already uses when
   it recognises something.

Border style carries the second axis: **solid = settled · dashed = still waiting
on you.** So *found-and-kept* and *found-undecided* read as siblings, which they
are.

> **Never add a wand, a sparkle, or any "magic" glyph.** BRANDSCRIPT: *AI-powered*
> is an implementation detail *"and it frightens this audience."* The chip already
> carries a kind glyph; a second mark would both compete with it and say the word.

Amber rather than the terracotta accent on purpose: `--dayspring-amber` is already
the app's "this came from the journal" colour, and terracotta is interaction.

### Ordering

**Never by page count.** From `kept_subjects`' own migration: *"Riverside above Mom
at 31 pages to 14 would be the app ranking what a person carries, and a ranking of
the people in someone's life is a verdict rendered in a sort (Principle 1)."*

Everything orders by `first_seen` — chronology, a fact about the journal rather
than a judgement about the writer. Waiting items sort after answered ones. Typed
and found sort **together**: ranking the writer's own names above the ones the
journal surfaced is a hierarchy nobody asked for, and the amber already says which
is which.

> **The count is still SHOWN on every chip.** Showing a count is arithmetic;
> sorting by it is significance, and significance is a verdict (D-016). That
> distinction is the only reason a number is allowed on this surface.

---

## What is deliberately absent

Carried forward from `kept_subjects`' migration, which forbids these for the whole
keep mechanism, and they stay forbidden here:

- **colour, rename, merge, nesting, archive, parent, order-by-hand.** Keeping is
  ONE gesture with no decision attached. The moment it grows management
  affordances this is a to-do list about someone's prayer life.
- **A kind picker.** `kept_subjects.kind` records which box the writer typed into,
  and it is corrected by moving the chip — never by a dropdown.
- **Any completeness meter.** `CONCORDANCE.DRAWER_*` says it outright: *"NEVER add
  a completeness meter or 'we know N things about you' string here."* The footer
  shows counts and no ratio, no rate, no bar.
- **A disclaimer.** The prototype used to say *"Counts, not a score."* It was cut —
  if a surface needs a disclaimer, the disclaimer isn't the fix.

---

## Build order

| | | State |
|---|---|---|
| 1 | `lifeMap.ts` — pure read layer, four sections + provenance | **done**, 15 tests |
| 2 | `kept_subjects.kind` migration | **written**, needs applying |
| 3 | `useLifeMap.ts` — the two queries, calling into (1) | not started |
| 4 | The surface: sections, inline add, popovers, empty map | not started |
| 5 | The two canvases: Map and Over time | not started |
| 6 | Wire keep / drop / add to `keepSubject` · `dropSubject` · `editConcordanceItem` | not started |
| 7 | Altar's `subject_tags` as a second source for Matters | deferred, on purpose |

**Alpha-unflagged**, same call as Pages and handwriting scan: the alpha channel is
already the gate and a second gate inside it is redundant (see `flags.tsx`, D-017).

---

## Blocking, and not yet answered

1. **Are these two live in prod?** `20260611120000_concordance.sql` and
   `20260826120000_kept_subjects.sql`. Migration history is out of sync — these go
   through the SQL editor, never `db push`.
2. **Does `concordance` have rows for the owner?**
   `select kind, count(*) from concordance where owner = '…' group by kind;`
   Population runs as a `concordance` job in `api/_lib/processing.ts`. If it has
   never ticked, **step zero is running it**, and no amount of UI helps until then.
3. **Nav slot.** Pages ⌘1, Ascent ⌘2, Lamp ⌘3, Altar ⌘4 → ⌘5 and a rail button,
   unless it hangs off Settings while it is rough.

---

## How this fails, so it can be caught

- **It opens empty** because the Concordance was never populated for this owner.
  Check (2) above before building anything downstream of step 3.
- **Everything reads as `found`** because a provenance check ran in the wrong
  order. The test `calls a writer-created row mine even once the engine confirmed
  it` is the guard.
- **It grows a management UI** — rename, merge, colour, a kind dropdown — and
  becomes the tag manager `SURFACES.md` forbids. Every one of those is listed
  above as absent rather than unbuilt.
- **The counts start sorting things.** Grep for `occurrence_count` and `pages` in
  any comparator. There should never be one.

---

## Related

- [`docs/prototypes/life-map.html`](prototypes/life-map.html) — the design
- [`docs/product/DIRECTOR_MOVES.md`](product/DIRECTOR_MOVES.md) — what this feeds
- [`docs/THE_KEEPING.md`](THE_KEEPING.md) — the engine, and its four orders
- `supabase/migrations/20260826120000_kept_subjects.sql` — read its header; it is
  half the spec for this surface
