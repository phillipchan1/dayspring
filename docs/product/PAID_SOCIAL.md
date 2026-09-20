# Paid social — creative, test structure, and what has to be true first

> **Status:** Draft 2, 2026-09-17. The creative in `marketing/ads/` is built and
> rendered. Nothing here has been spent against. Draft 1 was written after the
> marketing-site audit of 2026-09-15; draft 2 adds the recipe frames (§8) and
> records the offer scrub (§9).

---

## The short version

There are **nine creative concepts across four message tracks**, plus **five recipe
frames** that hold the message and vary the form (§8), rendered to 66 PNGs at Meta's
exact pixel specs, plus a five-card carousel. Everything is generated from one file,
so the image and the ad text can't drift apart.

Three things should be settled before money moves, in this order:

1. **There is no tracking on the marketing site at all.** No pixel, no analytics, no
   conversion events. This is the real blocker — not creative.
2. ~~**The rituals rebalance is on `master`, not `stable`.** Track C promises thirteen
   forms. Production has nine.~~ **Resolved 2026-09-17** — `practicesData.ts` is
   byte-identical on `origin/stable` and `master`: fifteen defined, two retired,
   `SHELF.length === 13` on both. Track C's count is correct as written.
3. **D-001 needs a line in `DECISIONS.md`** — either as a deliberate override of the
   "don't spend yet" gate, or as a decision to run the interviews first.

The argument of this document is that (3) is the *reason to run the campaign* rather
than a reason to delay it — see "This campaign is the D-001 experiment" below.

---

## 1. The blocker nobody has costed yet: you cannot measure this

`site/` has **zero** analytics or tracking code. No Meta pixel, no Vercel Analytics,
no Plausible, nothing. Grep it and see.

That matters more than it sounds, because of the shape of this funnel:

```
Facebook ad  →  usedayspring.app  →  GitHub .dmg download  →  install
             →  desktop app       →  account  →  trial  →  paid
```

The money event happens **inside a Tauri app, days later**, on the other side of a
GitHub redirect. A browser pixel cannot see it. So:

- **Without a pixel:** Meta can only optimize for link clicks, and Rockbot's report
  will rank creative by CTR. CTR is a measure of how arresting the image is. It is a
  poor predictor of trial starts and a actively misleading one for a $7/mo product
  whose value takes months to land (Principle 5 — we deliberately have no day-one wow).
  You would be optimizing for the wrong thing and calling it data.
- **What's actually needed:** a Meta pixel on `site/` for the top of the funnel, plus
  the **Conversions API** firing `StartTrial` and `Purchase` server-side from the
  subscription webhooks that already exist (`docs/SUBSCRIPTIONS.md`), with a click
  identifier carried from the ad through the download into the account record.

That last part is real engineering, not a media task. **Estimate it before booking
spend.** A campaign you can't read is a campaign you'll have to run twice.

An interim, much cheaper option: add the pixel for click-level signal only, and treat
the first flight explicitly as a **creative-and-message test** judged on CTR and
cost-per-landing-page-view, with the honest caveat that it tells you what stops a
thumb, not what converts. That is still worth something for the D-001 question below.

---

## 2. This campaign is the D-001 experiment

`POSITIONING.md` says, in bold: *"Do not spend on acquisition until this is settled."*
The unresolved question is whether Dayspring is **A** ("Obsidian for Christians",
craft-led) or **B** ("the journal that shows you God's faithfulness", emotion-led),
and it says A and B want different front doors.

The doc proposes settling it with interview questions Q4 and Q11 — five interviews,
none of which have happened, and which measure *what people say*.

**A track-split creative test measures what people do, for less money and in a week.**
So the creative is deliberately built so that Track A and Track B are a clean
comparison: same brand system, same landing page, same formats, no offer on any of
them — only the message changes. Whichever track buys a click more cheaply is the first behavioural
signal on D-001 either way.

That reframes the gate. This isn't spending *before* the decision; it's buying the
decision. But it only works if the buy is structured that way, and only if someone
writes the result down.

**Either way, `DECISIONS.md` needs a row** — `PRINCIPLES.md`'s own rule is that
overriding a standing call requires saying so out loud.

One existing data point, from the audit: Kristi Wollbrink's language is devotional and
relational ("a new way to engage my heart with God"), not craft language. That's a
thumb on the scale for B, at n=1.

---

## 3. Two things the creative deliberately does not say

**The Round is not named anywhere, and shouldn't be.** The site audit recommends
giving it its own beat, since it's the most novel idea on the shelf. But The Round's
movements are generated from the writer's **Life Map domains**, and the Life Map is
alpha-gated — the same audit says to keep it out of the campaign. Those two
recommendations conflict, and the code settles it: `src/editor/practices/ritualRound.test.ts`
asserts the ritual "writes nothing but the masthead when there are no domains."

A brand-new signup from an ad who opens The Round gets an empty page. It is the worst
possible first impression of the best idea on the shelf. Track C names **The Daily
Examen, Lectio Divina and Psalmic Lament** instead — all of which work on day one.

**No testimonial is used.** Kristi's quote is the strongest line available to this
campaign and `BRANDSCRIPT.md` is right that a real user's words beat ours. But naming
a real person in a paid ad needs her written permission, and `BRANDSCRIPT.md` is
equally clear that we must not imply social proof we haven't earned. If she consents,
that becomes the strongest Track C creative in the set — ask her.

---

## 4. Meta's personal-attributes policy is a live rejection risk

Meta prohibits ad copy that asserts or implies knowledge of a person's **religion**.
The line is roughly: describing your *product* is fine ("a journal built for the
contemplative practices of the church"); addressing the *viewer's* faith is not
("your walk with God", "as a Christian, you…").

This catches our best line. `d1-refusals` says *"No verdict on your walk with God"* —
a second-person assertion that the viewer has one. Enforcement is inconsistent, and
the downside isn't just a rejected ad; repeated rejections can put a flag on the ad
account.

So the set ships **both**: `d1-refusals` as written, and `d1b-refusals-safe`, which
carries the same idea in product-describing language ("No score at the end of it").
Run them together. If d1 is rejected, the concept is still in the auction.

Check every new headline against this before adding it.

**Second twin, 2026-09-20.** `r3`'s headline was *"Type / in the sentence you are
writing"*, which asks a cold reader to already know what `/` means and spends the
one line on the thing the picture underneath is busy explaining. It now reads
**"Finally, a journal for Christians."** — the category claim, with the palette as
its proof and the gesture moved down to the bridge, where it finally has context.

Naming the audience is normally fine; it describes the product's purpose, not the
reader. *"Finally,"* is the part worth watching, because it leans on *you have been
waiting*, which is a step toward asserting the reader's faith. So `r3b-christian-life-safe`
carries the identical frame with **"a journal for the Christian life"** — the life,
not the person. Run them together. It is insurance, not a seventh test cell; do not
read them against each other as a message test.

---

## 5. What's in the box

Everything lives in `marketing/ads/`:

| File | What it is |
|---|---|
| `variants.mjs` | **The source of truth.** Every concept, headline and line of ad text. |
| `template.mjs` | The brand system, lifted from `site/src/styles/global.css`. |
| `render.mjs` | Renders every concept to PNG via the local Chrome, and writes the copy sheet. |
| `out/*.png` | 66 finished images at Meta's exact specs. |
| `out/CREATIVE_SHEET.md` | Every image paired with its primary text, headline, description and CTA — this is the file Rockbot needs. |
| `out/CONTACT_SHEET.png` | All 66 frames on one page, for review. |

```bash
node marketing/ads/render.mjs
```

No install step — it drives the Chrome already on the machine and loads the brand
fonts from disk, so exported PNGs carry real Fraunces rather than a fallback serif.

### The tracks

| Track | Concepts | Thesis | A win reads as |
|---|---|---|---|
| **A · Craft** | `a1-editor`, `a2-import` | The tool is the draw. | D-001 → A |
| **B · Remembrance** | `b1-archive`, `b2-remembers` | The journal reads your life back. | D-001 → B |
| **C · Practice** | `c1-shelf`, `c2-question` | Contemplative forms in the page. | Kristi's angle validated |
| **D · Refusal** | `d1-refusals`, `d1b-refusals-safe`, `d2-grounded` | What we won't build is the proof. | Differentiation works cold |

### Naming

`DS_<track>_<concept>_<format>_<theme>.png` — e.g. `DS_B_b1-archive_4x5_ink.png`.

The whole test cell is in the filename, so it survives into Meta's reporting and into
whatever spreadsheet comes back. **Never rename a concept id.** Retire it and add a
new one, or last month's numbers stop meaning anything.

Themes are `ink` (the dark brand face) and `dawn` (the parchment one) — a real
variable worth testing, since the two grounds behave very differently against a feed.

---

## 6. How to actually run it

Nine concepts × three formats × two grounds is 53 images, and that is **not** 53
things to test at once. At any budget this product can justify, most cells will never
reach significance — Meta wants roughly 50 conversions per cell per week, and at $7/mo
with a desktop install in the middle, you will not get there. Pretending otherwise is
how ad budgets disappear into noise.

Structure it in two phases:

**Phase 1 — the message test (this is the one that matters).**
One ad set per *track*, equal budget, same audience, same landing page. One format
(`4x5`, the most feed real estate) and one ground (`ink`) so the only difference is
the message. Use Meta's own A/B test tool, which splits the audience rather than
letting the algorithm pick a favourite early. Read it on CTR and cost-per-landing-page-view.
This is the D-001 read.

**Phase 2 — everything else.**
Take the winning track and let the algorithm choose within it: drop all that track's
formats and grounds into one ad set and let delivery sort them. Creative selection
inside a message is exactly what Meta's optimizer is good at. Don't hand-pick.

**One opinion worth arguing with:** `d1-refusals` is the most distinctive creative in
the set and it will probably win on CTR, because "No streaks. No scores." is a
pattern-break in a feed full of the opposite. Be careful about believing it. It
answers an objection a cold viewer hasn't formed yet, and high CTR on a contrarian
hook is the classic way to buy cheap clicks from people who will never convert. It may
be a better retargeting ad than a cold one. Judge it on trial starts — which brings
this back to §1.

---

## 7. Open questions

- **Where does the ad land?** Every creative points at `usedayspring.app`, which sells
  a macOS download. There is no iOS app yet and the web app is not the advertised
  route. That means the addressable audience is Mac owners — a meaningful constraint
  on targeting, and an argument for waiting for TestFlight to graduate.
- **Is `dayspring-eosin.vercel.app` in the funnel at all?** It serves `master`, not
  `stable` (see the note in `CLAUDE.md`, which is out of date on this). Worth deciding
  deliberately before traffic arrives.
- **Nothing here is validated.** `PERSONAS.md` is explicit that the personas are
  hypotheses. This campaign is the cheapest way to start turning some of them into
  findings — provided §1 is solved first.


---

## 8. The recipe frames (R1–R5)

The nine concepts in §5 all share one form: a headline-led poster with a small proof
card beneath it. They vary the *message* and hold the *form* constant. That was the
right way to design a D-001 read, and it leaves the form itself completely untested —
against evidence that is fairly one-sided about which form wins cold:

- **Meta × Kantar × CreativeX (2024).** A visible human face with eye contact is the
  strongest single lever measured. A product integrated *into* the story beats a
  product shown *beside* it (+46%).
- **AppsFlyer (2025).** Screen demos and tutorials out-retain polished testimonials
  on installs and day-7 retention. Transformation/before-after buys clicks and loses
  retention.
- **Brainlabs (46 Meta brand-lift studies).** Lo-fi reads stronger for purchase
  intent; hi-fi product UI reads stronger for awareness. Match finish to funnel.

So `variants.mjs` now also carries five frames that own the whole canvas:

| id | Recipe | Form | Message it carries | Photo needed |
|---|---|---|---|---|
| `r1-practice-face` | R1 | Face top, legible editor bottom 45% | Practice (Track A) | **yes** |
| `r2-notes-graveyard` | R2 | Confession over a selfie-distance frame, small UI inset | Problem-led (Track B) | **yes** |
| `r3-slash-demo` | R3 | Full-bleed editor, one caption | Craft / mechanism (Track A) | no |
| `r4-harvest` | R4 | Ten years of pages above, one season read back below | Remembrance (Track B) | no |
| `r5-table` | R5 | Hands, table, UI peeking. Lo-fi. | Practice (Track C) | **yes** |
| `r6-shelf-open` | R6 | The library, with traditions and centuries | Contemplative depth (Track C) | no |
| `r7-lectio-open` | R7 | Lectio Divina open in the entry, being written into | Contemplative depth (Track C) | no |
| `r7b-lectio-not-watch` | R7 | Identical art; the on-image line is the only change | The wedge vs audio apps | no |

### R6 and R7 — the contemplative frames

Track C was the only interview-backed angle in the set and it had the weakest art:
a list of three names on a poster. R6 and R7 give it the two things the evidence
asks for — a legible product surface, and the mechanism in the story.

- **R6 shows the shelf as the library lists it**, names beside traditions and
  centuries. *Ignatian · 16th century. Benedictine · 6th century. Carmelite · 16th
  century.* To a reader who recognises those words, the specificity is the argument;
  nobody who has prayed the Examen mistakes that card for a devotional app.
- **R7 shows one form actually running** — Lectio Divina's four movements, labels and
  questions verbatim from `practicesData.ts`, with the writer's own words underneath
  the first two and a caret in the second. This is the deepest proof the campaign
  has, because it is the only frame where you can see what using the product *is*.
  It also does the Hallow/Pray differentiation without naming a competitor: those
  apps hand you something to listen to, and this frame visibly hands you something
  to write into.

**`r7` vs `r7b` is the one clean line test in the set.** Same image, same UI, same
footer — `r7` names the form (*"Lectio Divina, in the page you are writing."*), `r7b`
names the difference (*"A form to write into. Not one to watch."*). Whichever wins
tells you whether this audience is bought by recognition or by contrast, and the
answer transfers to every other headline here.

**One line was corrected before render.** *"Thirteen forms the church already had"*
is not true of all thirteen — `Threshold` is adapted from rite-of-passage practice
(tradition `Secular`) and `SOAP` is contemporary. The art now names a span,
*"from Benedict to Wesley"*, which is a claim the data supports. The Round stays
unnamed here as everywhere, for the reason in §3.

**Usage note, and it cuts against this whole angle:** the extractor found twelve
ritual blocks in 2,994 real entries. Rituals are the most distinctive thing on the
shelf and close to the least used thing in the product. That is an argument for
advertising them — a cold audience has never seen it — and simultaneously a warning
that a signup who arrives for rituals may not find the habit on their own. Watch
retention on this track specifically, not just its CTR.

### The confound, stated once so nobody trips on it

A recipe frame changes **form and message at the same time** against any of the nine.
Putting `r1` in an ad set against `a1` and calling the result a message test is
meaningless. The two clean reads are:

- **`r3` vs `r4`** — same form, same finish, same footer. *Message is the only
  variable.* This is the D-001 read, and it is cleaner than the §6 Phase 1 plan
  because both frames are UI-led rather than headline-led.
- **`r3` vs `r1`** — same message family, *form is the only variable*. This is the
  Human Vibe read. It cannot run until R1 has a photograph.

### Phase 1, exact pairing

Two ads, equal budget, same audience, same landing page, `4x5` `ink`, Meta's own A/B
split (not the optimizer).

**Ad A — Practice / mechanism.** `DS_A_r3-slash-demo_4x5_ink.png`
- Primary: *Type a slash in the middle of a sentence. Scripture, Prayer, Sense, Ritual — it opens in the line you are writing, not in another tab. Everything marked that way stays findable years later: every passage you have ever written down, every prayer, gathered by subject. A journal with the practice built into the page.*
- Headline: **Type / in the sentence**
- Description: Scripture, Prayer, Sense, Ritual

**Ad B — History / remembrance.** `DS_B_r4-harvest_4x5_ink.png`
- Primary: *You wrote faithfully. The entries piled up, and nobody ever read them back — including you. Dayspring returns your own history: seasons, prayers and passages, quoted word-for-word from what you actually wrote. Counts and dates are computed in code. If it cannot point at the entry, it says nothing. Bring a decade of journals in and read it as one thing.*
- Headline: **Read yourself becoming**
- Description: Your words, not ours

Both carry CTA *Learn more* and land on `usedayspring.app/start`. `/start` only became
a viable destination for a cold web visitor at `1a10b1c` — before that, someone
without a Google or Apple account hit a sign-in screen with no door.

### The photography gate

R1, R2 and R5 have no photograph, and there is no stock library in this repo. Each
renders its own shot list as a dashed direction plate instead — reviewable
composition, deliberately unshippable art. Drop a file into `marketing/ads/photos/`
and re-run; the frame composites it with no layout work.

**Until that photo exists, R1 is R3 with a hole in it.** The single most-supported
lever in the evidence above is the one thing this repo cannot generate. Booking that
shoot is the highest-leverage creative task on this list, and it is a procurement
decision, not a design one. Never a real person's likeness without a release, and
never stock of someone performing piety — the brief on each variant says what
credible looks like.

---

## 9. The offer came off the art (2026-09-17)

Every one of the 53 original PNGs carried `14 DAYS FREE · THEN $7 A MONTH` burned
into the footer, and nine of the ad-text descriptions repeated it.

The trial is real — `api/profile/ensure.ts` grants 14 days on first sign-in with no
card. But App Review rejected 1.0.767 under **3.1.2(c)** for marketing a free trial
the App Store subscriptions do not carry, `0eb9810` and `1a10b1c` scrubbed it from
the app and the site, and the ad set was the last place still saying it.

An offer burned into a PNG cannot be scrubbed later — it is *in the asset*, in Meta's
library, in whatever deck it has been pasted into. The footer now carries a soft CTA
per concept (`ctaLine`, default *Write today*) and the descriptions say
`$7 a month · Mac and web`.

**Do not put an offer back on the art.** If an offer is ever worth testing, it belongs
in the ad text, where it can be changed without re-rendering and re-uploading.


---

## 10. The vertical read, and the close (2026-09-17)

Phil's note after seeing the first eight frames: make each one read **downward**, so
the last thing the eye lands on is the answer. Every recipe frame now has four beats
in a fixed order, and the wordmark moved from the top of the frame to the bottom —
a logo in first position is a brand poster, and it resolves a question the reader has
not been asked yet.

```
Four journals. None of them finished.        ← the hook       (variant.onImage)
[ the editor, legible ]                      ← the proof      (the UI fragment)
Start with the one that holds.               ← the bridge     (variant.bridge)
☀ Dayspring · A journal for spiritual        ← the answer     (closeBlock)
  transformation                 Mac · iPhone
```

**The art is never instructive** (Phil, 2026-09-20). r3's bridge read *"Type / and it
opens where you are"* — the picture above it already shows the gesture, so the line
was the image narrating itself. Teach mechanics in the ad text, where a reader who
wants them can expand; the frame shows, the bridge resolves. r3's bridge is now
*"Finally, a journal for the Christian life."* and it drops the descriptor
(`descriptor: false`) so the close does not say "a journal for…" twice. That line is
also r6's headline — a different position doing a different job, but the two
creatives now share it, so read their results with that in mind.

`variant.bridge` replaced the old mono `ctaLine`. It is set in body serif, not
uppercase mono, because it is the next sentence in the story rather than a button
label. `DESCRIPTOR` lives in one constant in `template.mjs` — change it there and
every frame follows.

"Spiritual transformation" is within the brandscript: `BRANDSCRIPT.md` §6 is an
*Identity transformation* table, and none of the banned words in §Language rules are
touched. It describes the product, not the reader, so §4's policy line holds too.

### Platforms: Mac and iPhone, not web

The close carries device marks so a cold viewer knows within a second that this is
an app. **Phil's call (2026-09-17): advertise Mac and iPhone, not the web app**, with
iOS on now rather than when the listing goes live — the build is in App Store review
and expected any day.

Two consequences, recorded so they are known rather than discovered:

1. **The ads are ahead of the site.** `site/src/content/site.ts:41` still renders the
   iPhone pill as a non-clickable "Soon", and line 62 reads *"The iPhone app is in
   review. Until then, Dayspring lives on your Mac."* Anyone who lands before approval
   sees an ad promising iPhone and a site saying not yet. **When the listing goes live,
   flip `site.ts` in the same change** — otherwise the site becomes the thing
   understating what ships. If review drags, `PLATFORMS.ios = false` in `template.mjs`
   and a re-render puts it back.
2. **The marks are generic device glyphs, not Apple marks.** The sanctioned Apple
   asset is the "Download on the App Store" badge, which carries its own usage rules
   and would be wrong for the Mac in any case: that app ships as a `.dmg` from GitHub,
   not through the Mac App Store.

The domain came off the art with the offer. The landing URL is on the ad card, and
the bottom third is doing narrative work now — a second call to action would compete
with the answer.


---

## 11. The six, and the words that go beside them (2026-09-17)

Phil picked five frames and added the flagship as the sixth. That is the test set.

| # | Creative | File (4:5) | What it argues |
|---|---|---|---|
| 1 | `f1-flagship` | `assets/flagship/paid-dawn/4x5.png` | The whole product, in the real app |
| 2 | `r3-slash-demo` | `DS_A_r3-slash-demo_4x5_dawn.png` | Scripture, prayer and practice in the line |
| 3 | `r4-harvest` | `DS_B_r4-harvest_4x5_ink.png` | Ten years of journaling, read back |
| 4 | `r2-notes-graveyard` | `DS_B_r2-notes-graveyard_4x5_ink.png` | The journals that stopped |
| 5 | `r7-lectio-open` | `DS_C_r7-lectio-open_4x5_ink.png` | A form running in the page |
| 6 | `r6-shelf-open` | `DS_C_r6-shelf-open_4x5_dawn.png` | **The category claim, earned by thirteen named forms** |

The five ad frames were cut to the flagship's grammar so the six read as one
campaign: headline as a plain lead plus an italic accent line in the dawn colour
(`headline.lead` / `headline.accent` in `flagship.ts`, now `onImage: {lead, accent}`
here), a hairline rule under it, the surface below, the wordmark at the foot.

**The flagship now has the footer too (2026-09-20).** `flagship.ts` grew a
`platforms` flag and a `paid` cut: the same picture and the same words as `write`,
plus the Apple mark and `Mac · iPhone`. Two cuts rather than one changed footer,
because `write` is the site hero and the `og:image` — a reader already on the site
knows it is software, so an Apple mark there is decoration. In a feed it is the
fastest answer to "can I install this?". The flagship still carries no descriptor
line, because its headline already is the category sentence.

**Which line goes where, after 2026-09-20.** *"Finally, a journal for the Christian
life"* lives on `r6`, not `r3`. `r3` wore it for a few hours; the frame that earns
it is the one showing thirteen named practices with their traditions and centuries
printed beside them, and two creatives sharing one headline teach nothing about
either. `r3` names what its own capture column proves instead. The earlier
`r3b-christian-life-safe` twin was retired the same day: with `r6` naming the *life*
rather than the *person*, there is nothing left for §4 to catch on.

### What the research says, and what it changed

| Finding | Source | What it changed here |
|---|---|---|
| ~125 characters show before "See more" on mobile, and most readers never expand. The first line must carry the argument alone. | Vaizle, SocialRails | Every creative now has `primaryShort` as well as `primary`. |
| Meta accepts up to 5 primary texts per ad and sorts them in delivery. | Meta ads guide via ROASPIG | Ship both lengths on every ad rather than choosing. |
| Lead with the outcome, not the setup. | Vaizle | Every short primary opens on the claim. No throat-clearing. |
| Short usually wins for a simple offer; long can win for a product that needs explaining. | ROASPIG | Dayspring is the second kind. Both lengths, and let it decide. |
| Same creative + 3 different hooks = 20-40% CTR variance. | Vaizle | `r7` vs `r7b` is that test, held to one variable. |
| The "it's not X, it's Y" negation pivot is a named AI tell. So is em-dash-heavy formal cadence and openers like "Did you know". | Copy Ads Content | **Rewrote every primary.** The old `r7` opened *"Not a video to watch or audio to follow. A form to write into."* — textbook negation pivot. Em dashes came out of the short copy entirely. |

The voice target is `BRANDSCRIPT.md` §Language rules, not a copywriter's instinct:
warm, plain-spoken, concrete nouns, no sermon. The tell that the new copy is closer
is that the sentences are shorter and the claims are things you could check.

**If anything here gets rewritten later, keep two rules.** Never assert the reader's
faith (§4). Never put the trial, the price or an offer on the art (§9) — the ad text
is the place for terms, where Meta sets them in the reader's own UI.


### r4 failed its own test, and was rebuilt (2026-09-20)

*"Ten years of writing, finally readable"* over a wall of grey bars. Phil: *"it's not
clear that this is a journal, I have to think about it."* That is the <1s test this
whole set is built around, failed by the frame that carries the product's most
distinctive promise.

Two causes. The bars were skeleton lines — at feed size a loading state or a chart,
with nothing in them that said *written pages*. And the headline never used the word
*journal*. Density was the wrong instinct: a phone renders a 1080px ad at roughly
half width, so any wall dense enough to feel like ten years is too small to read.

Rebuilt as `uiArchive`: a window in the same chrome as the editor frames, six dated
entries at a size a phone can read, fading upward into the past, the newest lit. The
entries tell the promise without help — *asked, asked again, waited, and then the
answer*. The headline is now `BRANDSCRIPT.md`'s own tested alternate, verbatim:
**"Ten years of journaling. One story you've never read."**

The general lesson for anything added here: **legibility beats density.** If an
element has to be decoded, it is costing the one second the frame has.
