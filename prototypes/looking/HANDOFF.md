# Handoff — `looking`

**For an agent picking this up cold.** This prototype is the reference implementation for
[`D-025`](../../docs/product/DECISIONS.md) (Pages replaces Entries and becomes a Return
surface). The build plan is [`docs/PAGES_REPLACES_ENTRIES.md`](../../docs/PAGES_REPLACES_ENTRIES.md).

```bash
cd prototypes/looking && npm install && npm run dev
```

`#looking` the surface · `#fit` the shell and rail · `#leaves` the page-continuation
argument · `#notes` the facilitator page, which carries the reasoning in prose.

> **This is a fixture, not an implementation.** 47 fictional entries, no persistence, no
> model, no network. See **Where it cheats** before trusting anything measured here.

---

## Read in this order

| # | File | The argument it carries |
|---|---|---|
| 1 | [`README.md`](README.md) | The whole design, in prose. Start here. |
| 2 | [`src/zoom.ts`](src/zoom.ts) | **Why the entries list is a distance, not a surface.** D-018's own kill note, finally acted on. |
| 3 | [`src/subjects.ts`](src/subjects.ts) | Detection finds people and cannot find matters — and the two rules that failed before this one worked. |
| 4 | [`src/FilterBar.tsx`](src/FilterBar.tsx) | Why `look for` is a dropdown, why asking is a row rather than a mode, why serif-is-her/sans-is-us. |
| 5 | [`src/Wall.tsx`](src/Wall.tsx) | The card: the right-hand margin, and two signals in two channels. |
| 6 | [`src/scenes/Results.tsx`](src/scenes/Results.tsx) | The four readings. **`WordsUsed` holds the entire sentiment argument.** |
| 7 | [`src/page.ts`](src/page.ts) | Why a card never scrolls and a long page continues onto the next leaf. |
| 8 | [`src/Shell.tsx`](src/Shell.tsx) · [`src/scenes/FitScene.tsx`](src/scenes/FitScene.tsx) | Where it sits in the app, and why Return rather than Write. |

**The reasoning lives in the file headers, not in this document.** Every non-obvious call
is argued at the top of the file that makes it, usually including the version that failed
first. Do not treat those comments as decoration — several of them are the only written
record of a finding.

---

## Findings worth carrying into the real build

**1. Pronouns break paragraph-scoped matching.**
The obvious rule — match the subject against the paragraph, not the entry — returns
**nothing at all** for Mom + Prayer, the most useful query on the surface. She does not
write "Mom" in the sentence she is praying; she writes *"I keep bringing her."* Every
prayer she has prayed about her mother says *her*. Paragraph scoping is not strict, it is
**blind, and blind precisely on the most intimate lines**, because that is where people
stop using names. No vocabulary expansion fixes a pronoun.
→ `src/scenes/SubjectPage.tsx`, the `why` memo.

**2. Frequency does not find subjects. Capitalisation does.**
Words appearing in 4+ entries returns *down, also, used, already, going, without*.
Restricting to words inside a marking is no better — a marking quote is a whole sentence
and drags the same ordinary English along. **Mid-sentence capitalisation** returns exactly
*David · Mom · Leo · God · Mira · Grandma*, right about all six, and is a thing she typed
on purpose rather than a guess about meaning.
It will **never** return "marriage" — which is the finding, not a flaw: detection finds
people for free and cannot find matters at all. Hence the hybrid.
→ `src/subjects.ts`, both failed rules documented above the working one.

**3. Detection decides *which* words; code decides the count.**
Capitalisation fires on "Mom" in 7 entries — the other 10 open a sentence with it. The
number beside the word must be the pages the word is *on* (17), or the pill says 7 and the
page it opens says 17.

**4. Sentiment has exactly one legal form.**
A mood curve is forbidden three times over (H2, Principle 1, D-016) — and a sentiment
*mark* does not rescue it, because it is `Sense` with a mood attached and any arrangement
over time rebuilds the axis. What is sanctioned is her own vocabulary. The floor —
*"appears in more than one entry"* — is the **only legal way to shorten it**, because that
is arithmetic where "the most significant thirty" is selection, and selection is
significance, and significance is a verdict.
→ `src/scenes/Results.tsx`, `WordsUsed`.

**5. Rows hit 25px, 30 a screen at 900px.** Measured in the DOM, not estimated. The panel
gave ~25. This is the number D-022 reversed D-018 over.

**6. Nothing scrolls except the surface.** One `overflow-y: auto` outside the deliberate
exhibit on `#leaves`. A card is a page's *face*, never a viewport. If a second scroller
appears, the original complaint has come back.

---

## Rules that are not preferences

Breaking any of these breaks a written decision, not a taste call.

- Nothing on a page except the writer's words, their date, and their markings.
- **No vertical axis anywhere.** The band's cells are all the same size; only warmth varies.
- Order by first appearance or by when kept — **never by count**. A ranking of what someone
  carries is a verdict rendered as a sort.
- A line view shows **every** match. A top-eight means something selected them (D-016).
- Prayers are never a ratio.
- Subjects **union**; markings **intersect**.
- Keeping is one gesture with no decision attached. Dropping is safe — that is what makes
  keeping cheap.
- The editor takes no chrome and no latency from any of this (Principle 3).
- Banned: *track, review, insights, score, progress, goal, dashboard, analytics, journey,
  inbox, workflow.*

---

## Where it cheats

- **Line counts are estimated from character counts** (`src/page.ts`). The real version must
  measure, or a page occasionally breaks one line early.
- **`burstsFor` is prototype-only** — it lives in `src/lib.ts` and exists nowhere in `src/`
  or `api/`.
- **Detection is a regex.** The Concordance (`api/concordance/`) is the real engine and may
  already do this better. **Reconcile before writing it twice.**
- **Nothing persists.** Kept subjects are React state; the real thing needs a
  `kept_subjects` table mirroring `marks`.
- **47 entries.** Density is faked by silhouettes on `#wall` precisely because a layout
  argument settled on a sparse wall is not settled.
- **Desktop only.** Deleting Entries also changes `MobileJournal`'s bottom bar, which is
  not modelled here at all.
- **No model and no network.** `src/semantics.ts` is a hand-picked fixture, deliberately
  built to lose in three places. **Ask is not in the D-025 build** — that file is kept for
  the finding it records: D-020's *"a vector hit has no word to light"*, answered by
  lighting the nearest **line** and putting her own sentence on the chip.

---

## Deliberately unresolved

Both are named in D-025 and neither is an agent's call:

1. **The surface's name.** "Pages" describes one state of it now; Ascent, Lamp and Altar
   are each named for what they are.
2. **Whether `the words you used` may narrow to a person.** RECALL takes it off person
   pages — on a spouse it reads as a portrait of the marriage. The counter is that the
   words on her pages about her mother are about *her*, and the failure is framing rather
   than fact.

---

## Lineage

`docs/product/RECALL.md` (the four acts, tenure, the contemplative mechanisms)
→ [`prototypes/recall/`](../recall/) → [`prototypes/recollection/`](../recollection/)
→ **this** → [`D-025`](../../docs/product/DECISIONS.md)
→ [`docs/PAGES_REPLACES_ENTRIES.md`](../../docs/PAGES_REPLACES_ENTRIES.md)

Same fictional woman throughout — Anna, 47 entries, 2023–2026 — so all three prototypes
can be walked without a discontinuity.

**Two markings were cut on 2026-08-26**: Gift and Absence, because a writer read the labels
and did not know what they meant. The six that remain are scripture · prayer · sense ·
story · desire · learned. The casualty is `recollection`'s `consolation` arrangement, which
cannot be rebuilt without them; `src/lib.ts` keeps a note where it stood.
