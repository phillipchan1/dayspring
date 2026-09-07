# Looking

One surface for looking back, and the arrangement follows from what you ask.
Slug `looking`, served at `/looking/`. A click-through for a screen-share, not a
self-guided link.

```bash
npm install && npm run dev     # → localhost:5189/looking/#looking
```

`S` hides the route bar before you share. `#notes` is the facilitator page — open it
before the call, never during it.

## Why there is no scene list any more

The first pass built ten arrangements and put a row of them along the bottom. That row
was the tell: **ten named destinations is a dashboard**, and choosing one before you have
a question is work.

So there is one surface. You put a name and a marking in the bar; the shape of the answer
follows. Three routes exist in total, and two of them are not the product — `leaves` is a
page-layout argument, `notes` is for the facilitator.

## "look for", not "filter"

A filter is something you configure; this is something you do, and the word has to sound
like the act rather than the machinery. At rest the surface is one word. What is *on*
shows beside it, because state you cannot see is worse than a control you can. What is not
on is behind it, in groups that each carry a one-clause gloss — always visible, because a
hint you have to hover for is a hint nobody reads:

Three groups: **subject**, **marking**, **reading**. The group glosses came back out —
they were explaining pills that explain themselves. The only prose left in the sheet is
one line under `reading`, describing the option you actually chose.

### One type rule

The sheet had six type styles arguing with each other — a mono uppercase heading, a serif
italic gloss on the same line, serif pills, sans pills, mono counts, a serif paragraph.
Each was individually defensible and together they read as a ransom note. One rule now,
and it decides every case:

> **Serif is her. Sans is us.**

Her subjects are set in the face the journal is written in. Everything the app says about
them — labels, glosses, counts, marking names — is sans, one size, one weight, differing
only in opacity. **No mono in the sheet at all**: mono is for dates, and a date is a fact
about a page rather than part of a control.

The corollary is **one shape**. Every option is the same pill, whatever it does; what
varies is a hairline (kept) against a dashed line (noticed), and colour once something is
on. Three control shapes in one sheet is the same mistake as six type styles wearing a
different hat.

And the gloss follows the choice: `how to read it` is four plain pills with a single line
underneath describing **the chosen one**. Describing every option is four explanations for
one decision, and it doubles the type in the sheet to do it.

### The toggle, and icons for verbs

`look for` is the opening of a sentence that the chips complete — *look for · Mom · the
prayers*. So it carries no box of its own; an ink-well surfaces under the cursor instead.
A bordered button there would read as machinery sitting on top of her writing.

It leads with a **lens**, drawn with the same thin hand as the marking glyphs rather than
lifted from an icon set — this sits two inches from her own sentences, and a stock
magnifier reads as somebody else's software. The chevron went with it: the amber state
already says the sheet is open, and saying it twice is chrome.

Where a word was a verb the shape already performs, the word is gone: **keep** is a `+`,
**clear** is an `✕`. Both keep their `title` and `aria-label`, because an icon that only
works if you already know it is not an improvement.

### The margin

Markings run down the **right** of every card, in their own narrow column, the way they do
in a Bible. They used to float in the top corner *over* the text — and "on" is doing real
work in Rule 1: a hand printed over a sentence is not a margin, it is a stamp.

A margin is also the honest shape. It is a strip beside the writing that belongs to the
reader rather than the writer, which is exactly what a marking is. It costs the text about
fourteen pixels and buys a card whose hand you can read before you read a word.

With a marking chosen the margin shows only that one — the card is answering a question,
and a second hand beside it is noise.

### On questions

**Removed.** The semantic leg is not something we are ready to build, so it is not on the
surface. `semantics.ts` stays in the tree with its fixture and its verbatim validator,
because D-020's finding — *a vector hit has no word to light*, answered by lighting the
nearest **line** — is worth keeping written down for whenever it comes back.

### Several subjects, and why they union

**Subjects union; markings intersect.** That split is not arbitrary — it is what the words
mean when you say them out loud. *"Mom and David"* means pages about **either**, because
you are naming the people you want to read about. *"Mom and prayers"* means the prayers,
because the second word narrows the first. Intersecting two people on a real archive
returns almost nothing, and an empty screen reads as broken rather than as accurate.

What two subjects buy you that a list cannot: **one band per subject, against the same
months.** Where they overlap is visible without anybody computing an overlap, and where
one is loud while the other is silent is visible too. Still no vertical axis — every cell
is the same size and only its warmth changes.

### The readings work on the whole archive

`reading` used to grey out until you picked a subject, which is exactly how **the words you
used** became impossible to find: you would open the sheet on the wall, see a dead group,
and never learn what was in it.

Every reading now arranges whatever is on screen, subject or no subject. That is also the
*right* scope for the vocabulary comparison — RECALL keeps it **archive-scoped and off
person pages**, so the archive is its home and narrowing it to a person is the argument
still to have.

**One floor, stated on screen.** A word has to appear in more than one entry in its span.
Without it the archive-wide version returns every noun in four years and reads as a word
cloud. The floor is the only legal way to shorten it: *"appears in at least two entries"*
is arithmetic about the text, where *"the most significant thirty"* would be selection —
and selection is significance, and significance is a verdict (D-016). It is also the truer
question: a word said once is a word she used; a word said in two separate sittings is a
word she uses.

`then & now` is not a filter and not a global mode — it is a way of *reading* a thread, so
it sits with the other ways of reading one. Naming the group is what makes that obvious,
and it leaves an honest slot for the arrangements we have not built.

## The results stay in the page view

Earlier passes swapped the wall for a column of sentences the moment you asked a real
question, which meant the surface stopped looking like a journal exactly when it got
interesting. **Everything is cards** — in date order, in two spans, or grouped into
stretches. You are always scanning pages.

What keeps that honest against *the line is the unit of memory* is that each card **leads
with the line that matched**. You get the sentence *and* the page it came from, with its
date — which is what a bare list of lines threw away.

## Four ways to read

- **in order** — every matching page, oldest first. No top eight, ever (D-016).
- **then & now** — two spans of pages, no arrow between them. An arrow is a vertical axis
  laid on its side. The page count for each span stays on screen.
- **close together** — stretches bounded by silence. A story in a journal is not a theme,
  it is an **episode**, and an episode has a shape: a burst of entries with quiet on both
  sides. Pure arithmetic. On Mom: *"5 entries in 59 days, after 10 quiet months"* (the
  diagnosis) and *"3 entries in 14 days"* (the hospital). **Every heading is a count** — a
  title would be a claim about what it was; she supplies the word "story".
- **the words you used** — see below.

## Sentiment, and the only legal form of it

The obvious build is a mood line: score each entry about Mom, plot it, show the curve.
**It is forbidden three times over**, and every one is load-bearing:

- **GUARDRAILS H2** — never infer someone's interior state.
- **Principle 1** — no vertical axis, because a vertical axis implies better and worse. A
  falling curve over a subject called "Mom" reads as *you care less about your mother now*.
- **D-016** — the writer supplies the signal.

**A sentiment *mark* does not rescue it either.** Declared, it would be legal in
principle — but it is `Sense` with a mood attached, and Gift and Absence were just cut for
being kinds nobody could read off the label. Adding a valence kind reintroduces exactly
that, and any arrangement of it over time rebuilds the axis Principle 1 forbids.

What **is** sanctioned is her own vocabulary — GUARDRAILS' approved example is literally
*"'Angry' appears in 7 entries this month."* So `the words you used` shows the words on her
pages about a subject in one span and not the other. **No number beside any word**, ordered
by first appearance, never sorted into good and bad, page count for each span always on
screen.

On Mom, before 2025: *appointment · routine · sharp · worst · scared · calling.* Since:
*laughed · garden · tomatoes · held · hand · child · smaller · afternoon · napped.*

Nobody scored anything and the shift is unmistakable. That is the argument — the reader
draws it, and per RECALL that is *"the most meaningful thing in the product precisely
because the app didn't hand it to them."*

> **Still to argue.** RECALL takes "the words you use here" *off* person pages: on a matter
> it is a portrait of her own interior life; on her husband it reads as a portrait of the
> marriage, and a bad month puts a bad word at the top. The counter is that the words on
> her pages about her mother are about **her** — what she was carrying — and the failure is
> framing rather than fact.

## Subject + marking, in the preview

When both are on, the card has to say two things at once — *this page is about Mom* and
*this is the prayer you made on it* — and saying them in the same channel means they
compete. So they use different ones:

- **the marking is colour** — its own tone on the card's inside edge, its glyph in the corner
- **the subject is the lit word** — inside her own sentence

Neither restates the other, and there is no badge, label or count anywhere on the page.

## Subjects: keeping, dropping, and the first run

The fixture opens with **nothing kept**, because that is the only part anyone has to be
taught. The group opens on what the journal noticed — six names, all correct — with one
sentence saying where they came from and a `keep` on hover. Kept ones carry an `✕` to drop
again.

**Dropping is safe, and that is what makes keeping cheap**: the journal still notices the
name, nothing she wrote changes, and it is one click from kept again. That is what keeps
this from becoming the tag manager SURFACES.md forbids.

**Detection decides which words; code decides the count.** Capitalisation mid-sentence is
what identifies "Mom" as a name — it fires on 7 entries, because the other 10 open a
sentence with it. But the number beside the word is the number of pages the word is *on*,
or the pill says 7 and the page it opens says 17.

## The collision

Put **Mom** in the bar, then **Prayer**.

That intersection is the prayers she prayed about her mother, in order, and nothing in the
product can answer it today. It stays legal because both halves are hers — she wrote the
name, she typed the `/pray` — and code does the intersection. Nothing is inferred at any
point.

Take the marking off and the braid is thirty markings across four years: what she set
apart, highlighted, prayed, told as a story, underlined. Reading down it is the arc.

### One finding worth carrying into the real feature

The first version matched the subject against the **paragraph**, reasoning that a mark in
paragraph six of an entry that mentions Mom in paragraph one is not a mark about Mom.
Sound — and on this corpus it returns **nothing at all** for Mom + Prayer, the most
obviously useful query on the surface.

The reason is **pronouns**. She does not write "Mom" in the sentence she is praying; she
writes *"I keep bringing her and I keep not knowing what to ask for."* Every prayer she
has ever prayed about her mother says **her**. A paragraph-scoped literal match is not
strict, it is blind — and blind precisely on the most intimate lines, because that is
where people stop using names.

The entry is the unit instead. It is also the more honest one: starting a new page is a
gesture *she* made, and paragraph boundaries are ours. **No vocabulary expansion fixes a
pronoun**, which is also the strongest argument in here for the semantic leg existing.

## Subjects: offered, and kept — and why it has to be both

RECALL Act one, mechanism 1.2 — *it offers, you keep* — which it already calls probably
the strongest. Here is the evidence for why the hybrid is not a compromise.

**Detection is by capitalisation in the middle of a sentence.** Not a guess about meaning:
a thing she typed, on purpose, because the word is a name. Arithmetic end to end — no
model, no part-of-speech tagging. On four years it returns exactly **David · Mom · Leo ·
God · Mira · Grandma**, and it is right about every one.

It will never once return *marriage*, or *work*, or *the move*, because she does not
capitalise them, because they are not names.

> **Detection finds people for free and cannot find matters at all.**

So people arrive on their own, and a matter becomes a subject the moment she says so —
type it, press `keep`, from the same field she was already searching in. No settings
screen, no form, no colour picker. Neither half is making up for the other being weak.

Two earlier rules are recorded in `subjects.ts` because they failed instructively: raw
word frequency returns *down, also, used, already, going, without*; restricting to words
inside a marking is no better, because a marking quote is a whole sentence and drags the
same ordinary English along with it.

**Kept subjects order by when they were kept, never by count.** Riverside above Mom at 31
pages to 14 would be the app ranking what someone carries.

## The markings, after the cut

**Gift and Absence were removed on 2026-08-26** — a writer read the labels and did not
know what they meant, and a kind you have to gloss is a kind nobody will type. The six
that remain: **Scripture · Prayer · Sense · Story · Desire · Learned**.

Name the casualty rather than absorbing it: *"when did I feel far from God?"* no longer
has a **declared** answer, and that was the best screen in the last pass — five marks she
made by hand against six pages a machine picked. That argument now runs on **desire**
(three sentences, three years, one wish). The `consolation` arrangement in
[`../recollection/`](../recollection/) cannot survive the cut at all; the idea was sound
and the vocabulary is what failed. `lib.ts` keeps a note where it stood.

In the fixture the existing marks were remapped rather than deleted: gift → story,
absence → sense.

## The semantic leg is a fixture

No model, no network call. Every "near" hit in `semantics.ts` was chosen by hand — we are
testing whether the *shape* is legible, not whether retrieval is any good.

A hand-picked fixture where the clever leg always wins is a sales pitch, so this one is
built to lose in three places: **wrong hits** that render identically to real ones (if
nobody spots them, that is a finding *against* the leg), **literal-only pages** computed
in code from each question's terms so the comparison cannot be rigged, and **one question
it refuses** — *"how did I grow this year?"* returns nothing, on purpose.

D-020 wrote this surface's kill condition on its way out: *"a vector hit has no word to
light."* So a hit here carries **her own sentence that was nearest**, verbatim, and that
is what the page lights instead of a word. The claim stays narrow and checkable.

## Elegance, and where it is deliberately absent

- **The dawn.** One warm radial off-centre at the top. You should not be able to say what
  it is, only notice the top of the screen is warmer.
- **Cards lift.** `translateY(-3px)`, a warm shadow rather than a black one — a neutral
  drop shadow on a dark ground reads as a hole, and a page is not a hole. The date
  brightens to amber; **the writing itself never flickers.**
- **The field is the only thing that glows**, and only on focus, which is what keeps the
  glow meaning something.
- **Modes are type, not chrome** — three words with the live one lit. Borders around each
  would read as three buttons; this reads as a sentence you are in the middle of.
- **A marking's rule thickens on hover** rather than changing colour, because colour would
  restate what the glyph already says.
- `prefers-reduced-motion` removes every transform.

## A page that runs long — `#leaves`

Today a page at reading zoom scrolls inside its own box (`.pg-leaf { block-size: 100%;
overflow-y: auto }`), so you scroll *inside* a page while the wall scrolls behind it. Here
it **continues** onto the next leaf and the date prints on the first leaf only — that
absence is the whole continuation cue. 47 pages become 50 leaves. Flip to `scrolls` to
watch the second scrollbar come back.

> **The rule, and it is checkable:** nothing scrolls except the surface. One
> `overflow-y: auto` outside the exhibit.

The cost, named: the wall's uniform row height is what lets a 3,500-page archive window
cleanly, and a page now occupies a variable *number* of fixed-size leaves. Cheap at
reading zoom specifically, which is where the app version should start.

## Rules every screen holds

- No vertical axis anywhere. **Learned gets a flat notch, never an arrow.**
- Prayers are never a ratio.
- Order by first appearance or by when kept — never by count.
- A line view shows **every** matching line (D-016).
- Nothing on a page but the writer's words, their date, and their markings.
- Nothing accrues; there is no horizon, nothing unread, nothing to be behind on.
- Banned vocabulary: *track, review, insights, score, progress, goal, dashboard,
  analytics, journey, inbox, workflow.*

## Where it fits — `#fit`

**Entries is deleted. Pages replaces it and becomes a Return surface.** The rail holds one
item under Write and four under Return.

### The list is a distance, not a surface

D-018 deleted the entries list on exactly this reasoning. D-022 reversed it **three days
later**, and what fired was narrow: *"browsing for a half-remembered entry becomes
reliably slower."* A row shows ~25 entries a screen; the wall at its densest shows fewer.

D-018's own kill note said what to do about it and nobody did it — *"an argument for a
**list-tight end of the zoom** rather than for a second surface."*

So the list is the far end of the slider: same wall, same `look for`, same chapters, at
**25px rows — 30 a screen at 900px**, measured rather than asserted. Push the slider up and
the same pages become cards, then leaves. Standing right back inside a chapter gives you
that subject's pages as a list, which is what the panel would have had to become.

### The real danger, which is not density

The panel is how you currently get back to what you were writing. Delete it and the wall is
the only way back to your own draft — a **Principle 3** problem wearing a navigation
costume. So the newest page is marked `today` and every row opens to write on a
double-click. **That is the thing to watch, not the density.**

### And the rail gets sharper

Write holds one item. That looks thin and is the correct statement: the thesis is Write vs
Return, writing really is one act, everything else is returning. Pages joins Return on
SURFACES' own argument — the other three *"all interpret… None of them hands back the
archive. This does."*

**Costs:** shortcuts renumber (⌘1 Write, ⌘2 Pages, ⌘3–⌘5 the rest), the open book moves to
Pages, and D-018's ~2,800 lines come off again — this time with the zoom end that was
supposed to replace them.

## The corpus

Anna, 47 entries, 2023–2026 — from [`../recollection/`](../recollection/), which took it
from [`../recall/`](../recall/). Same woman, same voice.

Both fixtures are verbatim-gated on load: `validateMarkings()` and `validateSemantics()`
log loudly if any quote stops being a substring of the paragraph it claims. **A clean
console is the check.**

## Related

- `docs/product/RECALL.md` — the four acts, tenure, the contemplative mechanisms
- `DECISIONS.md` — D-016, D-019, D-020, D-022
- `src/features/pages/` — the real wall: `PageCard.tsx`, `pageExcerpt.ts`, `subjects.ts`
