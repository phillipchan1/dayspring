# Director moves — what a spiritual director actually does with an archive

Written 2026-09-06. Research doc, not a plan. It exists so the intelligence layer is
reverse-engineered from a real discipline instead of invented feature by feature.

The question it answers: **if you hired a spiritual director, a contemplative, or a
pastor and handed them 3,000 pages of someone's journal, what would you ask them to
do?** Everything below is a move somebody is actually trained to make.

Read [THE_KEEPING.md](../THE_KEEPING.md) § The model first. This doc assumes its four
orders and does not restate them.

---

## The finding that reframes the rest

Across Ignatian direction, the Wesleyan class meeting, narrative therapy, and
clean-language coaching, two things hold everywhere:

**1. The practitioner is trained *away* from interpretation.**

- Grove's Clean Language: the facilitator may use *only the client's own words*, plus
  nine fixed questions, "with the least possible influence from the practitioner."
- Ignatian supervision: the director's job "is not to label these movements for the
  directee, but to help them stay with their experience long enough to see where it
  leads."
- CPE verbatims: write the encounter word-for-word, then **circle** what opened the
  person and **underline** what closed them. Marking, not scoring.

Principle 4 (*grounded, or silent*) and Principle 6 (*their words, their theology*)
are not Dayspring quirks. They are the profession's own core competency, arrived at
independently. We can borrow the methods wholesale without fighting our guardrails.

**2. The deliverable is a question, not a summary.** Wesley's entire apparatus for a
century was one question: *How is it with your soul?*

**Consequence for us:** a question over retrieved evidence carries a far lower
correctness bar than a claim. *"Here are 9 pages where you wrote about your father —
look again"* survives a bad member; *"your father is a theme in your prayer life"*
does not. If the first shipped surface for the join is retrieval-with-a-question
rather than a labelled claim, it can ship below the 70% gate that a claim requires.

**3. The director never reads the journal.** The directee brings what they choose.
That is a UX stance, not only an ethic — the intelligence should feel like the writer
carrying material forward, not the system having read everything.

---

## The unit

One row type. Everything downstream is set operations over it.

```
finding = { page_id, char_start, char_end, subject_id?, kind?, date }
```

This already exists. `char_start`/`char_end` are live in production
(`20260829120000_marking_positions.sql`) and `backfill-positions.ts` has never been
run — 5,667 of 6,405 locatable on the 2026-09-04 dry run, "text no longer in the
body: 0."

> **Rule: the foundation is positions, not vocabulary.** Until the backfill runs, a
> typical page shows five markings with no stored position and every many-to-many is
> guessing.

---

## Five operators

Every move below is a composition of these. Three need no model at all.

| | Operator | Needs a model |
|---|---|---|
| 1 | `count(x) over time` | no |
| 2 | `gap(x)` | no |
| 3 | `cluster by date` | no |
| 4 | `co-occur(a, b)` | yes |
| 5 | `contradict(a, b)` | yes |

Ten narratives out of five operators over one row.

---

## The ten moves

### Served by subject + time (no model, nothing to gate)

**1. The silence about a subject.** *"You wrote about your father weekly for two years
and not once since March."* Pastors and directors do this constantly. It is counting.
It is also the most dangerous framing in the set — state it as a fact with dates,
never with "why?"

**2. Episodes and stepping stones.** Progoff's Stepping Stones: 10–12 periods, listed
fast, without deliberation. The detail that matters — he has you **re-do it
periodically and compare the lists**, because which stones you pick reveals where you
are standing now. `bursts` produces the candidate set; the *writer* names them;
keeping successive namings is unbuilt and completely verdict-free.

**3. Images of God across eras.** The spiritual-autobiography exercise: for each life
period, name your image of God. Directors watch that shift. Mechanically it is
vocabulary arithmetic on a near-closed set and the Concordance already detects names.
*Father for a decade, then Shepherd* is the most on-promise artifact available to us —
it **is** "what God has been making of you," in the writer's own nouns.

> **Trap: do not normalise God-names to one subject.** If `Father` and `Shepherd`
> collapse into `God`, this feature dies. The subject *kind* is God; the subject is
> the name.

**4. The ledger.** Asked-for, then returned to — the oldest Protestant journal
practice. Altar is already this. The unbuilt half is time: *"you asked for this three
years ago; read what you wrote last week."*

### Served by the join (subject × marking)

**5. Unique outcomes.** Narrative therapy's most-trained move: find the page that
contradicts the dominant story. A director digging through 3,000 pages of *"I'm
failing at prayer"* is hunting for the day the person wasn't. *"You wrote 'I can't
pray' 40 times. Here are the 6 times you described praying easily."* Pure retrieval,
verbatim, no claim attached. The verdict risk is entirely in the framing.

**6. Return to what moved you.** The Exercises' most-issued instruction is not
analysis — it is *go back to where the movement was strongest and stay there longer*.
Not a summary; a re-reading invitation. Needs a saliency signal, which is what
sentiment supplies (below). Scripture's returning strip is this, narrowed to verses.

**7. Consolation and desolation as a sequence.** The central Ignatian move. The
pattern is in the *order*, not the moment — after a month "you'll have real data about
how the spirits work in your life specifically." Legal only in the form set out below.

**8. Landscape of action vs. landscape of consciousness.** Narrative therapy runs two
question sets over the same events: what happened, and what it meant. Directors notice
the imbalance. Legal form: the writer filters their own archive by marking kind and
sees the shape. Navigation, never a ratio-as-score.

### Served by neither

**9. The refrain.** Reflecting back an exact repeated word — the single most-used move
in the discipline, and the whole of Clean Language. *"You have written 'tired' 14 times
since March. Here are the 14."* Verbatim n-gram counting over raw text.

> **Routing the refrain through a subject destroys it.** Its power is the exact word,
> not the concept.

**10. Dialogue.** Progoff's second dimension: write *to* a person, work, event, or your
own body — not about it. Directors assign this between sessions. Product form: hand the
writer their own old page and ask them to answer it. Generates writing instead of
reports. Nothing in the app does this today.

---

## Sentiment is allowed (D-028)

Phil's call, 2026-09-06, overriding the prior reading. On close inspection the prior
prohibition was narrower than it looked, and three of its four sites already permit
the legal form.

| Site | What it actually forbids | Conflict? |
|---|---|---|
| PRINCIPLES §1 | "sentiment **badges**" — a glyph | No. Badges stay forbidden. |
| GUARDRAILS H2 | a **score**, sentence, emoji, or good/bad colour — and its own **approved** example is *"'Angry' appears in 7 entries this month"* | No. The named, counted form is explicitly sanctioned. |
| RECALL.md:260 | "Tone **scoring** is an H2 violation and always will be" | No. Still true. |
| GLOSSARY:107–109 | "a sentiment **kind** does not rescue it … any arrangement of it over time rebuilds the axis" | **Yes.** This is the one site that must change. |

**The GLOSSARY objection, met directly:** arrangement over time rebuilds the axis
**only if the states are ranked.** `grateful → heavy → grateful → numb` plotted by
date has no up. The axis appears the moment anything maps those to ±1.

### The form

A sentiment is **the writer's own affect word, as a verbatim span, unordered.** Not a
polarity, not a scale, not a normalised label.

**It is its own kind, separate from `sense`, because they point in opposite
directions:**

| | `sense` | `sentiment` |
|---|---|---|
| What it is | prophetic sensing — what the writer received | the writer's feeling **toward** something |
| Direction | *from* God, to the writer | *from* the writer, at a subject |
| Example | "I sensed the Lord saying wait" | "I'm still angry at my brother" |
| **Subject** | **must not be required** — the source is God, not a named thing | **required** — a feeling toward nothing is not a sentiment |

> **Rule: subject arity is per kind, and this is where the schema got it wrong
> before.** `subject` being REQUIRED is exactly what held `prayer` to 13% in a
> ~90%-prayer archive — a prayer about the writer's own heart had nowhere to go, and
> 64% of v3's pairs carry no subject at all. `sentiment` is the one kind where
> requiring a subject is *correct*. Encode arity per kind now rather than discovering
> it again in the numbers.

Ignatius supplies the reason this is spiritual rather than mood tracking: consolation
and desolation are **directional, not valenced** — toward God or away from Him.
Gallagher's central teaching is that desolation can accompany pleasant feelings and
consolation can accompany grief. Toward/away is not better/worse, which is exactly
what keeps it clear of Principle 1's vertical axis.

### The four rules

1. **No number.** No scale, no average, no percentage, ever.
2. **No slope.** Sequence, not trend. Never "improving" or "declining."
3. **No aggregate glyph.** No colour-coded month, no sentiment on a page thumbnail.
   A badge is still a badge.
4. **Verbatim anchored.** Every sentiment points at the sentence that earned it.

> **Falsifier: if any code path assigns a numeric or ordinal value to a sentiment,
> the guardrail has been breached.** That is the test, and it is greppable.

### What it buys

Move 7 becomes possible at all, and move 6 gets the saliency signal it was missing.
Both are Ignatian, and between them they are most of what a director does month to
month.

---

## What the whiteboard gets wrong

The board reads: `subject (domain / self / God)` bracketed above `sentiment ·
scripture · sense · desire · growth · struggle`. Four of those six belong elsewhere,
per the type system that already exists:

| On the board | Where it goes |
|---|---|
| `scripture` | **Order 2 — a subject.** It persists, recurs, has its own surface, and you click it. Behaves like "Mom", nothing like "prayer". |
| `growth` | **Order 3 — a pattern.** `markKinds.ts:16`: "a rising glyph beside someone's spiritual life is a grade." Already shipped as `thenAndNow`. |
| `struggle` | Redundant once sentiment is allowed — it is a sentiment word. Do not mint a kind for it. |
| `sense` | Stays, narrowed: **prophetic sensing**, what the writer received. Not mood. |
| `sentiment` | Stays as **its own kind** — feeling toward a subject. See D-028. |
| `desire` | Stays. Already in `READ_KINDS`. |
| `gift` | Cut, and stays cut. Too interpretive. |

**`domain / self / God` is the genuinely new and underrated part.** Subject *kinds*,
orthogonal to `subjects.origin`. Domain is writer-supplied via the `##` heading
(D-005), God-names are matchable, self is the remainder — all cheap, none of it a
verdict, and it unlocks a question no surface can ask today: *how do I write when I'm
writing about God, versus about myself?*

> **The marking vocabulary should get smaller. The subject vocabulary should get
> bigger.** Every rejected kind above was the same instinct — name what the writer
> felt — and each fails identically. The legal version is already in the engine:
> don't label it, point at their sentence. `verbatimOnly`.

---

## The final model

### Order 1 — markings: what the writer *did* in this span

Verbatim. If you cannot highlight it, it is not one.

| Kind | What it is | Subject |
|---|---|---|
| `prayer` | addressed to God — an observable speech act | optional |
| `sense` | prophetic sensing — what the writer received | **never required** |
| `sentiment` | the writer's feeling toward something | **required** |
| `desire` | what the writer wants | optional |
| `learned` | what the writer concluded | optional |

Five. Cut and staying cut: `gift` (too interpretive), `struggle` (a sentiment word),
`story` (an order-3 episode).

### Order 2 — subjects: what the movement is *about*

Persist across pages, clickable. Two independent columns:

- **`origin`** — how it was derived: `name` · `matter` · `both` · `word` *(exists)*
- **`kind`** — what sort of thing it is: `person` · `domain` · `self` · `God` ·
  `scripture` *(new — the whiteboard's bracket)*

`domain` is writer-supplied via the `##` heading (D-005). `God` is name-matched and
**never normalised** — `Father` and `Shepherd` are separate subjects. `scripture`
comes from `parseReferences`.

### Order 3 — patterns: what only exists across movements

`growth` · episodes · refrain · silence · recurrence. **The read must never emit
these.** If it requires comparing two movements, it is not a marking.

---

## Reverse-engineering: what this model actually builds

| # | Move | Needs | Supplied? |
|---|---|---|---|
| 1 | Silence about a subject | subject + date | ✅ |
| 2 | Episodes / stepping stones | dates; writer names them | ✅ |
| 3 | Images of God over eras | `subject.kind = God` + date, un-normalised | ✅ |
| 4 | The ledger | `prayer`/`desire` + subject + date | ✅ |
| 5 | Unique outcomes | `co-occur` + `contradict` over subject × marking | ✅ |
| 6 | Return to what moved you | a saliency signal | ✅ *(new — sentiment/sense)* |
| 7 | Consolation/desolation sequence | sentiment over time | ⚠️ sequence yes; **toward/away no** |
| 8 | Action vs. consciousness | marking-kind ratios | ✅ |
| 9 | The refrain | verbatim n-gram index over raw text | ❌ separate index |
| 10 | Dialogue | page retrieval | ❌ pure UI |

**Six fully, one partial, three outside the model — and of those three, two need no
model at all.** The refrain wants a word index; dialogue wants a button. Neither is
blocked by anything here.

Two things the model deliberately cannot do:

- **The toward/away direction on move 7.** Ignatian consolation is *directional*, and
  deciding whether a feeling drew someone toward God is a characterisation of their
  interior. The sequence is ours; the direction is the writer's, declared or absent.
- **Anything needing a second page inside the read.** Order-3 rule, already in the
  engine.

**Move 5 is where the sentiment/sense split pays off hardest.** *"subject = brother,
sentiment = resentful, 34 times — and here are the 3 times you wrote about him
tenderly"* is the single most director-like thing the app could do, and it is only
reachable because sentiment carries a required subject.

---

## Cadence

Every tradition binds a question to an interval, and asking the annual question weekly
is malpractice. Examen is **daily**, class meeting **weekly**, direction **monthly**,
rule of life **annual**.

| Interval | What belongs there |
|---|---|
| Daily | nothing at all |
| Weekly | the refrain |
| Monthly | return to what moved you |
| Seasonal | episodes |
| Annual | stepping stones, images of God |

---

## Order of work

1. **Run the position backfill.** One command. Nothing else is real without it.
2. **Subject + time surfaces** — silence, episodes, images of God, the ledger. No
   model, nothing to gate, and they earn the trust needed to spend later on
   interpretation.
3. **The join** — behind the number, framed as retrieval-with-a-question rather than
   a labelled claim.
4. **Markings shrink** to what is observable; everything interior stays a verbatim
   span the writer can see rather than a label the engine assigns.

---

## Open

- **D-027 (The Keeping) is not in DECISIONS.md.** It is referenced in
  `docs/THE_KEEPING.md` but never logged. D-028 above assumes 027 is taken.
- GLOSSARY:107–109 needs amending for D-028. Nothing else does.

---

## Sources

Ignatian: [discernment of spirits](https://www.ignatianspirituality.com/making-good-decisions/discernment-of-spirits/) ·
[Ignatian spirituality in direction (LCSD)](https://www.lcsd.org.uk/blog/ignatian-spirituality) ·
[supervision examen](https://estherhizsa.com/2015/02/05/supervision-examen-an-ignatian-reflection-for-spiritual-directors/) ·
[spiritual direction verbatim](https://www.soulshepherding.org/spiritual-direction-verbatim/) ·
[four pillars of director formation](https://www.catholicspiritualdirectors.com/post/the-four-pillars-of-formation-of-spiritual-directors)

Journal method: [Progoff Intensive Journal](https://en.wikipedia.org/wiki/Intensive_journal_method) ·
[Progoff introduction](https://www.u.arizona.edu/~wrightr/Progoff.htm) ·
[writing a spiritual autobiography](https://www.friendsjournal.org/the-arc-of-your-soul/)

Other traditions: [Wesley's class meeting](https://www.umc.org/en/content/hows-your-spiritual-life-the-class-meeting-for-today) ·
[Clean Language questions](https://cleanchange.co.uk/clean-language-questions-of-david-grove/) ·
[narrative therapy unique outcomes](https://psychology.town/assessment-counselling-guidance/identifying-leveraging-unique-outcomes-narrative-therapy/) ·
[Pennebaker: language change mediates benefit](https://pmc.ncbi.nlm.nih.gov/articles/PMC4345899/)
