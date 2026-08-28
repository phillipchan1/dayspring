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

## D-026 — The editor's margin is deleted; the `+` moves left; heartIQ leaves the writing surface
**2026-08-28** · **Status:** Decided · alpha only · **supersedes D-016's placement**

**Decision, in three parts.**

**1. The right margin is gone from the editor.** The hairline down the writing column,
the hand beside each marking, the `+` that sat on the rule, the panel it opened, ⌥⌘M, and
`settings.showMargin` — all removed. Markings are untouched: they still render inline in
the text, and they are still there on every surface you read back on.

**2. heartIQ is not on the writing surface.** It ran at a pause, verbatim-checked at both
ends, nothing counted until kept — and it was still wrong there. *"It doesn't make sense
to show the user the intelligence as they're writing it. It only makes sense upon reading.
It's a distracting thing."* The engine (`api/spiritual/notice.ts`, `lib/noticing.ts`) is
intact and waiting on a reading surface; the Settings switch is parked until there is
something for it to switch.

**3. The `+` moves to the left gutter and opens the whole palette.** Notion's gesture,
deliberately: appears on hover and on the caret's line, opens on click, never on hover.
It opens the same menu `/` opens — so the editor now has one insert door that a mouse can
find, which is the gap `/` alone left (D-016 gave marking its own affordance on the right;
this merges the two).

**Why this is a better Principle 3 than the one D-016 satisfied.** The old test was *does
this add latency* — and the margin passed it honestly: pseudo-elements, decorations that
track lines for free, no per-frame measurement. The test it failed is *does this belong in
front of someone who is composing*. Being shown what a machine made of your half-finished
sentence is an interruption whether or not it costs a millisecond, and three jobs on one
hairline (show, add, open) is chrome whether or not it is quiet chrome.

**The sub-decision worth arguing about: one row, two acts.** Picking Prayer / Sense /
Story / Desire / Learned **marks the line** when it already has words, and **opens the
insert popover** when it doesn't. Those are genuinely different acts, but they have one
name in a writer's head, and listing both would turn a menu of six kinds into a menu of
twelve. The line decides, identically from `/pray` and from the `+` — two doors that
disagree about what a word means are worse than one door. Scripture is excluded (its words
are not the writer's own); ritual / image / emoji are not kinds.

**Rituals get the top bar, alone.** Scripture and prayer are reached mid-sentence, about
the line you are on — they belong on the `+` beside that line. A ritual is a shape for the
whole page, chosen before there is a page. A row that briefly offered `/scripture`,
`/pray`, `/ritual` and a palette door up there was putting three different scopes in one
place; only the one that is about the whole entry stayed.

**Fixed in passing:** the palette still offered `/gift` and `/absence`, retired in
`markKinds.ts` ("nothing retired is OFFERED"). Harmless while the palette was a back door;
not harmless once the `+` makes it the front one — a kept marking of a retired kind is a
marking `look for` can never find again. `PROPOSABLE` carried the same bug.

**What would change our mind:**
· *On the margin* — people stop marking entirely, which would mean the right-hand `+` was
  carrying the act rather than merely housing it, and the answer is a better affordance on
  the left rather than the rule coming back.
· *On the smart row* — someone picks Prayer meaning "start one" on a line that happens to
  have a stray word on it, and is surprised. One report settles it; the fix is a modifier
  or a second row, not a second menu.
· *On heartIQ* — the reading surface lands and nobody keeps anything, which would mean the
  problem was never placement.
**Cost accepted:** a subsystem built carefully and deleted four weeks later (~900 lines:
`markMargin.ts`, `MarkMargin`, `MarkPicker`, `marginNotes`, the `?__preview=margin`
harness). A Settings switch that currently switches nothing. And, until the reading
surface exists, a product with an intelligence engine nobody can see.

## D-025 — Pages replaces Entries and becomes a Return surface; the list is a distance
**2026-08-26** · **Status:** Decided · **supersedes D-022, and re-runs D-018 with the fix D-018 itself asked for**

**Decision:** the entries panel is deleted a second time. **Pages owns the canvas, moves
under Return, and absorbs the list as the far end of its zoom.** The rail becomes one item
under Write and four under Return — Pages, Ascent, Lamp, Altar.

The surface gains, all prototyped in [`prototypes/looking/`](../../prototypes/looking/):

- **`look for`** — one collapsed control opening on three groups: *subject*, *marking*,
  *reading*. Closed by default, because the default experience is reading the pages raw.
  What is on shows beside the toggle; what is not is behind it.
- **Subjects, offered and kept.** The journal notices names (RECALL Act one, mechanism 1.2)
  and she keeps the ones she carries in one gesture, or types a matter and keeps that.
  Kept subjects order by *when they were kept*, never by count. Dropping is safe: the
  journal still notices the name and nothing she wrote changes. Needs a `kept_subjects`
  table mirroring `marks`.
- **Subjects union; markings intersect.** "Mom and David" names the people you want to read
  about; "Mom and prayers" narrows to the prayers. That is what the words mean out loud,
  and intersecting two people on a real archive returns almost nothing.
- **The chapter** — a subject's own page: provenance, counts, a band per subject, her
  markings as rails, and the pages themselves.
- **Four readings** — *in order · then & now · close together · the words you used.*
- **The zoom runs from a list to a single page.** Rows → cards → leaves, one continuous
  move.

**Why D-022 comes off.** D-022 kept the panel open across the List/Pages switch so they
would read as siblings. They are not siblings — finding a thing you already have in mind
and coming across a thing you don't are different acts, and a 17rem column of titles beside
a wall of pages is two indexes of the same archive on screen at once, which is the clutter
D-017 warned about arriving by the other door.

**Why the deletion works this time.** D-018 fired within three days on one narrow thing:
*"browsing for a half-remembered entry becomes reliably slower."* Its own kill note said
what to do about it and nobody did it — *"an argument for a list-tight end of the zoom
rather than for a second surface."* That is now built and measured: **25px rows, 30 a
screen at 900px**, against the panel's ~25. Two other things also changed. ⌘K Find was
never the list's job and always beat it at "I know exactly what I want" — the list only
ever won the *half*-remembered case. And `look for` did not exist: "it was about Mom" is
usually more retrievable than "it was March 2019."

**Why Return and not Write.** Once it owns the canvas it behaves like a Return surface, so
it should be labelled as one — and SURFACES already made the argument: the other three
*"all interpret… None of them hands back the archive. This does."* Being the Return surface
that does **not** interpret is its distinguishing virtue. It obeys the Return rule to the
letter: you go there to see, never to do. Write then holds one item, which is the sharper
statement of the thesis rather than a weaker one — writing is one act, and everything else
in this product is returning.

**A knowing violation retires with it.** D-017 accepted the weather grid as a deliberate
Principle 2 override because with nothing lit it displays writing activity. The band is not
that: scoped to a subject it describes that subject's rhythm, not the writer's diligence.
Silence in Mom's band is a season of a relationship; silence in an activity grid is a
report card.

**What would change our mind:** **you cannot get back to today's draft from a cold start in
under two seconds.** The panel was how you returned to what you were writing; deleting it
makes the wall the only way back, which is a Principle 3 problem wearing a navigation
costume. The mitigations — the newest page marked `today`, every row opening to write on a
double-click — are mitigations, not proof, and this is what will kill it a second time if
anything does. **Density is not the risk any more; re-entry is.**

The second falsifier is the subject model: if detection on a real 2,831-page archive
returns hundreds of names, "keep the ones you carry" is a chore rather than a gesture, and
the chapter is a feature nobody reaches — the same failure as slash commands going
unnoticed for three weeks (K1). **Measure this before building, the way
`scripts/emphasis-audit.ts` measured emphasis before D-016.**

**Cost accepted:** D-018's ~2,800 lines come off again, this time with the zoom end that
was supposed to replace them. Shortcuts renumber (⌘1 Write, ⌘2 Pages, ⌘3–⌘5 the rest) and
that is real muscle memory spent. The open book glyph moves from Entries to Pages, which
has the better claim to it. And the mobile bottom bar changes with the rail, which the
prototype does not cover at all.

**Unresolved, deliberately:** the surface's **name** — "Pages" describes one state of it
now, and Ascent, Lamp and Altar are each named for what they are. And whether **the words
you used** may be scoped to a person: RECALL takes it off person pages (on a spouse it
reads as a portrait of the marriage), against the counter-argument that the words on her
pages about her mother are about *her*, and the failure is framing rather than fact.

## D-024 — Read the chapter beside the journal; pasted verses land as scripture
**2026-08-22** · **Status:** Decided
**Decision:** tapping a scripture block opens **that chapter only** in a quiet pane beside the journal (the landed verse highlighted, writing still visible). A link at the bottom continues on ESV.org. There is no next/prev chapter and no book journey. Edit/Remove stay on a quiet `⋯` on the block (and on the pane), not on the primary tap. A paste that looks like a Bible-app verse — body plus an obvious citation — wraps in place as a scripture fence using **the writer's words**. We do not swap in ESV, and we do not wrap if we are unsure.
**Why:** the scripture prototype's beta pick was B (chapter beside the journal). Kristi (OPP-K2 / OPP-K3) already leaves to read around a verse and already pastes from a Bible app; `/scripture` quotes one verse and Lamp misses the paste. One chapter is inside Crossway's size cap and is passage expansion, not a Bible app. Typed underlines stay passive (Principle 3).
**What would change our mind:** people close the pane and open bible.com anyway; or a wrong wrap is shown as “your verse.” Either is a kill, not a tune. Crossway objecting to one-chapter display on the paid product also reopens this — then we keep the pane chrome and show only the ESV.org handoff.
**Cost accepted:** displaying one ESV chapter on a $7/mo product is commercially greyer than quoting a verse. We already quote ESV with attribution in Settings and treat one chapter as the same path. Missed wraps (plain-text pastes we declined) are acceptable; false wraps are not.

## D-023 — The app lock is one account-level PIN, and it is not encryption
**2026-08-17** · **Status:** Decided
**Decision:** an optional lock, off by default, set once and valid on every device the
account signs into. The verifier — a PBKDF2-SHA256 salt and hash, never the secret —
lives in its own `profiles.app_lock` column, mirrored to `localStorage` so the gate is
up before first paint and still works offline. Face ID on iPhone is a shortcut past
typing it, never a replacement. Forgetting the PIN is answered by signing in again with
Google or Apple, which is the only proof of the account we have.
**Why:** Kristi Wollbrink (OPP-K4) writes raw and won't while anyone who opens her
laptop can read it. The interview asked for a lock; what makes it usable is that it is
*one* lock — a device-local secret would mean setting a separate PIN on the Mac, the
iPhone and the web, which is the version people turn off after a week. Account-level
costs nothing against the real threat model: whoever can read that row already holds
the session that reads the entries.
**Not a softening of D-011.** This is an access gate on the UI. Entries are stored
exactly as they were, the model still sees plaintext at inference time, and every string
in the feature says so — "keeps someone who picks up your Mac or your phone out of your
journal. It isn't encryption." Principle 7 is satisfied by being unambiguous, not by
claiming more.
**What would change our mind:** if the lock is switched on and then off again by the
same people, it was friction rather than reassurance and should be deleted rather than
tuned. Measure activation and retention among users who enable it (the assumption test
already drafted on the backlog item).
**Cost accepted:** two honest weaknesses, both stated in the copy rather than papered
over. Recovery is only as strong as the provider session — on a Mac whose browser is
already signed into the owner's Google account, resetting the lock is a few clicks. And
a device that has never seen the account and cannot reach the network opens, because
there is no verifier on it to check a PIN against. Both are the price of refusing to
lock someone out of their own journal.

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

## D-016 — Remember: the writer supplies the signal, never the app
**2026-08-02** · **Status:** Decided (built, flag OFF pending the migration)
**Decision:** A fourth Return surface, **Remember** (⌘5), holding what the writer set
apart: passages they marked, blockquotes, markdown emphasis, and `/pray` blocks they
declared. Marking is **one gesture with no decision attached** — no colours, tags,
categories, notes-on-notes, folders, or saved searches. The ⌘K palette keeps saying FIND
and ASK; the destination gets the true word.
**Why "Remember":** `BRANDSCRIPT.md`'s approved word list opens with *remember* and the
villain it names is *forgetting*, so the surface is named after the counterattack. It also
closes the hole "Search" would have opened — nobody adds folders to Remember.
**Why marking at all:** it is the only signal of significance that cannot violate
Principle 1. The app never says which passage mattered; the writer already did.

**Three sub-decisions, all driven by measurement** (`scripts/emphasis-audit.ts` against
the real 3,540-entry archive):

1. **Marks needed a table after all.** The first plan derived everything from existing
   markdown, on the reasoning that formatting already carries significance. The archive
   says it mostly doesn't: emphasis appears in 16% of entries, blockquotes in 4%, and 54%
   of bold spans are a single word. **The absence of marks isn't evidence marking is
   unwanted — it's evidence the affordance never existed.** Nobody bolds a sentence for
   significance when nothing reads it back. Derived sources still seed the surface with
   404 passages on day one; the table adds `noticed_at`, which no derived source can.
2. **Scripture refs excluded.** 284 of 563 passages. Including them would make Remember
   half a second Lamp.
3. **Altar-harvested rows excluded.** `spiritual_items` looked like 6,276 free passages;
   6,257 of them are `source = 'scanned'` — model-harvested — and **zero** were
   writer-declared. Showing an inference as something the writer set apart is precisely
   the verdict this product doesn't render.

**Rejected: model-inferred significance.** *Recurrence is a count; significance is a
verdict.* A sentence written near-verbatim across nine years is a fact computed in code.
Which of your sentences mattered is not.
**Emphasis is filtered structurally, not semantically.** A span must end as a sentence or
run to seven words. An earlier version filtered by whether it sounded like the writer's
own voice — which drops *"Did your life ever benefit from the five fold ministry?"* while
keeping a bolded psalm. Deciding whose voice a sentence is in is a judgment we don't get
to make; whether it ends is a fact.
**What would change our mind:** users ask for colours or tags and the request survives a
Principle 2 review; or Remember goes unvisited after 60 days, meaning re-reading isn't
happening and Ask alone was the product.
**Cost accepted:** one table, and a surface that is honestly thin for a fresh-start user.

## D-022 — List and Pages are two reading modes of one panel
**2026-08-11** · **Status:** Decided · alpha only · **reverses D-018**

**Decision:** The entries panel is back, and Pages is one of its two reading
modes. `List | Pages` sit as siblings at the top of the panel; the grouping
control (`All · Month · Year`) is a property of the list and shows only when the
list does. ⌘1 shows the panel, ⇧⌘1 flips the mode. Choosing Pages puts the wall
on the canvas and **leaves the panel open** — which is what makes them read as
siblings rather than as a mode and an escape hatch.

**Why D-018 was wrong.** Its argument still looks sound on paper: the wall beats
a 30px row at every job the row does, so it should *be* Entries rather than hide
inside it. What that missed is that they are not the same job. A list of titles
and dates is for **finding something you already have in mind**; a wall of pages
is for **coming across something you don't**. Deleting the list didn't promote
Pages, it removed a way of reading — and the thing D-018 named as the cost
("browsing for a half-remembered entry becomes reliably slower") turned out to
be the whole objection, not a footnote.

**What that means for the D-018 kill condition:** it fired. It said "someone
reaches for the sidebar and can't find a way to do something they used to do —
in which case the wall gains it rather than the panel coming back." That was the
wrong remedy: the sidebar wasn't missing a capability, it was the capability.

**What survived from D-018 anyway** — the wall kept everything it gained while
it was Entries: selection, range select, the context menu, bulk export, delete,
keyboard navigation. None of that is thrown away by having the list back, and
none of it is duplicated: the panel's list and the wall each supply their own
order to the same `indexOf`-based range selection.

**What would change our mind:** the panel goes unused once Pages is a click
away, which would mean the list really was only a habit. Or the reverse — two
indexes of the same archive on screen at once turns out to be the clutter D-017
warned about, in which case the answer is a better way to switch, not deleting
one of them again.
**Cost accepted:** the ~2,800 lines D-018 deleted are back, and with them the
maintenance of two ways to read the same entries.

## D-020 — Remember is deleted; Ask lights the wall
**2026-08-08** · **Status:** Decided · alpha only · **supersedes D-016's surface**

**Decision:** The Remember surface is gone — the rail entry, the mobile tab, ⌘5, the
`well` route, and `VITE_FF_REMEMBER`. What it did is now done by Pages and ⌘K.

**Why:** D-016 built Remember to answer two things: *get back to what you set apart*, and
*ask the rest*. Once Pages could filter on Marked, Highlighted, Underlined and Quoted, the
first half was a worse version of a filter — a separate list of passages instead of the
pages they came from. And the second half never needed a surface: what Ask produces is a
**set of entries**, and the wall is where a set of entries is shown. So a question asked
from ⌘K now lights the wall, and arrives as a chip you can pull off like any other filter.

Ask itself is untouched and still earns its place: its lexical and vector legs catch pages
that circle a thing without ever naming it, which the wall's literal matching cannot.

**What survived:** `marks` — now a Pages filter and still the editor's decoration, in
`features/pages/useMarks.ts` · ⌘K Find, instant and local, moved to `features/find/` ·
`api/ask.ts` · the weather grid, moved to `features/pages/`.

**One thing worth watching.** `useRemember` carried a load-bearing `.is('source', null)`
filter, keeping the Altar's ~6.2k model-harvested `spiritual_items` out of a surface that
claimed everything on it was writer-supplied. Nothing on Pages reads that table, so the
trap is gone rather than relocated — but **if a future surface reads `spiritual_items`,
that filter has to come back.** Recorded here because the code that enforced it no longer
exists to be read.

**What would change our mind:** people ask questions and then can't tell WHY a page came
back — literal matching shows its work by lighting the word, and a vector hit has no word
to light. If that opacity bites, Ask results need their own way of explaining themselves,
which is an argument for a surface again.
**Cost accepted:** D-016's surface, ~1,100 lines, four months after building it. The
passage list in particular was a real idea; it lost to being a filter instead.

## D-019 — The model may configure the filters; it may never decide what matches
**2026-08-08** · **Status:** Decided · alpha only

**Decision:** A sentence typed into Pages ("times I talked about Chicago every year") goes
to `/api/pages/interpret`, which returns a **filter configuration** — words to light,
markings, months, dates — and nothing else. The wall applies it in code.

**Why this shape and not "AI search":** the alternative everyone builds is a model that
takes a question and hands back entries. That model is deciding which of someone's own
pages are relevant, and there is no way for them to see why or to disagree with it. Five
rules keep it on the right side of Principle 4 and D-016:

1. **Code decides what matches.** The model returns words; `subjects.ts` does literal,
   whole-word matching against the corpus already in the browser. The model cannot make a
   page light up.
2. **Everything it configured arrives as a chip you can pull off.** Nothing is applied
   invisibly. This is also the answer to the hotel-search filter panel: you say it, then
   you adjust what it heard.
3. **`sanitize` on the server drops anything unrecognised** — an unknown facet, a month
   that isn't a month, a field of the wrong type. A filter the writer can't see and can't
   remove is worse than one that never appeared.
4. **Date order is the fallback for everything**: offline, a failed call, an
   interpretation that found nothing.
5. **Offline degrades to searching the phrase they typed.** The wall never needs the
   network.

The model never sees the corpus — it sees the question and the writer's own Concordance
vocabulary, which is what lets "Chi-town" and "Chicago" be one subject to them and to us.
Same cost discipline as `api/ask.ts`: a few hundred tokens whether the archive is 40
entries or 4,000.

**Deliberately NOT built: per-entry ranking.** Having the model order the specific pages
code matched would mean sending entry content to it. That is a real trade — cost, and more
importantly what leaves the device — and it is a product call rather than something to
settle inside a refactor. Recurrence questions instead switch on "only these", which is a
visible, reversible, code-applied arrangement.

**What would change our mind:** the interpretations are wrong often enough that the chips
feel like a correction chore rather than a starting point — in which case the sentence box
goes back to being a word box, and ⌘K keeps the semantic half. Or the opposite: people ask
questions the filter vocabulary genuinely can't express, which is the argument for
revisiting ranking with the privacy trade made explicitly.
**Cost accepted:** a network round trip on a surface whose whole claim is that it works on
a plane — mitigated by the fact that failure is silent and lands on a literal search.

## D-018 — Pages becomes Entries; the list is deleted
**2026-08-08** · **Status:** REVERSED by D-022 (2026-08-11) · alpha only

> **Reversed.** The list is back and Pages is one of two reading modes in it.
> The reasoning below is kept because its kill condition is what fired, and
> because the capabilities the wall gained here all survived the reversal.

**Decision:** ⌘1 and the rail's "Entries" open the Pages wall. The desktop entries panel
and the mobile drawer are deleted, along with `EntryList` and twelve supporting modules.
While you are writing there is no sidebar, on either platform.

**Why:** D-017 put Pages in the Entries panel's view switcher on the reasoning that it is
"a way of looking at your entries, not a fifth thing to return to." That reasoning was
right and the placement was wrong: Pages is better than the 30px-row list at every job the
list did, so it should *be* Entries rather than hide inside it. Keeping both left two
indexes of the same archive, which is the clutter D-017's own note about the panel closing
behind Pages was already trying to avoid.

The rail still shows four ways to return. Entries is still under **Write**.

**What went with the list, and why none of it was a loss:** most of `EntryList`'s
machinery existed only because a list and an editor shared a screen —
`useEntryListKeyboard` was largely editor-vs-list arbitration, `EntryBulkCanvas` existed so
the editor could get out of the way when a 260px sidebar had a selection, and
`entrySelectionApi` existed to lift that selection somewhere it could be rendered. They
never share a screen again. Everything the list could *do* — multi-select, range-select,
rename, duplicate, print, export, delete — the wall does.

**Real losses, named rather than buried:** the left-edge swipe that opened the mobile
drawer, and the signed-in address that sat in the drawer header (still in Settings →
About). Also: a 30px row shows ~25 entries per screen and the wall at its densest shows
fewer. For "I know it was around March 2019", the list was faster; the year scrubber, the
month rules and ⌘K Find are what have to cover that.

**What would change our mind:** someone reaches for the sidebar and can't find a way to do
something they used to do — in which case the wall gains it rather than the panel coming
back. Or the density trade bites: browsing for a half-remembered entry becomes reliably
slower than it was, which is an argument for a list-tight end of the zoom rather than for a
second surface.
**Cost accepted:** ~2,800 lines deleted in one pass, and a navigation muscle memory
(⌘1 = "toggle a panel") that has to be relearned as "⌘1 = go to your pages."

## D-017 — Pages: a read surface, and a deliberate Principle 2 override
**2026-08-07** · **Status:** Decided · **routing superseded by D-018** · shipped to **alpha only, unflagged**

**No feature flag.** It shipped behind `VITE_FF_PAGES` for about an hour, then the flag
came out: the alpha channel is already the gate, and a second gate inside it is redundant
(the same call already made for handwriting scan). The practical consequence is that the
gate is now *when `master` gets merged into `stable`*, not a variable — so the audit tests
below have to be run before that merge, not before flipping anything.

**Decision:** **Pages** — the writer's own entries laid out as pages, side by side. A
canvas surface reached from the Entries panel's view switcher (`List · Month · Year ·
Pages`, plus ⇧⌘1), **not** a fifth rail destination.

> **Superseded by D-018 (2026-08-08).** Pages *is* Entries now: ⌘1 opens it and the panel
> it used to hide inside is deleted. The reasoning below — that it belongs to Entries
> rather than to the Return group — is what D-018 followed to its conclusion. Everything
> else in this row, including the Principle 2 override, still stands.

**Why it exists:** `POSITIONING.md` says *"Every other journal is a write surface. We're a
read surface."* The rail did not deliver that. Write had two mature surfaces; Return had
four — and every one of them **interprets**. Ascent arranges seasons, Lamp gathers verses,
Altar follows prayers, Remember answers questions. None of them let you simply *read*. The
only route to your own pages was a 30px row rendering `deriveTitle()` in 13px sans, with
the preview defaulting off: eleven years as a filing cabinet, inherited from Day One and
never designed. The gap was not "the sidebar is boring" — it was **you can navigate, or you
can be told; you cannot browse.**

**What it restores** (all four are things paper gives free and a list destroys): peripheral
vision · length as shape · accidental landing · your own marks catching your eye from a
distance. None requires AI, and the corpus is already resident client-side, so Pages costs
no endpoint, no migration, and no schema change — and it keeps paying out in a month with
four entries (Principle 5's "design for the dip").

**Why it belongs to Entries, not the Return group:** it is a way of looking at your
entries, not a fifth thing to return to. It still obeys the Return rule — *you go there to
see, never to do.*

### ⚠️ The override: the weather grid may be drawn over writing activity

`SURFACES.md` and `weather.ts` both stated absolutely that the grid is *"only ever drawn
over passages or over the matches for a question — never over writing activity."* On Pages,
with no subject chosen, it **is** drawn over writing activity. Per `PRINCIPLES.md`,
overriding a principle requires saying so out loud; this is that row.

**Why:** the surface's one rule is that the grid always describes exactly what the wall is
showing. With a subject lit it covers the matches (the sanctioned case); with none it
covers the whole archive — which is writing activity. Special-casing it to blankness would
break the only rule that makes the reading legible.

**What the override does NOT license** — these remain prohibited at every call site:
totals · a goal · a current-streak · a "days since" · any copy about not having written.
Empty cells keep `--border-subtle`: never a red, never a gap, never a dashed outline. The
grid is held to a narrow column beside the facts, never leading the surface — stretched
wide, the same grid stops reading as weather and starts reading as a scoreboard.

> **Amended by D-018:** the grid is no longer *on* the wall at all. It moved to its own
> frame, reached from one quiet line, because a picture *about* the reading was standing in
> front of the reading — on a phone it took the screen and left one page peeking in
> underneath. It is still held to a narrow column there: having its own page is not
> permission to stretch.

**The sharpest element, flagged rather than hidden:** `buildFacts` returns
`longestSilence`. Over passages it's a fact; over writing activity it edges toward telling
someone how long they failed to show up. It ships, marked in `PagesView.tsx` as three lines
to delete. **This is the first thing to cut if the audit test fails.**

**Audit test (run it before merging `master` into `stable`):** show the wall to someone in a dry
season. Weather, or a record of how often they failed to show up? Also: open Pages in a
month with four entries — a way back, or an inbox?

**Also decided:** echoes interleave as pages rather than popping up as cards, and the
`resurface_dismissals` loop in `lib/echoes.ts` stays unwired — a card with a dismiss button
is a chore about your prayer life, and an interleaved page needs no dismissal. Subject
lighting **dims, never filters**: the pages that don't carry a word are what give the ones
that do their shape.

**What would change our mind:** the dry-season test fails (cut `longestSilence`, then the
activity grid itself, leaving subject lighting); or Pages goes unvisited, meaning the
Entries list was adequate and the gap was imagined.
**Cost accepted:** a Principle 2 exception that a future reader will find surprising, which
is why it is written here and cross-referenced from `weather.ts`.

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
