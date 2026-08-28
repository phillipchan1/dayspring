# Recall — validating JG1 / JG2 / JG3

> **Status:** Draft 1, 2026-08-17. **Nothing here is decided.** This is the frame and the
> test plan for an opportunity cluster from the first two real beta interviews. A
> `DECISIONS.md` row gets written only after the calls come back, and only if something
> survives.
>
> **Spine for the prototype (2026-08-17):** Door 2 — *the things you carry* — with
> Door 1 (your words are the index) and Door 3 (it comes back after you write) as
> ways in, not as competing products. Click-through: [`prototypes/recall/`](../prototypes/recall/).
> Live URL (screen-share on the call, do not send cold): [recall.prototypes.usedayspring.app](https://recall.prototypes.usedayspring.app/#strand) · [prototypes.usedayspring.app/recall](https://prototypes.usedayspring.app/recall/#strand)

---

## The cluster

Two interviews — Kristi (Aug 4), Judy (Aug 12), both marked strong ICP fit — produced
three opportunities that Phil reads as one problem:

| | Opportunity | Children |
|---|---|---|
| **JG1** | Journal isn't with her when she needs it | J1 misses capture moments (waiting in the car) · J2 resents carrying two journals |
| **JG2** | Can't make sense of what she already wrote | J3 can't find things in messy, undivided free-form entries · J4 has no time to maintain an index or tagging system, but wants to find entries by area |
| **JG3** | Reviewing past entries is effortful or uncomfortable | J5 wants themes and breakthroughs without rereading every word · J6 finds revisiting old stream-of-consciousness vulnerable |

**They are one loop: Catch → Keep → Return.** A fragment caught in the car is worth
nothing if it can't be found; a thing that can be found is still avoided if returning to
it costs a reread of the whole pour. Each broken link makes the next one moot.

**And the loop has a unit problem.** Every retrieval path in the product today hands back
an *entry*. But J3's sentence about her mother was buried in paragraph six of a
two-thousand-word entry, J5 doesn't want to reread the entry, and J6 is uncomfortable
*because* it's the whole entry.

> **The primitive: the line is the unit of memory, not the entry.**

Return the sentence, dated, verbatim. Make opening the full entry a deliberate second act,
always. That is simultaneously the answer to J3 (the line was buried), J5 (no rereading),
and J6 (you meet your own clearest sentence, not the whole pour) — and it is grounded by
construction, because a line is something the writer typed.

---

## What beta users actually have (checked, 2026-08-17)

`stable` is **97 commits** behind `master`. `src/features/pages/` **does not exist on
stable at all.**

| | On `stable` (beta) | On `master` (alpha, Phil only) |
|---|---|---|
| ⌘K Find — local substring, offline | ✅ | ✅ |
| Ask — lexical + vector | ✅ → renders into **the Well** (`features/well/WellView.tsx`, in the rail, unflagged) | ✅ → lights the Pages wall (D-020) |
| Ascent · Lamp · Altar | ✅ | ✅ |
| Voice dictation | ✅ | ✅ |
| **Pages / the wall** | ❌ *(does not exist)* | ✅ |
| **Concordance-backed subject lighting** (`subjects.ts`) | ❌ | ✅ |
| **The line that made the page light up** (`pageExcerpt.ts`) | ❌ | ✅ |
| **Marks as a filter** | ❌ | ✅ |
| **Natural-language filter configuration** (`api/pages/interpret.ts`, D-019) | ❌ | ✅ |
| **Handwriting page scan** | ❌ | ✅ |
| Concordance drawer | engine populating silently, UI off | same |

### What this settles, and what it doesn't

**It does not dismiss the opportunities.** What beta users have is *question-shaped*
retrieval: ask a question, get back a set. What they have no form of at all is
*subject-shaped* retrieval: see one thing, across time. That is precisely JG2 and JG3, and
no amount of shipping `master` to `stable` would supply it.

**It does reassign some of the children.** J3 ("can't find things") is partly answered by
Find and Ask, which they already have and may not know about — Kristi's own K1 says
features go unnoticed for weeks. J4 (find by area), J5 (themes without rereading), and J6
(vulnerability) are answered by nothing, on either channel.

**Ask this before showing anything, in every interview:**

> *"Show me how you'd find something you wrote about last spring."*

Watch what they reach for. It separates *the tool is missing* from *the tool is hidden*,
and it costs one question.

---

## The doctrine line (settled — do not relitigate)

- **D-016** — *"Recurrence is a count; significance is a verdict."* Model-inferred
  significance was rejected outright. The writer supplies the signal.
- **D-019** — the model may return **words to match**; code does the matching, and every
  inference arrives as a chip you can pull off.
- **SURFACES.md** — *Return surfaces are for seeing, never for doing.* A screen where you
  maintain subjects is a to-do list about your prayer life.
- **`Pages.css` rule 1** — nothing on a page except the writer's words, their date, and
  their marks. No badge, no count, no chip.
- **VISION non-goals** — not a PKM app. *Never.*

| Legal | Forbidden |
|---|---|
| "Appears in 14 entries" — a count | "This entry is about displacement" — a verdict |
| Matching the writer's own words, in code | A model deciding what a page is *about* |
| A subject the writer named | A theme the app named |
| Keeping a subject as one gesture, like a mark | A subject-management screen |

**Person-subjects: allowed, verbatim-only.** GUARDRAILS permits quoting what the writer
wrote about a person; it forbids characterizing them, profiling them, or inferring their
state. A person's subject view shows their own lines, their dates, first / most recent /
count — never a trend, a tone, or a read on the relationship.

### One constraint discovered while mocking this, worth keeping

**A line view must show every matching line, or the app has made a judgment.** The moment
it shows the "best" eight of forty, something selected them, and selection is significance,
and significance is a verdict (D-016). So the count on the header must equal the lines
below it.

That means J5 — *themes and breakthroughs without rereading every word* — is served only
partway, and honestly: you still read every line, just not every word. Whether that is
enough is the whole bet of Experiment A, and it is the thing to watch for in the call.

### Vocabulary

**Banned** (BRANDSCRIPT + GLOSSARY), and this topic attracts all of them: *track, review,
insights, score, progress, goal, dashboard, analytics, journey, AI-powered, inbox,
workflow.*
**On-register:** *remember, carry, notice, evidence, history, over time, season, your own
words.*

Note `throughline` is already taken — `ReflectionContent.throughline[]` on the yearly /
Summit rollup. Don't reuse it for this.

---

## The four acts

The loop has three decisions in it and one escape hatch, and they run in order: **what the
journal comes to know you carry**, **what that list looks like**, **what is on the page
when you open one**, and **what happens if you never go looking at all**. The prototype
walks them as a story.

In every mock **the screens carry no product names** — a name is a pitch, and PERSONAS.md
says the instant you explain a feature the data is contaminated. Screens are titled with
the subject itself.

### Act one — what it comes to know you carry

Four mechanisms, ordered by how much work the writer does against how much the app
decides. **1.4 composes with any of the others; 1.1–1.3 are alternatives to each other.**

| | Mechanism | State | The trade |
|---|---|---|---|
| **1.1** | Nothing is kept — your own words are already the index | Built, alpha only (`subjects.ts` + Concordance) | Zero maintenance, which is exactly J4's ask. Fails if you arrive not knowing the word — a blank field is only free if you do. |
| **1.2** | It offers what keeps coming up; you keep or dismiss | Mostly built — `suggestedSubjects()` already orders by `occurrence_count`; missing only the keep gesture | Zero setup *and* something to react to. Recognition beats recall. Probably the strongest. |
| **1.3** | You name what you carry | New — a `kept_subjects` table mirroring `marks` | Maximum control, maximum setup. Closest to a principle violation (see below). |
| **1.4** | You mark it as you write | Shipped, alpha only (`marks`) | The only significance signal that cannot violate Principle 1, because the writer gave it. The unprompted ask from the paper journaler in PERSONAS.md. |

**There is deliberately no fifth option where the app reads your entries and produces
themes.** D-016 settled it: *recurrence is a count; significance is a verdict.* Automatic
by recurrence is arithmetic and is fine. Automatic by theme is the app deciding what your
life is about, and it is the thing every competitor ships.

**1.3 is the risky one** — one gesture from the tag manager SURFACES.md forbids, one
screen from a Return surface that asks you to work, one step toward the PKM drift VISION
rules out. Order kept subjects by *when they were kept*, never by count: Riverside above
Mom at 31 entries to 14 would be the app ranking what someone carries.

*Falsified if:* they can't name three subjects without a long pause (kills 1.3, and points
at 1.2). Or they ask for folders, colours or nesting — D-016's own kill condition firing.

### Act two — what you end up with

Not a search box: a short list of the things you carry, each with the shape of its own
history beside it, each one a way in.

**Order is the order they were kept**, never by count. A list sorted by frequency is a list
ranking what matters in someone's life.

**It is a Return surface, so it may only show.** No rename, no merge, no reorder, no
archive — the moment it grows management affordances it becomes a to-do list about someone's
prayer life. Keeping happens back in the lighting bar (1.3); this only opens.

D-022 already drew the neighbouring distinction: *"A list of titles and dates is for finding
something you already have in mind; a wall of pages is for coming across something you
don't."* This is a third thing again — the handful of subjects that have a history, so that
opening one is a decision made once rather than a query composed every time.

*Falsified if:* they want it long. Four is a handful; forty is a filing system, and that is
the PKM drift VISION rules out.

### Act three — what is on the page when you open one

Three answers to the same question, escalating. Shown in order so the later ones have
something to be better than.

**3.1 — the entries that mention it.** A list of results, roughly what ⌘K Find gives beta
users today. In the prototype on purpose: if they say "this is fine," that is a real and
very cheap finding. What it fails at is J3 — it hands back the entry, not the sentence
buried in paragraph six — and J6 won't open it.

**3.2 — the sentences themselves, oldest to newest.** See *the line is the unit* above.
Cheapest thing on the page: a second reading mode on Pages when a subject is lit
(`pages | lines`), reusing `subjectMatcher()` and `splitOnMatch()` from `pageExcerpt.ts` as
they stand. No new table, no model call, works offline.

**3.3 — the chapter.** The subject's own page. Everything below.

#### A chapter, not a panel — and the difference is boxes

A panel is tiles in a grid; a chapter is one column with rules down it, read top to
bottom. Same facts, entirely different object. It is also already the product's
vocabulary: **a concordance entry in a Bible is exactly this** — a word, and every place
it appears, in order.

#### The rule that keeps the model out of the oracle's chair

> **The model may point, never pronounce.** It can choose which of your own sentences to
> put in front of you. It may never write a sentence about you.

Every model-assisted movement below reduces to *selection*, validated server-side by exact
substring match against a real entry — the grounding assertion GUARDRAILS.md already names
as the highest value-per-effort thing to build. Per H1: *"The user may draw that
conclusion. It is theirs to draw, and it is the most meaningful thing in the product
precisely because the app didn't hand it to them."*

#### What goes on the page, and what each costs

| Movement | How it's computed | Cost |
|---|---|---|
| **The band** — every month you wrote it | Arithmetic | A job kind on `processing_jobs` (five edits, per `processing.ts`) |
| **Stretches** — bursts bounded by silence | Burst detection in code; model picks one verbatim line per burst | Same job + one cheap model call |
| **The words you use here** | Term frequency in matching entries against the writer's own baseline | No model at all |
| **What you asked** | Lines ending in `?`; model only orders and trims | Trivial |
| **Brought before God** | `spiritual_items` where `type='prayer'`, plus the `encounters` the user named | Already stored |
| **Open beside it** | Join `scripture_refs` against the subject match | Essentially free — 263 refs already backfilled |
| **Named in the same entries** | Co-occurrence count | Same job as the band |
| **What you set apart** | `marks` | Already stored |

#### How "stories" get found without inventing any

A story in a journal isn't a theme, it's an **episode** — and an episode has a detectable
shape: **a burst of entries on one subject, bounded by silence.** That is arithmetic, and
the density band already draws them; every cluster in it is a candidate.

1. **Code** finds the burst — five entries in eleven days after four quiet months. A fact.
2. **The model** does exactly one thing: picks which verbatim line from inside that burst
   is the way in. It never writes a title.
3. **The server** drops the pick if it isn't an exact substring — the same validation
   `synthesize.ts` already runs on every quote.

The app never claims these are stories. It says "five entries in eleven days" and shows
the writer their own sentence. **They supply the word "story."**

#### Why the band is not a chart

Principle 1, verbatim: *"there is deliberately no vertical axis, because a vertical axis
would imply better and worse."* A bar chart of mentions-per-month has a Y axis, and a
falling one reads as **you care less about your mother now** — a verdict on a relationship,
rendered by a machine. A band carries rhythm and gaps and has no height at all. Ramp is the
Lamp's own ember→gold (`--scripture-ember` → `--scripture-gold`), so it speaks the same
visual language as the canon heat and the Altar.

#### The legal version of "sentiment"

Tone scoring is an H2 violation and always will be. But GUARDRAILS' own approved example is
*"'Angry' appears in 7 entries this month"* — so **the words you use here**, a frequency
list of the writer's own vocabulary against their baseline, is explicitly sanctioned. It
also lands harder than a sentiment score would, because every word in it is theirs.

The same rule kills a related idea: **"reflections about X" cannot be inferred.** Sorting
reflective sentences from reportage is deciding which of someone's sentences mattered —
D-016's verdict, exactly. The legal proxy is what they *declared*: `/pray`, `/sense`,
marks. If that set feels thin, the fix is making marking easier, not making the model judge.

#### Three calls worth arguing about

1. **Prayers are never a ratio.** 22 brought, 3 named — as two facts, never "14% answered."
   A percentage there is a scoreboard on God, and it is the worst thing this page could
   render.
2. **The gaps.** The band shows twelve months of silence as plainly as a cluster. H2 says
   absence is not ours to interpret. Showing a gap as a *shape* is arguably not
   interpreting it; writing a sentence about it certainly is.
3. **Person pages are smaller, deliberately.** GUARDRAILS: reflections *"may quote what the
   user wrote about a person; they must never characterize that person, build a profile of
   them, or infer their state."* So two movements come off:
   - **"The words you use here"** — on a project it's a portrait of your own interior life;
     on your wife it reads as a portrait of the marriage, and a bad month puts a bad word at
     the top of it.
   - **"Named in the same entries"** — legal as a count, but a network of the people around
     your spouse is the closest thing in the product to a dossier.

   What survives is the strongest thing anyway: the episodes, the prayers you prayed for
   her, the lines you set apart. That is the VISION three-year picture nearly word for word
   — *"They cry a little. They send it to their spouse."*

*Falsified if:* they say "I'd just open the entries" at 3.2; or the chapter reads as being
*about* them rather than *by* them; or they ask for the one thing it deliberately won't do.

### Act four — or you never go looking

**Bet:** return has to be initiated by the app, or it won't happen.

**3.1** — you don't go looking. You finish writing about something you have carried a long
time, and one line from years ago is set beside the entry you just closed.

**Two constraints the design must visibly respect:**

1. **Principle 3** — nothing appears inside the composing surface. It lands *after* the
   writing, beneath the entry, never as live editor chrome.
2. **Principle 2** — it may only ever appear *because you just wrote about the thing*.
   Never *"you haven't written about her in three months."* That sentence is guilt, and
   guilt is the mechanic this product committed never to build.

**The app says nothing here on purpose** — no heading, no "you might want to see this."
A hairline, a date, and their own sentence. The marked word is the only explanation
offered, and it answers the question D-020 left open: *why did this come back?* The
current entry is deliberately left unmarked, because `Pages.css` rule 1 says nothing goes
on a page except the writer's words, their date, and their marks. **If they don't see the
connection unprompted, that call was wrong.**

**Where it would live:** post-save, below the fold. The anniversary variant partly exists
already as Pages' interleaved anniversary pages.

**Falsified if:** it reads as interruption, or as the app watching them. This is the one
that can fail as *creepy* rather than as *useless* — a distinct signal, worth catching
separately.

---

## Tenure — the axis, discovered while prototyping the four acts

> Added 2026-08-24, alongside six further arrangements in
> [`prototypes/recollection/`](../../prototypes/recollection/). **Still nothing decided.**

Act four frames the choice as *a destination you go to* against *a thing that arrives*.
Building both sides showed that is not the axis that decides anything. **Tenure** is: how
long a page exists, and whether it can pile up while the writer is not looking.

| Tenure | Property | Guilt risk |
|---|---|---|
| **Permanent** | always there, same shape, grows as you write | none — nothing waits |
| **Occasional** | exists because of a date, **gone when it passes** | none *if it expires* |
| **Ephemeral** | appears once beside something you just did, stored nowhere | none — cannot be a backlog |
| ~~Pending~~ | waits for you, accrues | this is the inbox |

> **The rule: no occasion may accrue.** A weekly page that is gone on Monday is a liturgy.
> The same page still there in March is a chore about someone's prayer life, and no amount
> of gentle copy fixes it.

This is what makes a *timely* surface possible at all without violating Principle 2. The
reason the product has no weekly review today is that every weekly review anyone has
shipped is **pending** — it waits, it counts, and being behind on it is the mechanic. An
occasional page that simply expires has none of that, and the tradition's own scheduling
works exactly this way: Advent arrives whether or not you were faithful, and then it leaves.

Of the arrangements prototyped, `liturgy` is the only one carrying a horizon, which makes
it the only one that can rot into *pending*. Everything else is permanent or ephemeral by
construction.

> **Picked up 2026-08-28 by [`VISITATION.md`](VISITATION.md)**, which is an *occasional*
> page taken seriously: a span page that arrives, expires on a date, and is never
> archived. The tenure rule above is the whole reason it is buildable, and the test it
> hands the idea — *"a hook works by making you feel bad if you do not come back; an
> occasion works by being there whether or not you did"* — is the falsifier to watch.

## What the contemplative tradition asks for that none of the four acts do

The four acts are all **selections** — computed fresh on arrival, and all of them lists.
That is software's instinct, not the tradition's. Six mechanisms it asks for instead, all
prototyped in `prototypes/recollection/`, none decided:

| | What it is | Where it comes from | Doctrine |
|---|---|---|---|
| **the word** | one line, the whole screen, a delayed way on | the desert — "give me a word", one saying carried for years | writer-supplied; no count on screen |
| **again** | the same line, served a second time | the Exercises repeat rather than advance; lectio's *ruminatio* | identical to `comesto`; the app is merely permitted to repeat itself |
| **consolation** | an `Absence` she declared, with a `Gift` she declared before it | Rules for Discernment 8 — remember that the consolation was real | both ends declared; **deliberately one-way**, never a Gift shown against an Absence |
| **around now** | ±7 days of today in prior years; opt-in seasons; or her own recurring dates | a calendar that returns, not a review you owe | occasional tenure — expires, never counted; seasons are opt-in because GUARDRAILS forbids assuming a practice |
| **the words you use** | vocabulary present in one span and absent in the other | — | GUARDRAILS' own sanctioned form ("'Angry' appears in 7 entries"); no number beside any word, ordered by first appearance; **archive-scoped, never person-scoped** |
| **what you asked** | every line ending in `?`, repeats grouped by earliest | — | **an argument, not a recommendation** — see below |

**Why `consolation` is the strongest of the six.** It is the clearest case in this whole
space of digitising removing manual labour from a practice that already existed. Ignatius
addresses the instruction to precisely the one person who cannot carry it out: from inside
a dry season you cannot find where the gifts were, and paging back a year to look is the
reread J5 and J6 both refuse. Code does it instantly, and invents nothing — she marked the
absence, she marked the gift, and the app writes nothing between them. On the fixture, two
of five absences have no earlier gift, and the honest render is the absence alone.

**Why `what you asked` is flagged.** The arithmetic is unimpeachable — a line ending in a
question mark is a fact about the text, and every one of them is shown. The risk is the
shape: a question asked four times across two years and never again has a visible last
date, and a reader supplies the word *answered*. That is exactly right when the reader
supplies it and exactly forbidden when the app does (H2 — absence is not ours to
interpret). So nothing on the page says `answered`, `resolved` or `no longer`, and groups
are never sorted or separated by whether they are still being asked. **Whether even the
arrangement crosses the line is a real argument and should be had on a call.**

**One measurement worth carrying forward.** A vocabulary diff across uneven spans is not a
finding, it is a volume difference — on the fixture, two years against the two before
returns 59 words started and 9 stopped, which is 36 entries against 11. It reads as a
verdict on the thinner side. The fix is not normalising into a rate (a rate is a metric);
it is putting the entry count for each span on the screen, always.

---

## How to run the test

Method: **reaction piece inside a live call.** Not a link sent cold — a concept deck sent
cold is a pitch, and PERSONAS.md is explicit that people say yes to be kind.

The click-through lives at [`prototypes/recall/`](../prototypes/recall/), hosted at
[recall.prototypes.usedayspring.app](https://recall.prototypes.usedayspring.app/#strand). The URL opens on the strand
with a scene bar at the bottom. Open `#notes` yourself before the call. Before you share the
screen: go to Quiet (`#quiet`) and press `S` to hide the bar. Keys `1`–`8` switch scenes.
Do not name doors.

1. Run the existing PERSONAS.md past-behaviour questions first. Nothing is shown yet.
   Especially Q4: *"When was the last time you went back and read something you wrote a
   year ago? What made you do it?"*
2. Ask the distribution question: *"Show me how you'd find something you wrote about last
   spring."* Watch what they reach for.
3. **Then** share screen. Walk Quiet → blank field (`2`) → offer (`3`) → name (`4`) →
   entries (`5`) → lines (`6`) → strand (`7`) → echo (`8`). Say nothing about which is
   preferred, and don't name them. On the strand, open **the kids** so the car fragment
   is visible. The buried driveway sentence is in the Mar 4 entry.
4. After Act one (blank / offer / name), ask: *"Which of these would you actually end up with after a year?"*
5. After Act two (entries / lines / strand), ask only: *"What is this?"* — then *"Which of these would you have
   wanted last week?"* — then be silent. The second thing they say is the true thing.
6. Never ask *"would you use this?"*

Watch especially: do they open the full entry on almost every line? Does the heat band's
silence read as shame? Do they see the echo's connection unprompted?

Record verbatim phrases. Per PERSONAS.md Q11 those become copy, and they will be better
than anything we write.

---

## Results

*(Fill in after the calls. Move statements from hypothesis to finding with the date
attached, then write the `DECISIONS.md` row — or write the row that kills it.)*

| Date | Who | Act one pick | Act two pick | Verbatim phrases | What it falsified |
|---|---|---|---|---|---|
| | | | | |

---

## Related

- `PRINCIPLES.md` — 1 (light not verdict), 2 (never gamify), 3 (editor sacred), 4 (grounded)
- `DECISIONS.md` — D-016, D-019, D-020, D-022
- `SURFACES.md` — Pages, and the Write/Return split
- `src/features/pages/subjects.ts`, `pageExcerpt.ts` — the machinery all three build on
- [`prototypes/looking/`](../../prototypes/looking/) — the surface these acts became:
  `look for`, subjects offered and kept, the chapter, four readings, and the list as the
  far end of the zoom. Settled as [D-025](DECISIONS.md); build plan in
  [`docs/PAGES_REPLACES_ENTRIES.md`](../PAGES_REPLACES_ENTRIES.md).
- [`prototypes/recall/`](../prototypes/recall/) — standalone click-through, [recall.prototypes.usedayspring.app](https://recall.prototypes.usedayspring.app/#strand)
