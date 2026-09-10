# The Rituals Library — rebalancing toward the morning

**Status:** proposal, 2026-09-10. Nothing here is built yet.
**Trigger:** the library is browsed but not returned to. The founder — the heaviest
user of every other surface — does not use it, and named why: he journals in the
*morning*, and the library is built for the *evening*.

---

## 1. What the shelf actually holds

Eleven rituals in `src/editor/practices/practicesData.ts`, tagged by `rhythm`:

| Rhythm | Rituals |
|---|---|
| `morning` | Lectio Divina · SOAP · Prayer of Recollection |
| `midday` | Prayer of Recollection · The Examen of Consolation |
| `evening` | The Daily Examen · Wesley's Questions · Emotionally Healthy Examen · The Examen of Consolation |
| `anytime` | Psalmic Lament · Ignatian Discernment · Then vs. Now · Threshold |

Two things fall out of that table, and neither is "there are too many."

**Every morning ritual requires you to already have a Bible passage in hand.**
Lectio and SOAP both open by asking *what passage are you bringing?* The only
morning ritual that doesn't is Prayer of Recollection, which is Teresa of Ávila's
interior descent — a contemplative practice for someone already still. There is
nothing on the shelf for the actual morning case: *I sat down at six with a full
head and I need to get it in order before the day starts.*

**Four of eleven are examens.** The Daily Examen, the Emotionally Healthy Examen,
the Examen of Consolation, and Wesley's Questions are all backward-looking
self-review. That is the redundancy worth pruning — not the library's size.

So the diagnosis is not *too many rituals*. Eleven is a small shelf. It is
**skew**: a library weighted toward reviewing a day that has already happened,
browsed by people who open the app before the day starts.

### What the interviews actually say

Both synthesized Dayspring interviews are in Notion's *Customer Discovery
Interviews* (Judy Yu, 2026-08-12; Kristi Wollbrink, 2026-08-04). Read them before
treating any of this as validated — here is what they do and don't support.

**Supports the morning thesis (indirectly).** Judy runs two notebooks: a free-form
one for processing, and *the Monk Manual for structured weekly reflection and daily
focus*. She wants to "feel grounded day-to-day by clarifying what she's focusing
on." That is a morning, forward-facing, ordering job — and today she leaves
Dayspring to do it. Her strongest recurring ask is to find things **by life area
(kids, marriage)** without manual tagging, which is the Life Map walk in §4 below,
arriving from a second direction.

**Does not yet support it directly.** Neither transcript contains "I journal in
the morning to order my thoughts." That claim is currently Phil's own reading of
conversations not yet written up. It should go into the interview database before
it anchors a roadmap — it is the load-bearing assumption of this whole document.

**Cuts against the instinct to cut.** Kristi is a strong-ICP daily user, and
rituals are specifically what she brags about: *"a new way to engage my heart with
God"*; the synthesis names **Sense/Prayer/Ritual as the shareable wedge** and the
organic referral engine into her spiritual-direction network. The library is not
dead weight because one person doesn't use it. **Prune duplicates; do not shrink
the surface.**

Nothing morning-related is tracked in the Product Feature Backlog — this
duplicates no existing candidate.

---

## 2. Retiring is not deleting — a constraint before any cut

`PRACTICE_BY_NAME` is how a *past entry* renders. An entry written months ago
carries only hidden tokens:

```
<!-- ritual:name:Emotionally Healthy Examen -->
<!-- ritual:section:Feel -->
```

The question above each answer is looked up live, at render time, by
`(practice name, section label)` — `usePracticeInsertion.ts:194` and
`RitualComposer.tsx:324`. Delete a practice from `PRACTICES` and every entry ever
written with it silently loses its questions. The writer's words survive; the
question that produced them does not.

For a product whose promise is showing someone what God has been making of them,
an old entry degrading in place is not an acceptable cost of tidying a menu.

**The fix is one field.** Add `retired?: boolean` to `Practice`. `PRACTICE_BY_NAME`
still contains it, so the archive renders forever; `PracticeLibrary` filters
`!p.retired`, so nobody meets it again.

### The two cuts I can defend

**Emotionally Healthy Examen** (Scazzero). The third examen on a shelf of eleven.
Its distinctive move — trace a feeling down to the belief under it — is real, but
it sits between the Daily Examen (which already opens on awareness) and Wesley's
Questions (which already does uncomfortable interior honesty). Retire.

**Then vs. Now.** The weakest card, for a reason specific to this product: *the
app already does this, better, from real data.* Ascent, the Covenant sky and the
year-in-review compute then-versus-now from the actual archive, grounded, with the
evidence attached. A ritual that asks the writer to hand-produce a worse version of
what the engine produces is the one card that competes with the product. Retire.

**That is only two, and the ask was "a few."** I can't defend a third. Threshold,
Discernment, Lament, Wesley and the two remaining examens are each doing work
nothing else does, and Kristi's interview says the shelf is a referral asset. My
recommendation is prune two and rebalance; overruling that is reasonable, but it
should be a decision made on purpose rather than a tidy-up.

---

## 3. Four rituals for the morning

Drafted in final voice, ready to paste into `practicesData.ts`. Three are static
and shippable as-is. The fourth (§4) needs engineering.

### One new `function`, one new `rhythm`

Every existing function — `examine · encounter · listen · lament · gratitude ·
form` — is *receptive*. You notice, you receive, you review. A morning practice is
usually **generative**: you are putting something in order, not looking back at it.

Add `order` (label **"Order"**). And add `weekly` to `PracticeRhythm` (label
**"Week's turn"**) — the taxonomy claims to be about rhythm, and a weekly practice
is a rhythm the enum currently can't say.

---

### A. The Morning Offering — *the flagship*

This is the one that answers the job. Movements one and two **are** the ordering:
empty the head, then read it back and find the thing that actually matters. Three
and four are what keep it a prayer rather than a task list.

```
name:      'The Morning Offering'
function:  'order'
rhythm:    ['morning']
origin:    'Ignatius of Loyola, 16th century — the Suscipe'
tradition: 'Ignatian'
quote:     'Empty your head onto the page. Then find the one thing that matters.'
intention: 'For the morning you sit down carrying everything at once. Put it all
            down first, then find what today is actually for.'
why:       'Ignatius ended the Spiritual Exercises with the Suscipe — take, Lord,
            and receive my memory, my understanding, my whole will. This is that
            prayer with the working-out left in: you cannot offer a day you have
            not yet looked at. Getting the noise onto the page is not a productivity
            step; it is what makes an honest offering possible.'
shape:     'Four movements, front-loaded. A long first one — everything you are
            carrying, unordered — then three short turns that sort it: what matters,
            what is not yours, what you are handing over.'
tips:      - 'Do the first movement badly on purpose. Fragments, lists, half-sentences.'
           - 'Read your own dump back before answering the second — the answer is
              usually already in it.'
           - 'If nothing feels offerable, offer the day as it is. That counts.'

movements:
  Everything    — 'Put down everything you are carrying into today. No order, no
                   editing, nothing left out because it seems small.'
                   ↳ 'Just empty it out…'
  What matters  — 'Read back what you just wrote. What is the one thing today is
                   actually for?'
                   ↳ 'Out of all of that, this…'
  Not yours     — 'What in that list is not yours to carry? Name it, and set it down.'
                   ↳ 'I am not going to carry…'
  Offering      — 'Take, Lord, and receive. What are you offering God for today?'
                   ↳ 'I offer you…'
```

**The risk, stated plainly:** movement one is a brain dump, and brain dumps live
next door to "Not a note-taking / PKM app" (VISION § What Dayspring is not). What
keeps this on our side of the line is that the dump is never the artifact — it
exists to be read back and offered. If we ever ship it with movements three and
four trimmed for brevity, it becomes a to-do list with a cross on it. Don't.

---

### B. New Every Morning — *gratitude, before the day is judged*

The morning gratitude ritual. Not a lighter Examen: the Examen of Consolation
thanks God for a day that already happened, and this thanks God for one that
hasn't. They are complements, and both should stay.

```
name:      'New Every Morning'
function:  'gratitude'
rhythm:    ['morning']
origin:    'The Hebrew morning blessings — Talmudic, with Lamentations 3'
tradition: 'Hebrew'
quote:     'You are awake, and the day is given. Start there.'
intention: 'The oldest morning practice there is: thanks before anything else —
            before the news, before the list, before you have decided how the day
            is going.'
why:       'The Birkot HaShachar bless what nobody notices — opening your eyes,
            standing up straight, the ground being there when your foot lands. They
            are said at the very start of the day, on purpose, because gratitude
            offered before the day is evaluated is a different act from gratitude
            offered after it has gone well. Lamentations says the mercies are new
            every morning; this is the practice of looking for the new ones.'
shape:     'Three short movements, and short is the point — this should take three
            minutes. Thanks for being here, thanks for something ordinary, and one
            named instance of faithfulness.'
tips:      - 'Do it before you look at your phone, if you can.'
           - 'The ordinary things count most — that is the whole tradition here.'
           - 'One named thing beats a long list. Specific, not comprehensive.'

movements:
  Awake         — 'Before anything else — you are here, and today was given to you.
                   What is the first thing you can thank God for?'
                   ↳ 'Thank you for…'
  The ordinary  — 'What ordinary mercy is already here this morning — something you
                   would have walked straight past?'
                   ↳ 'The small thing already here…'
  Faithfulness  — 'Where has God been faithful lately? Not in general — name one thing.'
                   ↳ 'You were faithful when…'
```

*(Worth noting for the marketing site, not the app: "Dayspring" is Luke 1:78 —
the dayspring from on high has visited us. This is the ritual named after the
product's own verse.)*

---

### C. Luther's Garland — *ordered prayer*

Phil asked for "something for ordering prayer." The obvious answer is **ACTS**
(Adoration, Confession, Thanksgiving, Supplication) and I am deliberately not
proposing it: it is a modern mnemonic with no story behind it, it reads as a form,
and its four beats overlap New Every Morning and the Daily Examen so heavily that
shipping both would recreate exactly the duplication problem this document exists
to fix.

Luther's version is older, stranger and better. In 1535 his barber, Peter, asked
him how to pray; Luther wrote him a letter — *A Simple Way to Pray* — describing
"a good garland of four strands" he wound around any short text, early in the
morning, whenever prayer had gone cold.

```
name:      'Luther’s Garland'
function:  'order'
rhythm:    ['morning', 'anytime']
origin:    'Martin Luther, 1535 — a letter to his barber'
tradition: 'Lutheran'
quote:     'Instruction. Thanksgiving. Confession. Prayer. Wound around one short text.'
intention: 'A way to pray a single verse, a commandment, or one line of the Lord’s
            Prayer — four strands wound around it, in order.'
why:       'Luther wrote this for a barber who asked him how to pray, and it shows:
            it is practical, unmystical, and built for the mornings when prayer has
            gone cold. The order matters — you are taught before you thank, you
            thank before you confess, and you ask last, so that petition sits inside
            gratitude instead of standing in for it.'
shape:     'One short text — a verse, a commandment, a petition — and four strands
            wound around it. Luther’s own instruction: if one strand catches fire,
            stay there and let the others go.'
tips:      - 'Keep the text very short. One line is plenty; Luther used one commandment.'
           - 'If a strand opens up, abandon the rest and stay in it. He said so himself.'
           - 'The order is the discipline: ask last, not first.'

movements:
  The text      — 'What one line are you praying today — a verse, a commandment, a
                   petition of the Lord’s Prayer?'
                   ↳ 'Write the line here…'
  Instruction   — 'What is this line teaching you? Take it as said to you, today.'
                   ↳ 'This is telling me…'
  Thanksgiving  — 'What does this line give you reason to thank God for?'
                   ↳ 'Because of this, thank you for…'
  Confession    — 'What does it show you about yourself? Say it plainly.'
                   ↳ 'It shows me…'
  Prayer        — 'Now ask. What are you asking God for out of this?'
                   ↳ 'So I ask you…'
```

Five movements rather than four, because the text has to be written down before
the strands have anything to wind around.

---

## 4. The Round — the weekly Life Map walk

Phil's idea, and the strongest one here: **walk the domains of your own life, one
at a time, once a week.** Judy's interview arrives at the same place from the
other side — she wants to find and reflect on things *by life area* without
maintaining any tagging system, and the Life Map already holds exactly that list,
built automatically.

This is also the only ritual on the shelf whose movements are **the writer's own
life** rather than a form from the tradition. That is worth a lot, and it is why
it needs real engineering.

```
name:      'The Round'
function:  'order'
rhythm:    ['weekly']
origin:    'The Benedictine Rule of Life, 6th century — adapted'
tradition: 'Benedictine'
quote:     'Your life, one domain at a time. Once around, once a week.'
intention: 'A walk through the domains of your own life — the ones already on your
            Life Map — stopping at each one long enough to say what is true there
            this week.'
why:       'A Rule of Life orders the whole of a life, not only its devotional
            corner: work, household, rest, friendship, the thing you are quietly
            worried about. Most weeks you only ever think about whichever domain is
            loudest. Going around the whole circle is how the quiet ones get heard
            before they become loud ones.'
shape:     'One movement per domain on your Life Map, in the order they first
            appeared in your journal. Nothing to think up — the circle is already
            yours. A domain you have nothing to say about this week is a real
            answer; leave it and move on.'
tips:      - 'Same time each week. The point is the circuit, not the depth.'
           - 'Skip freely. Silence in a domain is information too.'
           - 'If a domain is missing or wrong, fix it in your Life Map — this walks
              whatever is there.'
```

Each movement's question is generated: **"*{Domain}* — what is true here this week?"**

### What has to be built

**1. Movements resolved at begin-time, not from the static table.**
Today `buildPracticeBlock` walks `practice.prompts`, and both renderers look the
question up by `(name, label)`. Add to `Practice`:

```ts
/** Movements come from the writer's own data, not this table. */
dynamic?: { source: 'lifemap-domains'; template: (label: string) => string }
```

`onBegin` resolves the movement list once (from `buildLifeMap(...)`'s `domain`
section, `items` — the current era, in its existing chronological `order()`), and
passes the resolved prompts to `buildPracticeBlock`. Both render paths gain one
fallback: `prompt?.question ?? practice?.dynamic?.template(label) ?? ''`.

**No document-format change, no migration, no schema work.** The tokens written
are the same tokens; only where the question comes from changes.

**2. Order by first-seen, never by page count.** `lifeMap.ts`'s `order()` already
does this, and the reason is written into `kept_subjects`' migration: ranking the
parts of someone's life by how often they appear is a verdict rendered in a sort
(Principle 1, D-016). Use the Life Map's ordering unchanged. Do not sort The
Round's movements by anything else, ever.

**3. Untouched movements must not persist.** This is the one that will bite.
`composeRitualMarkdown` writes a section token for every movement including empty
ones, and `isRitualComplete` then marks the block unfinished, which renders a
**continue** button on the entry — forever. On a four-movement Examen that is a
helpful door back in. On a nine-domain Round that you deliberately walked past
five of, it is a permanent "you didn't finish" badge sitting in the writer's own
journal. **That is a chore counter, in a product whose second principle forbids
exactly this.**

Fix: when the composer *leaves* a dynamic ritual that has at least one written
movement, drop the untouched movements from the block entirely. A domain you had
nothing to say about this week simply isn't in this week's record — which is also
the honest thing for the archive to hold. (A wholly-empty ritual keeps today's
behaviour: it is removed, because scaffolding is not a record.)

**4. No domains yet → say so, don't hide it.** A young journal has no Life Map
domains. Show the card, disabled, reading *"needs a few domains on your Life Map."*
Principle 5 — tell the truth about a surface that needs history rather than
faking a generic four-part life.

**5. Nine pips is a long track.** Untested. The composer's Embla track and pip
spine were built for three-to-five movements. Worth a real check on a phone with
a realistic domain count before shipping — this is the one place The Round could
fail on feel rather than logic.

---

## 5. The library itself — "another level"

The library is eleven cards under **twelve filter chips** in two rows (five
rhythm, seven function). That is more taxonomy than the shelf can carry, and
adding four rituals makes the ratio worse, not better. "Another level" here means
*fewer controls with longer reach*, not more organisation.

**1. Open where the writer already is.** The library has the right instinct
already: opened mid-entry it defaults to Need-based, and says why on screen
(*"Starting from what you've written — the need-based practices come first"*).
Extend the same one line of logic to the clock — before 11am open on **To begin**,
after 5pm on **To close** — with the same honest because-line. This is a state
initialiser and a string. It is the highest-leverage change in this document and
the cheapest, and it is what makes the shelf feel like it knows you without
claiming anything about you.

**2. Add search; delete the function row.** One field, matching name, tradition,
origin, quote and every prompt question. That answers *"I have a decision to
make"* without the writer knowing the word "Ignatian." The `function` label
already sits on every card and becomes searchable text — so the second row of
seven chips comes out. Twelve chips become six plus a search box, and the shelf
reaches further than it did.

**3. What I am not proposing: a "your rituals" row.** Recents, or the ones you
return to, is the obvious next idea and it is a trap. Any row that reflects how
often you practise is one design review away from a frequency, and a frequency in
this product is a streak (Principle 2). If it is ever built, it shows names in the
order last begun and **no counts, no dates, no gaps** — and that constraint should
be written down before anyone starts, not after.

---

## 6. Where this leaves the shelf

Thirteen rituals: eleven, minus two retired, plus four.

| Rhythm | After |
|---|---|
| `morning` | **The Morning Offering** · **New Every Morning** · **Luther's Garland** · Lectio Divina · SOAP · Prayer of Recollection |
| `midday` | Prayer of Recollection · The Examen of Consolation |
| `evening` | The Daily Examen · Wesley's Questions · The Examen of Consolation |
| `weekly` | **The Round** |
| `anytime` | Luther's Garland · Psalmic Lament · Ignatian Discernment · Threshold |

Six morning rituals, three of which need no Bible passage in hand. Two examens
instead of four. And the shelf opens on the right one at 6am without being asked.

## 7. Order of work

1. `retired` flag + retire the two. *Small, and unblocks any future pruning safely.*
2. The three static morning rituals — A, B, C. *Content only; no new mechanics.*
3. Library: open-on-the-clock, search, drop the function row. *Cheapest real win.*
4. The Round. *New `dynamic` field, the drop-untouched-movements fix, the empty
   state, and a phone check on a long track.*

Steps 1–3 are a day. Step 4 is the interesting one, and it is the one that would
make the library something no other journal has.

## 8. What would change our mind

- **The load-bearing assumption is unwritten.** "People journal in the morning to
  order their thoughts" is not in the interview database. Get those conversations
  written up first; if the morning claim doesn't survive contact with the
  transcripts, §3 is four rituals nobody asked for.
- **If The Morning Offering gets used as a task list** — dumps written, movements
  three and four left empty — it is the wrong ritual and we took a PKM feature by
  accident. The `ritual_begun` analytics event can't see this; reading a few of
  our own entries can.
- **If the rebalanced shelf still isn't returned to**, the problem was never the
  contents. It is that a ritual is something you *choose*, and choosing is work at
  6am. The next move after this one is not a fifteenth ritual — it is asking
  whether a morning ritual should be waiting when you open a blank page, rather
  than found in a library.
