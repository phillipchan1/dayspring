# Pages replaces Entries — build plan

> **Decision:** [`D-025`](product/DECISIONS.md) · **Reference implementation:**
> [`prototypes/looking/`](../prototypes/looking/) (`npm run dev` → `#looking` for the
> surface, `#fit` for the shell, `#notes` for the arguments)
>
> The prototype is the spec for *behaviour and look*. This document is the spec for
> *where it goes in the real app* and *what it costs*. Where they disagree, the prototype
> is a fixture and this is the archive — see **Where the prototype cheats**.

---

## Phase 0 — measure before building

**Do not start Phase 1 until this is done.** D-025's second falsifier is the subject model,
and six clean names on a 47-entry fixture proves nothing about 2,831 real pages.

`scripts/emphasis-audit.ts` is the precedent: it measured the real archive and its findings
drove three sub-decisions inside D-016. Write the equivalent —

1. Run name detection over the real corpus. Report: how many names clear the floor, what
   the tail looks like, and how many are junk.
2. **Compare against the Concordance.** `api/concordance/` and `features/concordance/` are
   already extracting per-user vocabulary — names and spellings, never moods. The
   prototype's mid-sentence-capitalisation rule is a stand-in for something that may
   already exist and be better. **Reconcile before writing it twice.**
3. Decide the floor from the data, not from the fixture.

**Kill condition for the whole surface:** if detection returns hundreds of names, "keep the
ones you carry" is a chore rather than a gesture, and the chapter is a feature nobody
reaches. Say so and stop, rather than tuning a stop list until the demo looks good.

---

## Phase 1 — the subject model

**New table `kept_subjects`**, mirroring `marks` (RECALL Act one, mechanism 1.3 names this
shape). Per-owner, holding the label, its terms, and `kept_at`.

- **Order by `kept_at`, never by count.** Riverside above Mom at 31 pages to 14 would be
  the app ranking what someone carries.
- **Keeping is one gesture with no decision attached** — no colour, no rename, no merge,
  no nesting, no archive. The moment it grows management affordances it is the tag manager
  `SURFACES.md` forbids.
- **Dropping is safe and must stay safe.** The journal still notices the name, nothing the
  writer wrote changes, and it is one click from kept again. That is what makes keeping
  cheap enough to do.

> Migrations go through the **Supabase SQL editor**, not `db push` — the CLI migration
> history is out of sync (see the Altar remembrance work).

Reuse `features/pages/subjects.ts` (`subjectMatcher`, `matchSubjects`, `buildSubjectIndex`)
for matching. **Code decides what matches, always** (D-019).

### The pronoun finding — carry this into the real matcher

The prototype first matched a subject against the **paragraph**, reasoning that a mark in
paragraph six of an entry mentioning Mom in paragraph one is not a mark about Mom. Sound —
and on the fixture it returns **nothing at all** for Mom + Prayer, the most obviously useful
query on the surface.

The reason is pronouns. She does not write "Mom" in the sentence she is praying; she writes
*"I keep bringing her and I keep not knowing what to ask for."* **Every prayer she has ever
prayed about her mother says *her*.** A paragraph-scoped literal match is not strict, it is
blind — and blind precisely on the most intimate lines, because that is where people stop
using names.

**So the entry is the unit** where a marking narrows a subject. It is also the more honest
one: starting a new page is a gesture the writer made, and paragraph boundaries are ours.
No vocabulary expansion fixes a pronoun.

---

## Phase 2 — `look for`

Replaces the current lighting bar (`features/pages/FilterBar.tsx`, `FacetMenu.tsx`).

- Collapsed by default. The default experience is reading the pages raw.
- Three groups: **subject · marking · reading**. What is on shows beside the toggle;
  what is not is behind it.
- **Markings** map to the existing facet machinery — `features/pages/facets.ts` already
  computes them in one pass with no model involved. Cut to the six declared kinds.
- **Ask is not in this build.** `api/ask.ts` and `api/pages/interpret.ts` stay where they
  are; the surface does not offer questions. D-020's finding is recorded in the
  prototype's `semantics.ts` for whenever it returns: *a vector hit has no word to light*,
  answered by lighting the nearest **line** and putting the writer's own sentence on the
  chip.

**Two rules the prototype learned the hard way, both load-bearing:**

- **Serif is her. Sans is us.** Subjects in the journal's own face; every label, gloss and
  count in sans, one size, one weight, differing only in opacity. **No mono in the sheet** —
  mono is for dates, and a date is a fact about a page rather than part of a control.
- **One shape.** Every option is the same pill. What varies is a hairline (kept) against a
  dashed line (noticed), and colour once something is on.

---

## Phase 3 — the zoom, and the deletion

**This is the phase that carries the risk.** Do it in this order.

1. **Add the rows band first**, while the panel still exists. Rows must hit **~25px, 30 a
   screen at 900px** — measured, not eyeballed. `useVirtualRange` already windows the wall;
   rows needs it too, at 3,500 entries.
2. **Prove re-entry before deleting anything.** The newest page marked `today` with its
   date lit, and every row opening to write on a double-click — the same gesture the cards
   take. **Time it: today's draft from a cold start, under two seconds.** This is D-025's
   kill condition and it is the only reason to abandon.
3. **Then** delete the panel, `EntryList`, and the List/Pages mode switch. Move Pages to
   Return, renumber the shortcuts, move the open-book glyph from `IconEntries` to Pages in
   `features/journal/navIcons.tsx`.
4. **Reading zoom continues a long page onto the next leaf** instead of scrolling inside
   it — `.pg-leaf { block-size: 100%; overflow-y: auto }` in `Pages.css` is the bug. The
   date prints on the first leaf only, and that absence is the whole continuation cue.
   **This needs measured line counts, not character estimates** — see below.

Files: `features/journal/JournalScreen.tsx` (`setPagesMode`, `pagesActive`,
`canvasAlternateActive`), `features/journal/Rail.tsx`, `features/journal/MobileJournal.tsx`,
`features/pages/PageWall.tsx`, `features/pages/zoom.ts`, `features/pages/Pages.css`.

---

## Phase 4 — the chapter and the readings

**The chapter** — masthead (provenance, counts, span), the band, her markings as rails, and
the pages. Everything on it is either her words or a number counted in code.

- **The band has no vertical axis.** A bar chart of mentions-per-month has a Y axis, and a
  falling one reads as *you care less about your mother now* — a verdict on a relationship
  rendered by a machine. Every cell the same size; only warmth changes. Ramp is the Lamp's
  `--scripture-ember` → `--scripture-gold`.
- **Several subjects give one band each**, against the same months. Where they overlap is
  visible without anybody computing an overlap.
- **Person pages stay smaller, deliberately.** No vocabulary portrait, no co-occurrence
  network (GUARDRAILS: quote what they wrote, never characterise or profile).

**The four readings:**

| | |
|---|---|
| **in order** | every matching page, oldest first. No top eight, ever (D-016). |
| **then & now** | two spans of pages, **no arrow between them**. Page count for each span always on screen — an uneven comparison reads as a verdict on the thinner side. |
| **close together** | stretches bounded by silence. Needs a real `burstsFor` — prototype-only today. Likely a `processing_jobs` kind. **Every heading is a count**; a title would be a claim about what it was. |
| **the words you used** | see below. |

### The words you used — the sentiment question, answered the only legal way

A mood curve is forbidden three times over: **H2** (never infer interior state),
**Principle 1** (no vertical axis), **D-016** (the writer supplies the signal). A sentiment
*mark* does not rescue it either — it is `Sense` with a mood attached, and any arrangement
of it over time rebuilds the axis.

What **is** sanctioned is her own vocabulary; GUARDRAILS' approved example is literally
*"'Angry' appears in 7 entries this month."*

Non-negotiable rules: **no number beside any word**; ordered by first appearance, never
frequency; never sorted into good and bad; page count for each span always on screen; and
**a floor stated on screen** — a word must appear in more than one entry in its span.
The floor is the only legal way to shorten it, because *"appears in at least two entries"*
is arithmetic where *"the most significant thirty"* is selection, and selection is
significance, and significance is a verdict.

**Archive-scoped by default.** Whether it may narrow to a person is D-025's open question.

---

## Where the prototype cheats

Name these rather than discovering them.

- **Line counts are estimated from characters** in `page.ts`. The app version must measure,
  or a page will occasionally break one line early.
- **`burstsFor` is prototype-only lib code.** Not implemented anywhere in `src/` or `api/`.
- **Name detection is a capitalisation regex.** The Concordance is the real engine —
  reconcile in Phase 0.
- **Nothing persists.** Kept subjects live in React state.
- **Density is faked at scale.** The corpus is 47 entries; `#wall`'s silhouettes exist
  precisely because a layout argument settled on a sparse wall is not settled.
- **Desktop only.** No mobile story at all, and deleting Entries changes the mobile bottom
  bar.

---

## Rules that survive every phase

- Nothing on a page except the writer's words, their date, and their markings.
- No vertical axis anywhere. Prayers are never a ratio.
- Order by first appearance or by when kept — **never by count**.
- A line view shows **every** matching line (D-016).
- Nothing accrues: no horizon, nothing unread, nothing to be behind on.
- The editor takes no chrome and no latency from any of this, because none of it lives
  there (Principle 3).
- Banned vocabulary: *track, review, insights, score, progress, goal, dashboard, analytics,
  journey, inbox, workflow.*
