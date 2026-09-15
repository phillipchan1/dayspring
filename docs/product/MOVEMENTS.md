# Movements — the journal reading a life back

> **Status:** Product direction, engine-first. Decided 2026-09-10 in D-029.
> The destination described here is a vision, not a commitment to ship every
> surface at once. The first gate is whether the entry-reading engine can be
> measured and made trustworthy.

## The promise

**Dayspring helps a Christian notice how their heart has moved through the life
they actually wrote down.**

It remembers and arranges evidence. The writer discerns what that evidence means.
Dayspring may estimate emotion; it may never infer God's intent, spiritual health,
faithfulness, maturity, obedience, or what the writer should do next.

This is the boundary:

| Dayspring may say | Dayspring may not say |
|---|---|
| "This passage carries grief with high confidence." | "This grief means you were far from God." |
| "Your writing about work became less urgent across these entries." | "You learned to trust God with work." |
| "You explicitly wrote, 'I am learning to wait.'" | "God was teaching you patience." |
| "These six pages form a concentrated episode about the move." | "This was the season God moved you on." |

**Sentiment is an observation about language. Discernment belongs to the writer.**

## Why this is Christian rather than mood tracking

The contemplative traditions create space between attention and conclusion:

- The desert tradition practices watchfulness: notice what repeatedly occupies
  the heart before assenting to an interpretation.
- The Ignatian Examen attends to interior movement, but consolation is not a
  synonym for pleasant emotion and desolation is not a synonym for sadness.
- Lectio returns to the same words and lets meaning deepen through attention
  rather than explanation.
- The dark-night tradition refuses to treat felt darkness as spiritual failure.

Dayspring borrows the posture, not the authority. It recollects, attends, and
returns the writer's evidence. It does not become a spiritual director.

## The seven readings

### 1. What you felt

Estimate the emotion expressed in the writer's language, movement by movement:
valence, activation, and a small vocabulary of recognisable emotions. Preserve
mixed feeling rather than forcing an entry into positive or negative.

Every estimate carries its exact source passage, confidence, and a way for the
writer to say it was wrong. A score may exist in the engine; the product does not
turn it into a grade or equate positive emotion with spiritual progress.

### 2. How the language changed

Place comparable spans beside one another. Show changes in emotional expression
and vocabulary, with the amount of source material visible on both sides.

The app reports the change. It does not name the change healing, decline, growth,
or God's action. An arrow is not a conclusion.

### 3. The stories within it

A story is an episode: related movements concentrated in time, usually around a
subject, with quiet before or after. Code can find that shape; the engine can
identify event-bearing passages; only the writer names the story.

Scripture, prayer, emotion, and learning may sit inside the episode. They are
ingredients of one remembered event, not separate products.

### 4. What you learned

Return explicit learning and change language already present in the entry:
"I realised", "I am learning", "I used to … now …", or equivalent language in
the writer's own register.

One entry can contain **learning** or explicit **change evidence**. Spiritual
growth is a cross-entry interpretation and must not be minted by the entry read.
Later, Dayspring may place evidence from different times beside one another and
invite the writer to name what they see.

### 5. What you desired

Return desire the writer actually expressed: what they wanted, hoped for, wished
for, or longed for. Desire is especially important in contemplative reflection,
but naming its meaning is discernment and remains the writer's work.

The engine may say, "You wrote, 'I want to carry their delight with me.'" It may
not turn stress into a hidden desire for control, infer a vocation, or claim that
one desire is holier than another.

### 6. How you prayed

Preserve words the writer addressed to God: request, thanks, confession, lament,
or simple attention. Distinguish prayer itself from merely writing that prayer
happened. Return the writer's words without assessing whether the prayer was
faithful, answered, or spiritually significant.

### 7. Scripture you carried

Identify explicit Scripture references with the deterministic parser already
used by Dayspring. Scripture is grounded in the characters the writer typed; a
model does not invent or interpret the reference. Later readings may place the
reference beside its movement, subjects, emotion, desire, or prayer.

## The eventual product shape

`Movements` is the candidate primary Return destination. Pages remains the way to
read without interpretation. Ascent, Lamp, and Altar need not remain separate
navigation concepts: their season, Scripture, prayer, and encounter capabilities
can become lenses within one coherent act of returning.

```text
WRITE
  New Page

RETURN
  Pages
  Movements

LIFE MAP
  People · Places · Domains · Matters
```

Do not remove the existing destinations before the unified reading proves that
it preserves their jobs. Consolidate capability first; simplify navigation from
observed use, not from the elegance of this document.

## Pull, push, and tenure

Movements is both available and offered:

1. **Permanent pull:** a destination the writer can enter by life, subject,
   period, story, emotion, or learning. No question must be formulated first.
2. **Ephemeral offer:** after writing is complete, one grounded earlier passage
   may appear because it connects to what was just written. Never in the editor.
3. **Occasional reading:** a weekly, monthly, or seasonal reading may arrive and
   expire. It never accrues into an inbox and never reports that the user is
   behind.

No notification is required for the first version. Nothing waits to be completed.

## From discovery back to writing

A reading may end with one quiet transition: **Write from here.**

The new page is clean. The prompt disappears when writing begins, and intelligence
does not enter the composing path. Source provenance can be retained outside the
markdown so the resulting page can later be understood in context.

Safe invitations are observational:

- What do you notice?
- Which passage still feels true?
- What seems different now?
- Is there a story here you want to name?
- What do you want to remember?

The question opens space; it does not prescribe an answer.

## The engine is the first product

Nothing downstream matters if a single-entry read is unreliable. The first
deliverable is therefore a private playground over real entries, not a customer
surface or a database migration.

For each coherent movement on one page, the engine measures seven signals:

1. **Sentiment** — pleasantness, energy, named emotions, exact supporting words,
   and confidence.
2. **Desire** — something the writer explicitly wants, hopes for, wishes for, or
   longs for.
3. **Story evidence** — a concrete event or episode-bearing passage.
4. **Learning** — something the writer explicitly says they understood or would
   carry forward.
5. **Change evidence** — an explicit before/after claim within the writer's own
   words. Never silently relabelled "growth."
6. **Prayer** — words addressed to God, distinct from writing about prayer.
7. **Scripture** — an explicit reference found deterministically.

Known People, Places, Domains, and Matters are joined to each movement as
structure around these seven signals, including semantic connections that are
not simple proximity. The engine should ultimately produce one read, not a
collection of competing scanners.

### Structural guarantees

- Entry text is loaded server-side for the authenticated owner.
- Every movement and ingredient quote must be an exact substring of that entry.
- Subjects are selected from the writer's known vocabulary; the entry read does
  not create an enduring subject.
- Scores are bounded and carry confidence.
- Mixed or absent emotion is valid.
- A low-confidence result is omitted, not polished into certainty.
- No output contains counsel, diagnosis, divine intent, or spiritual evaluation.
- No entry text or model output is written to logs.

### Evaluation gate

The playground samples up to ten authenticated entries without committing their
text to the repository. The reviewer judges each dimension independently:

- movement boundary
- subject join
- emotional reading
- desire evidence
- story evidence
- learning
- change evidence
- prayer
- Scripture reference

Precision is the first gate because a false claim about someone's heart is more
harmful than a missed one. Do not persist results, trigger reads on save, or build
cross-entry Movements until a stable sample reaches an agreed precision floor and
the errors are understood by category.

## What would change our mind

- Emotional readings repeatedly mistake quoted speech, another person's emotion,
  or mere topic language for the writer's felt experience.
- Subject joins are plausible-sounding but cannot be made consistently correct.
- Reviewers cannot distinguish an emotional estimate from a spiritual verdict in
  the proposed presentation.
- The engine requires so many corrections that returning becomes maintenance.
- Users experience surfaced emotion as surveillance rather than recognition.

If the engine fails, keep the existing literal vocabulary reading. Do not hide a
weak read behind better prose.
