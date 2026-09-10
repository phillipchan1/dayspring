# The Keeping — where this stands

Written 2026-09-01, at the end of a long session, because the work had drifted far
enough from the intent that neither of us could see it whole. This is the handoff.

The engine's name is **The Keeping** (D-027). Internal key stays `noticing`.

> **Sentiment amendment, 2026-09-10:** D-029 supersedes this document's absolute
> prohibition on sentiment scores. The engine may estimate emotion in sourced
> language; it still may not perform spiritual discernment. The current direction
> and evaluation contract live in [`product/MOVEMENTS.md`](product/MOVEMENTS.md).
> Historical sections below are retained because they explain how the earlier
> boundary was reached.

**If you are new to this, read [The model](#the-model--what-the-engine-is-allowed-to-notice)
first.** It is the section that was missing for the whole first session, and
without it every argument about the engine turns into an argument about
vocabulary.

---

## What was asked for

Six things, in Phil's words:

1. **Combine markings with subjects.** "On their own they don't make any sense. But
   imagine we can have a subject PLUS a marking" — Esther + scripture.
2. **Don't make some markings user input.** Sentiment, growth, story "doesn't make
   sense and is manual labor."
3. **Scan every entry** to link subjects and scripture.
4. **A sandbox** — "a separate page where I can experiment, that only I can see."
5. **Clear triggers** — "every time a post is saved we do the engine scan."
6. **Name it.** heartIQ doesn't convey it.

Then, mid-session, two corrections that changed the architecture:

7. **"The join should be run through AI — there's an interpretative task involved,
   not just programmatic closeness."**
8. **"Break up every entry into different sections... there are reasonable
   groupings of thought. And THEN we can link."**

---

## Where it actually is

Branch `noticing-subject-markings`. **18 commits ahead of master, 69 behind.**
Nothing is on `master`. Nothing is on `stable`. Nothing is wired into the app.

| Asked for | State |
|---|---|
| 6. Name it | **Done.** The Keeping, logged as D-027. |
| 4. Sandbox | **Done and working.** `?__preview=noticing-journal` on the dev server. |
| 1. Subject + marking | **Mechanism works, quality unproven.** Movements, not distance. |
| 8. Segmentation | **Done.** Its own scan since v3; findings join by offset. |
| 2. Retire the manual kinds | **Decided, not built.** The palette still offers all six. |
| 3. Scan every entry | **Never run.** Sweeps of 4 and 30 pages only. |
| 5. Trigger on save | **Not started.** |

### Applied to production already

Three migrations, applied by Phil in the SQL editor. These are live:

- `20260829120000_marking_positions.sql` — `char_start`/`char_end` on `spiritual_items`
- `20260830120000_subjects_and_join.sql` — `subjects`, `subject_markings`
- `20260831120000_join_verdicts.sql` — judge verdicts

`subject_markings` holds ~10,884 pairings built by the **old proximity join**, which
the movement join is meant to replace. They are not read by any surface.

### Three real bug fixes — LANDED ON MASTER 2026-09-04 (`7011099`)

Taken as files rather than as commits, because those commits also carry the
bench, the subject join and a migration that belong to the spike. Master went
from 1315 to 1329 tests, typecheck clean. Not yet on `stable` — they ship on the
next merge.

- **`src/lib/spiritual.ts`** — the save-time reconcile deleted **99.2% of markings**
  (6,463 of 6,514) on any re-save, because its delete had no `source` filter.
- **`src/lib/scripture/parse.ts`** — a weather footer became `Esth.10.2`; a to-do list
  became `Dan.4` at confidence 1.0. Unit guard + line-break rule. Recall unchanged
  at 0.835, precision to 1.000.
- **`src/lib/pagedReads.test.ts`** — pins `.range()` without `.order()`, which was
  silently skipping rows in four different scripts and in `harvestPrayers`.

The marking-positions migration went with them, because the reconcile now writes
`char_start`/`char_end` and the columns are already live in prod.

The branch also carries **unrelated work** (`useSwipeToDismiss`, `MobileJournal`)
that drifted in and should be separated.

---

## What is actually known about quality

Honest version. Very little, and none of it at scale.

- The **proximity join** was measured: 27% precision on names, 78% on matters. It is
  the thing being replaced, and it is known bad.
- The **movement join** has been looked at on **three pages**. On 8/30 it fixed the
  case Phil named — `Matt 5:19` went to `dayspring` AND `service` under proximity,
  and goes to one movement under this.
- **Run-to-run variance is real and unmeasured.** The same page, same prompt, gave
  8 findings then 6; the same verse joined `SCE` on one run and nothing on the next.
- **Marking kinds were wrong, and half of it was the SHAPE, not the prompt.**
  `prayer` at 13% in a ~90%-prayer archive was caused by `subject` being required
  by the schema — v3 takes it to 43%. `sense` as the default bucket, 53% → 32%,
  same cause. What remains — `learned` firing for a writer who has never used it —
  is a prompt/kind question and is still open.
- **~20% of quotes came back as paraphrase** before segmentation; ~2% after, and
  2 of 30 on the first v3 sweep. Verbatim is holding.
- **The join is still nearly blind.** 5 of 7 markings on a typical page have no
  stored position. `backfill-positions` has not been run. This is step 1 and it
  is one command.

There is a review loop (`.keeping-review.jsonl`, verdict buttons in the bench) and
it has collected roughly **two** verdicts.

---

## The actual problem

The session tuned the engine by my judgement, one page at a time, and changed the
prompt four times. Twice that made things worse and the only reason we knew was that
Phil happened to look. **There is no number.** Without one this does not converge, and
every further change is a coin flip dressed up as a decision.

Everything else — the bench, the judge, the subjects table, the movement join — is
downstream of that missing number.

---

## Recommended path

### 0. Land the three bug fixes on master. ✅ DONE 2026-09-04

Commit `7011099` on `master`. Ship on the next stable merge.

### 1. Fill in the positions. ✅ DONE 2026-09-07

```bash
npx tsx scripts/backfill-positions.ts --owner phillipchan1@gmail.com
```

**5,684 of 6,422 markings (88.5%) now carry `char_start`/`char_end`**, verified in
production. The remainder are unlocatable by construction rather than by failure:
707 have no entry to be located in, 31 are under 12 characters.

The number that matters is the one that stayed at zero: **"text no longer in the
body: 0."** Across the whole archive, every harvested marking was found verbatim
in the page it came from — the harvest's verbatim guarantee holds perfectly, and
that is now measured rather than asserted.

The script has moved to `master`. It lived only on the spike branch, which is a
large part of why it went a month unrun while every doc called it step 1.

⚠️ **Run for Phil's owner only.** There are nine owners now and `_owner.ts`
requires the flag; the other archives are untouched.

### 2. Get a number.

> ⚠️ **THE v2 SAMPLE AND ITS VERDICTS ARE GONE.** They lived in
> `.keeping-sample.jsonl` / `.keeping-review.jsonl` inside a worktree under
> `/private/tmp`, which was pruned. Both are gitignored, so nothing was
> recoverable. Only ~2 verdicts were lost, but so was the "before" file the five
> numbers compare against — the first v3 run has no archived predecessor.
>
> The worktree now lives at `/Users/philchan/Work/dayspring-keeping`, which is
> not a temp directory. Do not put it back under `/private/tmp`.

The sample is rebuilt at `v3-two-pass`. Every Nth entry in date order from 2011
to now.

```bash
# rebuild the sample (only needed after a prompt change)
npx tsx --tsconfig tsconfig.app.json scripts/keeping-sample.ts --owner phillipchan1@gmail.com --n=30

# judge it — one pair per screen, j = right, f = wrong
open 'http://localhost:5191/?__preview=noticing-review'

# the number
npx tsx --tsconfig tsconfig.app.json scripts/keeping-score.ts
```

`READ_VERSION` scopes a verdict to the prompt that earned it, and a pair's id is a
hash of what the pair *is*, so re-running keeps verdicts on unchanged pairs and
treats a changed pair as new and unjudged.

Gate: **if precision is under ~70%, do not wire it into the app.** Fix the read, or
stop. The product principle is *grounded, or silent* — a join that is wrong a third
of the time is not silent.

**What the shape change bought, before any verdict** — v2's 30-page sweep
against v3's first 4-page sweep:

| by marking kind | v2 (214 pairs / 30 pages) | v3 (28 pairs / 4 pages) |
|---|---|---|
| sense | 114 (53%) | 9 (32%) |
| prayer | **27 (13%)** | **12 (43%)** |
| desire | 37 (17%) | 3 (11%) |
| learned | 23 (11%) | 4 (14%) |

`prayer` at 13% in a ~90%-prayer archive was the loudest defect in the engine,
and it was never a prompt problem: `subject` was REQUIRED by the schema and a
name for God is refused, so a prayer about the writer's own heart had nowhere to
go. **64% of v3's pairs carry no subject at all.** Every one of those was
structurally unreachable before.

Pairs per page is 7.0 against v2's 7.1, so nothing was starved by asking
per-movement — which was the real risk, since that is the shape v1 got wrong.
On the 8/30 page the engine was tuned against, markings went from 6–8 to 20.

Cost is 4.5 model calls per page instead of 1.

⚠️ **Both v3 columns are 4 pages.** Suggestive, not a number. The number still
requires verdicts.

---

## The model — what the engine is allowed to notice

Written 2026-09-04, because the engine had no type system and every argument
about it turned into an argument about vocabulary. Phil named the confusion
exactly: *"Scripture is like a marking, but growth and sentiment are not
markings. I don't know what to call that."*

He is right. They are not the same category, and the codebase already half-knew
it in three separate places. **Four orders. Each has one rule, and the rule is
what decides where a new idea goes.**

### Order 0 — the **movement**: the unit

One stretch of a page holding one turn of attention. Structurally two integers
and two lists — **no label, no topic, no id**. What a movement is "about" is
emergent from what is in it, and it must stay that way: the moment a movement
has a name, something named it.

> **Rule: the read sees one page. Anything needing a second page is not the
> read's job.** Already in the code — `SUBJECT_KINDS` says a matter *"is earned
> by RECURRING — three touches across three ISO weeks — and one page cannot know
> that, so one page must not mint one."*

### Order 1 — **markings**: what the writer *did* here

A property of a movement. `READ_KINDS`' own comment already calls it *"What the
writer did."* Kinds: `prayer · sense · desire · learned`, plus `scripture`
captured deterministically by `parseReferences`.

> **Rule: a marking is a verbatim span of this page.** If you cannot highlight
> it, it is not one.

The split that matters, and that D-027 deliberately overrode on one side:

| | Observable in the text | Interior |
|---|---|---|
| | **prayer** (addressed to God), **scripture** (a citation) | sense · desire · learned · story · gift · absence |
| Anyone can verify it | yes — it is a speech act on the page | no — only the writer knows |

`markKinds.ts` says of `desire`: *"Inferred, the most dangerous thing in the
product: a machine deciding what someone wants is a characterisation of their
heart."* D-027 part 3 overrides that knowingly, and the override is survivable
only because `verbatimOnly` means the engine points at the sentence rather than
composing one.

**Worth keeping in view: that guarantee protects against FABRICATION, not
MISCLASSIFICATION.** D-027's falsifier is "a `desire` row that is not a
character-exact quote" — but the failure actually present was `sense` at 53%,
which is the wrong label on a real sentence. The falsifier as written cannot
catch it. `keeping-score.ts`'s `by marking kind:` breakdown is the instrument
that can.

### Order 2 — **subjects**: what the movement is *about*

Named things that persist across pages and can be clicked. Many-to-many with
movements. `subjects.origin` already models the vocabulary properly: `name`
(matchable in prose) · `matter` (*"reachable only through the lines it was
derived from, because nobody ever writes 'spiritual dryness' on a page"*) ·
`both` (81 labels — Esther is both) · `word` (typed).

> **Rule: a subject outlives the page.** That is what separates it from a topic.

**Scripture is a subject, not a marking.** Rom 8:28 persists, recurs, has its own
surface (Lamp), and you click it. It behaves exactly like "Mom" and nothing like
"prayer". The code already treats it this way — `READ_KINDS` excludes it, and
`keeping-sample.ts` injects it from `scripture_refs` afterwards. Filing it as a
marking is what made the taxonomy feel incoherent.

### Order 3 — **patterns**: what only exists across movements

Recurrence, bursts, gaps, then→now, refrain.

> **Rule: if it requires comparing two movements, it is not a marking and the
> read must never emit it.**

**Growth lives here. So does every legal form of sentiment.**

---

## What this settles, with the receipts

| Question | Answer | Already settled at |
|---|---|---|
| Is scripture a marking? | No — a **subject** | Lamp; `scripture_refs`; `READ_KINDS` excludes it |
| Is growth a marking? | No — an order-3 **pattern**, and it is already built | `markKinds.ts:16` — *"rendered 'Learned' and never 'Growth' … a rising glyph beside someone's spiritual life is a grade"*; `readings.ts` ships `thenAndNow`, with *"An arrow is a vertical axis laid on its side"* |
| Are we tracking sentiment? | No, and never as a value — **but the legal form is already shipped** | `readings.ts:290` `wordsUsed()` → `ReadingView.tsx:301` "The words you used": *"The sentiment question, answered the only legal way there is"* |
| Would a sentiment *marking* rescue it? | No — settled explicitly | `readings.ts:290`: *"that is `Sense` with a mood attached, and any arrangement of it over time rebuilds the axis"* |
| Is "story" a marking? | No — an order-3 **episode** | RECALL.md: *"a story in a journal isn't a theme, it's an episode … a burst of entries on one subject, bounded by silence. That is arithmetic."* Already built as `bursts` |

**The short answer on sentiment: it exists already, twice, and neither is a
number** — the writer's declared `/sense`, and their own vocabulary in "The words
you used". Both are on Pages today. A third form is not missing; it is forbidden
four times over (Principle 1's "sentiment badges", H2, GLOSSARY's "never mood
tracking — wrong tradition", and RECALL.md's *"Tone scoring is an H2 violation
and always will be"*).

---

## The mechanism — how to iterate on the engine

This is the loop. It exists because the alternative was tried for a full session:
the prompt was changed four times by judgement, twice it got worse, and both times
the only reason anyone found out is that Phil happened to look at the right page.

**One change at a time. Re-sweep. Read five numbers. Judge only what is new.**

All of it runs in the worktree: `cd /Users/philchan/Work/dayspring-keeping`.

```bash
# 1. change ONE thing (a prompt, a code rule, the model) and bump READ_VERSION
#    in api/_lib/readEntry.ts — its history block says what each version meant

# 2. re-sweep the same pages. The previous run is archived automatically.
npx tsx --tsconfig tsconfig.app.json scripts/keeping-sample.ts --owner phillipchan1@gmail.com --n=30

# 3. read what the change did
npx tsx --tsconfig tsconfig.app.json scripts/keeping-score.ts

# 4. judge ONLY the new pairs — the queue defaults to unjudged.
#    The dev server is the `keeping-sandbox` entry in .claude/launch.json.
open 'http://localhost:5191/?__preview=noticing-review'
```

**Start small.** `--n=4` is about 30 pairs and roughly two minutes of judging —
enough to see whether a change did something stupid before spending an hour on
30 pages. `--n=30` is the real sample.

Step 3 prints, in verdicts **already given**:

| | |
|---|---|
| **KEPT** | judged right, survived — the change did no harm |
| **LOST** | judged right, now gone — **a regression, listed by name** |
| **FIXED** | judged wrong, now gone — what the change bought |
| **STILL** | judged wrong, survived — what it did not touch |
| **NEW** | never judged — the only thing to sit down with |

…and a net figure. `Net: -1. The change cost more than it bought.` is the sentence
that would have caught both of this session's regressions on the day they happened.

### Why the verdicts survive a prompt change

A pair's id is a hash of **what the pair is** — entry, subject, kind, quote — and
deliberately *not* of the read version. "Esther, prayer, this exact sentence" is the
same claim whoever made it and whenever; if it was right last week it is right now.

The first version hashed the version in, which quietly made iteration impossible:
bump the prompt and all 214 verdicts stop matching, so every change costs a full
re-judge and nobody makes the second change. The version still scopes the *score*,
so two prompts are never averaged together.

`scripts/rekey-sample.ts` recomputes ids in place if that derivation ever changes
again — no re-reading, no model calls.

### Rules for the loop

- **One change per version.** Two changes and the five numbers cannot tell you
  which one did it.
- **Never edit the sample to make a number better.** If the sample is wrong,
  say why in the commit and rebuild it deliberately.
- **`ungrounded` and `uncovered` are guard rails, not goals.** They should stay near
  zero; if a change moves them, that change did something you did not intend.
- **The gate is 70% precision.** Below it, nothing gets wired into the app.

---

### 3. Only then: trigger and persist.

Save relinks against known subjects (deterministic, no model, no editor latency);
a `keeping` job in `processing_jobs` does the model work in the background. Palette
drops to scripture + prayer. This is the plan doc's Milestone 3 and it is unchanged.

### 4. Surfaces last.

Lamp filters by subject; Pages reads the stored join. This is the unlock — *"what
scripture did I reach for when I wrote about Esther"* — and it should not be built
until step 2 says the answer would be right.

---

## What I would not do

- **Don't rebase this branch onto master.** 69 commits behind, with unrelated work
  mixed in. Cherry-pick the three fixes; leave the rest as a spike.
- **Don't tune the prompt again before step 2.** Four changes, two regressions, no
  measurement. More of that is not progress.
- **Don't wire anything into the writing surface.** D-026 took intelligence off the
  editor deliberately. The Keeping reads; it does not appear while you write.

---

## Starting a new chat

Point it at this file first. The short version:

> Read `docs/THE_KEEPING.md` — the model section and the mechanism section. The
> engine is on branch `noticing-subject-markings`, in the worktree at
> `/Users/philchan/Work/dayspring-keeping`, at `v3-two-pass`. Positions are not
> backfilled yet and the sample has no verdicts. I want to run the iteration
> loop on it.

Files that matter most, in order: `api/_lib/readEntry.ts` (both prompts, both
schemas, and the grounding rules), `api/_lib/readEntryRun.ts` (the two calls),
`api/_lib/movementJoin.ts` (the join), `src/features/bench/ReviewPage.tsx` (the
judge) and `JournalPage.tsx` (one page at a time), `scripts/keeping-sample.ts`
(the sweep), `docs/product/PRINCIPLES.md` (what settles arguments).

`scripts/read-sweep.ts` is referenced by older notes and **no longer exists** —
it was deleted in `4ae18bb` after it rotted against the segmentation change.

The plan doc from the original session is at
`~/.claude/plans/okay-i-figured-where-snug-sloth.md` — accurate on design, optimistic
on sequencing, and written before the proximity→interpretation→segmentation turn.
