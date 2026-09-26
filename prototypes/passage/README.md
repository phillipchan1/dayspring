# The passage: scripture-centric rituals

`index.html` is a static, clickable walkthrough with no build step. Run
`npx -y serve -l 5212 prototypes/passage`, or use the launch config
`passage-proto`. State lives in localStorage, so what you choose and write in one
scene carries into the others. **Start over** clears it.

**The argument.** Lectio Divina is on the shelf today, and it breaks in a way you
can point at: its first question asks the writer to *type the passage out*, and
then the composer scrolls it away for the three movements that need it.
SOAP, already on the shelf, has the same defect word for word ("Write the
reference, or copy the text…"). Discovery Bible Study has the same shape. All
three run on the frame that already
ships (shelf → rail → one entry per ritual). They need three new things:

| | Moment | What it is |
|---|---|---|
| 1 | **Choose** | A passage finder. It reads references, bare books (Kristi's `Colossians` K2 case), typos and words. It also shows your own history: the next section after your last study, the passages you return to, what you marked lately, and the canon lit by your journal. You choose verses the way you'd underline them, and a section heading chooses a whole story. |
| 0 | **Find** | In the library, a scripture ritual carries a **With Scripture** mark on its card and on its About sheet. A filter chip sits beside the hours rather than among them, and search answers to scripture/bible/passage/verse/study. The preview says "Begins with a passage you choose." |
| 2 | **Keep** | The passage stays in view while you write. **A · Facing (Phil picked this, Sept 26)**: the same rail, widened into the open Bible. It keeps the rail's anatomy (back link, name, intention, dotted path, About · Delete, "Saved…"), animates wider when you Begin, and fades everything but the passage while you type. **Examen (compare)** in the bar shows the rail it grew from. **B · Above**: the passage heads the page and folds to a strip while you type (the phone's shape). **C · Beside**: today's parts only, the rail plus the floating `ChapterPane`. |
| 3 | **Let it act** | Movement kinds. `read` (the passage *is* the answer), `mark` (catch a word by click or drag), `carry` (the caught word stays lit), `dwell` (the text fades to the word, with nothing to write), `cite` (a verse number quotes that verse into the answer). A `retell` kind that blurred the passage was cut on Sept 26 because Phil found it confusing. |

Scenes: `#intro` · `#library` · `#find` · `#walk` (practice, layout and own-Bible toggles in
the bar) · `#phone` · `#edge` · `#record`.

## Practices

- **Lectio Divina** keeps its four real labels. Kinds: `read · mark · carry · dwell`.
- **SOAP** is already on the shelf, with its real copy. Kinds: `read · cite · — · —`.
- **Discovery Bible Study** is new. Movements: Read · What it says · About God ·
  About us · I will · Who to tell. Kinds: `read · — · cite · cite · — · —`.

## Edge cases (all on `#edge`)

The rule that settles most of them: **a ritual has one passage, and it lives in
the first movement.**

- `/scripture` inside an answer opens a scoped palette. Quoting a verse from the
  ritual's own passage writes a plain quoted line with `(v. N)`, not a second
  fence. A passage from elsewhere is an ordinary cross-reference fence inside the
  answer, and it never replaces the passage on the leaf.
- Changing the passage after writing is allowed behind one plain confirm. Answers
  are kept, and the caught word goes dark if the new passage doesn't contain it.
- Two passages means a cross-reference, or a second ritual page.
- A passage that's too long gets a soft line and is never blocked. The only hard
  ceiling is one chapter, which is also the D-024 licence shape.
- A paper Bible means reference only, and the writer types the caught word. It
  still lights the Scripture surface.
- Offline: use `offlinePassages` if it has the passage, otherwise reference-only;
  the words are filled in from ESV on the next sync.
- Typos and non-books, pasted verses, same passage as last time, resuming,
  opening from the wall or sidebar (the Sept 23 ritual-shape trap), Contemplatio
  storing nothing, and the phone having no `/`.

## Record: no format change

`ritual:name` + `ritual:section` exactly as today. The passage is an ordinary
`dayspring-scripture` fence as movement one's answer, so the Scripture surface
captures it for free. The caught word is a `> quote` line at the head of
Meditate. A quoted verse is `“…” (v. N)`. `isRitualComplete` skips `dwell`.

## Decisions for Phil (also on `#record`)

1. ~~Facing or Above~~. Facing, picked by Phil on Sept 26. Above remains the phone's shape.
2. SOAP and DBS side by side. They overlap; the lean is to ship both and let `ritual_finished` tell.
3. "Where you left off" in DBS. Keep it to one row, the next section, with no
   book progress, because anything more is a reading plan (a VISION non-goal).
4. Showing last week's "I will". The lean is no for v1 (Principle 2); ask in
   interviews.
5. Store the caught word as a `>` line or as a real marking. The lean is the
   `>` line.
6. Crossway: no new exposure beyond ChapterPane. The commercial question is
   unchanged, and it gets louder with D-030.

## What's invented

The verse text is the **World English Bible** (public domain), fetched from
bible-api.com on 2026-09-26. It is never model memory (GUARDRAILS H3), and the
app would serve ESV. The section headings are plain descriptions written for
this prototype. The history (Sept 12 Lectio, Sept 19 Discovery, the lit canon,
"marked lately") is invented, and no real archive is loaded.

Related: `prototypes/walk` (the Lectio-only `kind` proposal this widens),
`prototypes/desk` (the rail), `prototypes/ritual-entry` (one entry, one ritual),
`docs/product/SCRIPTURE.md` (D-024, the Crossway limits).
