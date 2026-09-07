# Markings

A click-through for a screen-share, not a self-guided link. Slug `recollection`,
served at `/recollection/`.

**The question:** what does it feel like to *open* the journal, and what does the eye
catch when you scan it? (`docs/product/RECALL.md` asks the neighbouring one — how you get
one subject back across time — and has its own prototype at `../recall/`.)

**The idea:** *markings* is the one word for every way a writer puts their own touch on
their own words. Most of them already exist under other names.

| Family | Members |
|---|---|
| **Declared** — you named the act | scripture · prayer · sense (shipped as `dayspring-*` fences) · **story · learned · desire** (new) |
| **Touch** — you emphasised the words | mark · highlight (5 hues) · underline · quote |

## Running it

```bash
npm install && npm run dev
```

Opens at `http://localhost:5173/recollection/#margin`.

Keys **1–9** switch scenes, **S** hides the scene bar before you share a screen,
**?** opens the facilitator notes. Open `#notes` *before* the call, not during it —
and `#tenure` too. Both carry product names, so neither goes on the share.

Ten arrangements is too many for one call. `#tenure` is where to pick four.

| key | scene | what it is |
|---|---|---|
| 1 | `#quiet` | blank warm field, to open a call on |
| 2 | `#marking` | the gesture — the palette, and the margin filling as you mark |
| 3 | `#pencil` | what it looks like mid-writing: the app proposing, in pencil |
| 4 | `#margin` | the open page, markings down the side like a Bible's |
| 5 | `#edge` | the closed book from the fore-edge; touch a kind and the rest goes quiet |
| 6 | `#wall` | the archive; cards lead with what you marked (toggle to compare) |
| 7 | `#register` | the front of the book — Judy's index sticker, kept by the machine |
| 8 | `#after` | a marking is never shown alone; it sits beside the next one |
| 9 | `#episodes` | bursts bounded by silence, stated as counts |
| 0 | `#sitdown` | the twice-a-year read, paced, ending on a blank page |
| m | `#moment` | marks of different kinds that landed close together |
| g | `#returning` | the same thing said again, at several dates |
| l | `#liturgy` | a fixed order you move through, ending in a blank page |
| c | `#comesto` | the null hypothesis — no destination; it finds you |
| w | `#word` | one line, and the whole screen |
| a | `#again` | the same line, served a second time |
| b | `#consolation` | where He seemed far, and the last thing she called a gift |
| o | `#around` | an occasion that came back — three variants |
| v | `#words` | the words she uses now, against the words she used then |
| q | `#asked` | every question she wrote, with its dates |
| , | `#settings` | the opt-in — off by default, and two shapes of consent |
| t | `#tenure` | **facilitator only** — every arrangement compared |

## What the noticing buys

Coverage, and coverage is what makes a review possible at all. D-016 measured the real
archive: emphasis in 16% of entries, blockquotes in 4%. A weekly review built only from
what someone marked unprompted is empty most weeks. Noticing raises the coverage; keeping
is what leaves every item writer-supplied.

That closes a loop the product does not have today:
**it notices → you keep → the review is made of what you kept → the review is worth
opening → you keep more.** D-016's own line was that nobody bolds a sentence for
significance when nothing reads it back. The ten arrangements below are what read it back.

## Looking back — ten arrangements

Each is a different answer to *what do you arrange marks by*, not a visual variation. The
version they replaced grouped by kind, which is a filing decision: it put a verse, a prayer
and a learning from the same eleven days into three separate sections.

**Standing, or an occasion.** The material is standing; the occasion is time-based.
`#moment` and `#returning` carry **no horizon control at all** — a thing carried for two
years does not belong inside a week, and nothing here should be something you can be behind
on. Only `#liturgy` has one, because a liturgy has an occasion. That split is why there is
no "you missed last week's review", which would be guilt.

- **`#moment`** — marks of *different kinds* close together. Declared kinds only, spanning
  more than one day, ≥3 kinds inside 21 days. The line down the left is drawn to the real
  number of days. Every heading is a count; a title would be a claim about what it was.
- **`#returning`** — the same thing at several dates. Matching is anchored to the earliest
  mark, one row per page, every row the same size, and the repeated words are lit so it
  shows its work.
- **`#liturgy`** — the Examen's order, one movement at a time: what you were given · what
  you brought · what you noticed · where He seemed far · what you asked · silence · a page.
- **`#comesto`** — no destination. An entry just closed, a hairline, and one earlier mark.
  The app says nothing.

### Six more, from what the contemplative tradition actually asks for

The first four are all *selections*, computed fresh each time you arrive, and all four are
lists. That is software's instinct rather than the tradition's, and these six are what the
tradition asks for instead.

- **`#word`** — one line, and the whole screen. The desert's own unit of memory is a single
  saying: a monk asks an elder for a word and carries the answer for years. Not a shorter
  result — one sentence, and nothing else to look at. The way on is delayed on purpose,
  because a next control available immediately makes it a slideshow. *Falsified if* the
  first thing they do is hunt for more.
- **`#again`** — the same line, served a second time. The Exercises do not advance to new
  material; the second and third contemplations repeat the first, and lectio chews one line
  (*ruminatio*). Nothing else here re-serves anything. The line is **derived** — `#comesto`'s
  own rule, run at the day `#comesto` is set on, which returns the same line — so this is
  the app's real behaviour and not a story about it. **Walk `c` immediately before `a`.**
  Inverted against `#comesto`: the old line on top, the day it arrived underneath, because
  one is something arriving and the other is something returning. *Falsified if* "I have
  seen this" is a complaint rather than a recognition.
- **`#consolation`** — where He seemed far, and the last thing she called a gift. Ignatius
  tells the person in desolation to remember that the consolation was real; that instruction
  is addressed to precisely the one person who cannot carry it out, because finding it means
  paging back through a year, which is the reread both interviews refuse. Both ends are
  declared and the app writes nothing between them. **Deliberately one-way** — Rule 10 runs
  the other direction too and we are not building it, because an app raising a shadow while
  she is glad is not the same act as a director doing it. **Two of the five absences have no
  gift before them**, and the honest render is the absence alone. *Falsified if* it reads as
  a consolation prize, which is counsel.
- **`#around`** — an occasion, and what she wrote the last time it came around. The
  tradition's answer to *when* is a calendar that returns, not a review you owe: Advent
  arrives whether or not you were faithful, and then it leaves. Three variants, because the
  argument is what the occasion belongs to — *this day* (±7 days, names no season, needs
  nobody's permission) · *this season* (Advent, Lent, Eastertide; opt-in, because GUARDRAILS
  forbids assuming a practice, and blank most of the year, which is a property not a bug) ·
  *where she has been before* (no calendar at all; sparse, and left sparse). Move the anchor
  to watch each one fire and not fire.
- **`#words`** — the words she uses now, against the words she used then. The growth
  question with no axis in it, and the only thing here that can answer Kristi's "I'm doing
  the same thing this year that I was last year" without rendering a verdict. Sanctioned by
  GUARDRAILS' own example. **No number beside any word** and the order is first appearance,
  because a frequency ranking would turn order into significance. **The entry count for each
  span is on screen**: measured on this corpus, two years against the two before gives 59
  started and 9 stopped, which is not a change in how she writes — it is 36 entries against
  11, and an uneven comparison reads as a verdict on the thinner side.
- **`#asked`** — every question she wrote, with its dates. **This one is an argument, not a
  recommendation.** The arithmetic is clean and the shape is the risk: a question asked four
  times across two years and never again has a visible last date, and a reader supplies the
  word "answered" — right when she supplies it, forbidden when the app does. So nothing says
  *answered*, *resolved* or *no longer*, and the groups are never separated by whether she
  is still asking.

## Tenure — the axis that decides things

The open question was framed as *a place you go, or a thing that arrives*. That is not the
load-bearing axis. **Tenure** is: how long a page exists, and whether it can pile up while
she is not looking.

| Tenure | Property | Guilt risk |
|---|---|---|
| **Permanent** | always there, same shape, grows | none — nothing waits |
| **Occasional** | exists because of a date, **gone when it passes** | none *if it expires* |
| **Ephemeral** | appears once beside something she just did, stored nowhere | none — cannot be a backlog |
| ~~Pending~~ | waits for her, accrues | this is the inbox |

> **The rule: no occasion may accrue.** A weekly page that is gone on Monday is a liturgy.
> The same page still sitting there in March is a chore about somebody's prayer life, and no
> amount of gentle copy fixes that.

`#liturgy` is the one arrangement here with a horizon in it, which makes it the only one
that can rot into *pending*. The full table is on `#tenure`.

## Two kinds a spiritual director would add

- **Gift** — the Examen opens with gratitude, and every other kind is effortful or interior.
- **Absence** — where He seemed far. Its glyph is a line with a **gap** in it, never an X.
  Declared only; never counted, never trended, never shown against Gift as a proportion.

Deliberately cut: a *rule of life / resolve* (that is a habit tracker — VISION says never),
and *consolation/desolation as a scored axis* (Principle 1 forbids it).

## Pencil and ink

A marking the writer made is in **ink**. One the app proposes is in **pencil** — graphite,
dashed, and *not a marking yet*: it carries no weight, appears in no count, and reaches no
other surface until it is kept. Keeping is the writer supplying the signal, which is what
leaves D-016 standing; **not this** is one tap that costs nothing and says nothing back.

`#pencil` **opens off**, and off is the default the product would ship — what you see
first is the editor exactly as it is today. Everything else on that screen is something a
person went to `#settings` and turned on.

Off-by-default answers **Principle 3** on the principle's own terms: its test is whether a
change touches the editor's render or input path, and a feature nobody enabled does not.
It does *not* answer **D-016** — consenting to be judged is still being judged. The switch
gates *when*; pencil gates *what*; they stack.

`#settings` carries two shapes of consent. A checkbox per kind is control with upkeep, and
upkeep is what killed Judy's index sticker. *Only the kinds you use yourself* is the other:
it may offer a Story because she has marked eleven, and never a Quote because she has
marked none. Nothing to set up, and the permission traces to something she actually did.

The cost, named: Kristi didn't find the slash commands for two or three weeks. Off-by-default
in a settings pane is the safest place to put something and the least findable.

`#pencil` has two axes because both are live arguments:

- **When** — Principle 3 forbids suggestions in the composing surface outright, and
  RECALL Act four says re-entry lands *after* the writing. *As you write* is there to make
  that cost feelable, not because it is allowed.
- **How** — *it offers* is the D-019 shape (propose, and everything proposed can be pulled
  off). *It decides* is the D-016-rejected shape, built so it can be looked at rather than
  argued about. The difference on screen is the presence of two buttons.

## The corpus

Fictional. Anna, 47 entries, 2023–2026 — extended from `../recall/src/corpus.ts` on
purpose, so a follow-up call can walk both without a discontinuity.

Two shapes in it are load-bearing and must not be tidied away:

- **A thin stretch**, March–August 2024: three entries, almost nothing marked. Every
  scene has to stay honest across it. A prototype that only works on a dense corpus is a
  demo of an archive we do not have.
- **A burst**, five entries in fifty-nine days that autumn after ten quiet months. That
  is the shape an episode has, and it is arithmetic.

Every marking quote is a verbatim substring of the paragraph it sits beside.
`validateMarkings()` enforces it on load and logs loudly if it ever stops being true,
because a quote nobody wrote is the failure this whole surface exists to avoid.

## Rules the scenes hold

- No vertical axis anywhere. **Learned gets a flat notch, never an arrow.**
- Prayers are never a ratio.
- Order by when it first appeared, never by count.
- A line view shows *every* matching line — a subset means something selected it, and
  selection is significance.
- Nothing on a page except the writer's words, their date, and their markings.
- Banned vocabulary, and this topic attracts all of it: *track, review, insights, score,
  progress, goal, dashboard, analytics, journey, inbox, workflow.*
