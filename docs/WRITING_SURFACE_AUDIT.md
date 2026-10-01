# The writing surface audit

A repeatable way to find the bugs that make writing feel unreliable, and the
record of the first run.

The editor is the one surface in Dayspring where a bug is not an inconvenience.
Everywhere else a glitch costs a moment; here it costs the sentence someone was
in the middle of. Principle 3 — *the editor is sacred* — is usually read as "add
no latency, add no chrome". This audit reads it as a second obligation: **the
surface must behave the same way twice.**

---

## 1. The frame

Seven surfaces, four questions each. The questions are the point: they are
chosen so that a *class* of bug shows up, rather than the one instance someone
happened to hit this morning.

### The surfaces

| # | Surface | What lives there |
|---|---|---|
| S1 | **Text input** | typing, autocorrect, dictation, IME, undo/redo |
| S2 | **Cursor** | where the caret is, where it goes, whether there is exactly one |
| S3 | **Selection** | drag-select, word/line select, handles, the format bar |
| S4 | **Pointing** | taps and clicks: the `+`, markings, checkboxes, photos, links |
| S5 | **Formatting** | keymap, format bar, slash palette, command toolbar |
| S6 | **Context menu** | right-click, long-press, the system callout |
| S7 | **Viewport** | scrolling, the keyboard inset, typewriter centring |

### The four questions

**Q1 — Input parity.** Does this behave identically for a mouse, a finger, a
Pencil, and a hardware keyboard? *Any handler that speaks only one input
language is a bug, whether or not anyone has hit it yet.*

**Q2 — Idempotence.** Can this gesture fire twice? Can it leave something on
screen if it is interrupted half-way?

**Q3 — Interruption safety.** What happens when the gesture is cancelled — the
system claims it, the keyboard rises, the app is backgrounded, the pointer is
released outside the window?

**Q4 — State authority.** Is the source of truth the document, or a DOM class /
module variable / ref that can drift out of step with it?

### How to run it

For each surface, read every event handler that serves it and answer the four
questions from the code. Grep is the entry point:

```bash
# S4/S6 — every pointing handler in the editor
rg "mousedown|mouseup|click|contextmenu|pointer|touch" src/editor --type ts

# Q1 — anything that decides behaviour from the device instead of the gesture
rg "userAgent|maxTouchPoints|pointer: coarse|isIOSTauri|:hover" src

# Q4 — module-level mutable state in an extension
rg "^let |^var " src/editor
```

Three greps, and the second one is the one that finds the most. **Asking what
the device is, instead of what just happened, is the single largest source of
bugs on this surface** — see §3.

---

## 2. First run — 19 Sep 2026

Prompted by a morning of writing on an iPad. Baseline before the run: 1,677
tests passing, typecheck clean — i.e. every bug below was invisible to CI,
which is the other thing this audit is for.

| # | Surface | Q | Finding | Status |
|---|---|---|---|---|
| F1 | S4 | Q1 | `+` gutter, markings, scripture blocks and task checkboxes were all bound to `mousedown`, which a finger does not send | **fixed** |
| F2 | S4 | Q2 | Those same handlers re-fired on WebKit's compatibility replay, against a document the first firing had already changed | **fixed** |
| F3 | S7 | Q1 | Typewriter's "don't scroll while dragging" guard listened for `mousedown`, so it was dead on touch: selecting text scrolled the page away from the words being selected | **fixed** |
| F4 | S7 | Q3 | The same guard listened for `mouseup` on the editor. A press released *outside* it left the flag stuck on, and typewriter scrolling stopped for the rest of the session | **fixed** |
| F5 | S2 | Q3 | CodeMirror's `dropCursor()` draws on any `dragover` and only comes down on a clean `dragend`/`dragleave`/`drop` — events WebKit declines to send for a gesture it abandoned. The stranded bar was the "two cursors, neither moves" report | **fixed** |
| F6 | S4 | Q4 | `attachmentDropExtension`'s `dragDepth` was a module global shared by every mounted editor, and only ever decremented by `dragleave` — one missing event left the surface tinted permanently | **fixed** |
| F7 | S4 | Q1 | The `+` was hidden below 768px, so the iPad kept an *invisible* 22px target in the gutter — exactly where a thumb reaches to put the caret at the start of a line | **fixed** |
| F8 | S4 | Q1 | Sticky `:hover` inverted the gutter rules on iPad: a tap latched `:hover` on `.cm-content`, hiding the caret-line `+` and leaving a second one beside the tapped line | **fixed** |
| F9 | S5 | Q1 | Same, in focus mode: a tap near a scripture block or ritual prompt left it burning at full strength over a dimmed page — the precise inversion of what focus mode is for | **fixed** |
| F10 | S5/S6 | Q1 | Four dismiss-on-outside-press handlers (link popover, command popover, You menu, font picker) listened for `mousedown`, so a tap that WebKit routed to text selection never closed them | **fixed** |
| F11 | S7 | Q2 | `.cm-line { transition: opacity 160ms }` animates every line on every caret move between paragraphs, with no `prefers-reduced-motion` escape | **fixed** |
| F12 | S3 | Q1 | The selection format bar competes with the iOS system callout rather than composing with it | open — see §4 |
| F13 | S5 | Q2 | `SlashPalette` carries its own ghost-click timers and `touchstart`/`touchend` pairing, predating `editorTap` | open — see §4 |
| F14 | S1 | Q4 | A remote body that lands while the editor holds unsaved local text is silently dropped (`initialDoc` seeding only fills an empty editor) | open — see §4 |

---

## 3. The rule the fixes are built on

> **Ask the event what pressed it, not the device what it is.**

Every one of F1–F4 and F7–F10 is the same mistake: code deciding how to behave
from a *device capability* — the user agent, `navigator.maxTouchPoints`,
`(pointer: coarse)`, `max-width` — when what it needed was a property of the
gesture that just happened.

Capability questions get the iPad wrong in both directions. An iPad with a
Magic Keyboard reports `pointer: fine` while its owner goes on writing with a
finger. Chrome's device mode reports `fine` while pretending to be a phone.
Neither tells you what touched the glass a moment ago.

`PointerEvent.pointerType` does, on every device, every time. So:

- **`src/editor/pointerInput.ts`** is now the editor's one input primitive.
  `editorTap({ claims, onTap })` resolves a press from any pointer into exactly
  one tap — cancelling on movement (a scroll), on a long hold (the system's
  callout gesture), and on `pointercancel`; firing on press for a mouse and on
  release for a finger; and swallowing the compatibility replay of a touch it
  already served. It is registered at `Prec.highest`, so the claim lands before
  CodeMirror moves the caret.
- **Hover is a capability, and it is asked about with `@media (hover: hover)`.**
  A control revealed by hovering cannot exist on a device that cannot hover;
  `:hover` there means "where the last tap landed" and latches until the next.
- **Drop feedback is owned, not borrowed.** `attachmentDropExtension` draws its
  own insertion bar in place of CodeMirror's `dropCursor()`, because the bug was
  never the drawing — it was the lifetime. The bar is taken down by whichever of
  five things happens first: drop, dragend, the last dragleave, the next press,
  or a watchdog that fires when `dragover` simply stops arriving. No single
  missing event can strand it.
- **A photo is the only draggable thing in this editor.** Stated once, for every
  platform, rather than as an iOS workaround: text here is written and selected,
  not carried around.

None of this is a platform exception, which is the whole point. There is no
`if (isIOS)` in any of it.

## 4. Deliberately not fixed

**F12 — the format bar and the system callout (S3).** On iOS the selection
callout (Cut / Copy / Paste / Look Up) and Dayspring's format bar are two
floating bars answering for the same selection. The bar already reimplements
part of the callout to compensate. Composing them properly is a design decision
about what the selection means on a touch device, not a bug fix, and it is not a
thing to change in the week of a launch.

**F13 — `SlashPalette`'s own touch handling.** It works today, and its
workarounds are documented where they sit. It should move onto `editorTap`, but
it is a React sheet rather than a CodeMirror extension, so the move is a
refactor of a working surface rather than a fix to a broken one. Next pass.

**F14 — remote body versus unsaved local text.** `Editor.tsx` only seeds a
late-arriving body into an *empty* editor, which is the right instinct (never
fight live typing) reached by the wrong test — it silently prefers whichever
side happened to be non-empty. A real answer needs a merge policy, and that is
a sync decision, not an editor one.

## 5. Second run — 1 Oct 2026: the craft pass

The first run asked whether the surface *behaves* the same way twice. This one
asks whether it is *set* well: type, rhythm, alignment, and every marking, at
one line and at a hundred. Different method, too: it was run against the real
app in a browser (guest mode, `npm run dev`), with a fixture entry carrying
every construct, measured line box by line box in the DOM, in Dawn and Ink, at
1440, 1100 and 390 wide, in and out of focus mode. Reading the CSS would not
have found most of these; the numbers did.

| # | Finding | Measured | Status |
|---|---|---|---|
| C1 | List items didn't hang: a wrapped bullet, number or task fell back to the left margin, under the marker | continuation `text-indent` 0 on every list line | **fixed** — `listLayout.ts` |
| C2 | Bullets were the raw `-` in faint grey; nested levels only 2 spaces (~6px) deeper | — | **fixed** — drawn bullets (solid / hollow / square), one 1.5em column per level |
| C3 | Task lines showed `-` *and* a checkbox | — | **fixed** — the dash is hidden on task lines |
| C4 | Quotes showed `>` and had no rule; the only signal was italic in placeholder grey; a long quote wrapped under the `>` | — | **fixed** — `>` concealed (heading reveal rule), 2px rule, ink-softened italic |
| C5 | `---` rendered 145px tall and collapsed to 41px when the caret touched it | `.cm-hr` was `display:block`; CodeMirror's widget buffers opened a phantom line box either side | **fixed** — exactly one line tall, so revealing the dashes moves nothing |
| C6 | Text was guillotined mid-glyph 4rem under the header while scrolling (and 2.5rem above the bottom) | scroller top 118px, header bottom 54px | **fixed** — that space now lives inside the scroller; first line opens in the same place |
| C7 | h3 set a *taller* line box than the h2 above it | h2 40px, h3 46px | **fixed** — headings lead like headings; air above, not below |
| C8 | Italic was purple (pink in Compline); list numbers teal | `--md-emphasis`, `--md-list` — One Dark token colours | **fixed** — italic and numbers in the writer's ink; reading view matched |
| C9 | Link underline full-strength, through the descenders | — | **fixed** — 1px hairline at 0.2em, 45% |
| C10 | Enter on an empty nested item pushed a blank line holding a lone space and stayed put; Enter-twice never left the list | reproduced on the pre-change build | **fixed** — `nonTightLists: false` in `tabKeymap.ts`; Enter steps out one level |

### What was decided against

- **Shrinking the blank line between paragraphs.** A full blank line at 1.7
  leading is a generous paragraph gap, and Notion's is tighter. But a short
  blank line has to grow to full height the moment it gets a character, which
  means a 15px hop on the first keystroke of every new paragraph, or, if the
  caret line is exempt, the page breathing in and out as you arrow through it.
  Stable beats tight on this surface.
- **A code chip for `inline code`.** Fence bodies (every marking) are tagged
  `monospace` too, so any box style lands inside every prayer.

### Open, for a product call

- **Phone body size.** The 24px default is per device and the same on a phone,
  where it sets ~30 characters a line, short for comfortable prose (45+ is the
  usual floor). A small-viewport scale on `--editor-font-size` would fix it,
  but it changes what existing phone writers see, and they chose that size (or
  accepted it) deliberately. Not a silent change.
- **Home on a list line** lands before the bullet and shows the raw `-`. Notion
  sends Home to the start of the words. Worth doing alongside headings, which
  behave the same way.

## 6. Third run — 1 Oct 2026: faces, colour, mobile, selection

Same method, wider matrix: all 11 palettes through real settings (voice ×
appearance), all six writing faces as hand-picked overrides, phone width, a
live selection, every highlight and marking on one page, and a WCAG contrast
table computed in the browser for every text role, the selection and all five
highlight washes in every palette.

The colours held up — body text 8.6:1 or better everywhere but Vigil (4.9,
dim by design), highlight washes balanced across hues at 1.3–1.5:1 against the
page with text on them at 6.2+. The faces did not.

| # | Finding | Status |
|---|---|---|
| T1 | The writing-font picker pointed at `--font-serif` / `--font-display`, which every voice repoints: **Serif set JetBrains Mono in Plainsong** and Atkinson in Vigil; **Literary set Archivo** — a sans — in Cloister | **fixed** — fixed `--face-*` tokens; a test asserts no voice block declares one |
| T2 | A hand-picked face inherited the VOICE's size tuning: Mono at a full 24px in Dawn, Serif at 17px in Plainsong. Measured x-heights: Inter and JetBrains Mono sit 22% taller than Newsreader, iA Writer Duo is 50% wider | **fixed** — `EDITOR_FACE_METRICS` (scale + leading per face), applied by `applyEditorFace` unless the face is the voice's own |
| T3 | "Sans" was the system stack — SF, Segoe or DejaVu depending on the machine — and Inter, the bundled sans, shipped without italic or bold | **fixed** — Sans is Inter, with 400 italic, 600, 700, 700 italic |
| T4 | The settings preview set the raw slider number in the raw face, ignoring every scale: it showed Plainsong's mono at 24px while the page wrote at 17 | **fixed** — previews the surface's own computed tokens |
| T5 | Punctuation after any formatting could open the next line: `**bold**, and` broke before the comma. CodeMirror's zero-width `<img>` widget buffers flank every concealed marker, and CSS gives every atomic inline a wrap opportunity | **fixed** — inline-span markers render as `.cm-conceal`; the buffers beside them (never needed: the reveal rule is inclusive) are dropped. 23 orphan widths in a 4px sweep before, 0 of 726 after |
| T6 | Phone: the 24px default set ~28 characters a line on a 390pt screen | **fixed** — `--device-scale: 0.82` under 600px: ~19.7px, ~36–44 characters, slider still relative; margins 16 → 20px |
| T7 | Phone: the touch format bar could only be placed with its right edge off the glass (max width `vw − 16` against a 10px pad each side) | **fixed** |
| T8 | Phone: the docked focus/appearance cluster sat over the prose at 48% opacity on a half-clear ground — the words showed through it | **fixed** — solid and quiet on touch phones |
| T9 | Bold switched ink: `--text-bright` is near-black against Dawn's warm brown | **fixed** — half a step toward bright; weight does the work |
| T10 | Quote, marking and verse each set their words at a different inset from their rule (22.8 / 13.6 / 16px) | **fixed** — one 0.85rem text edge; Sabbath keeps its bare verse |
| T11 | Vigil: selected words were harder to read than unselected ones (3.4:1 vs 4.9) | **fixed** — 4.6:1 |

### Left as they are

- **Mono chrome labels** (bottom tabs, save status) are an app-wide style, 253
  uses deep — a chrome decision, not a writing-surface defect.
- **The selection's hue.** Light palettes select in their own accent, which in
  Dawn sits near the rose highlighter. Distinguishable today (1.47 vs 1.39
  against the page, and selected text is set in `--selection-fg`), but if
  people start confusing a selection with a highlight, this is where to look.

## 7. The editorial layer — 1 Oct 2026

Chosen in the Type Lab prototype (each change on its own switch, both pages
built from the app's real tokens), then built:

| Change | How | Notes |
|---|---|---|
| **Optical sizes** | Dawn's faces as variable fonts (`@fontsource-variable/fraunces`, `/newsreader`, opsz axis) | The statics measure identical to opsz 14 (Fraunces) and 16 (Newsreader): a 43px title was a 14pt text cut enlarged. The other voices already shipped variable or single-cut faces. Statics kept for surfaces that name the family outright. |
| ~~**Balanced titles**~~ | ~~`text-wrap: balance` on title and heading lines~~ | Removed — see below |
| ~~**No lonely last words**~~ | ~~`text-wrap: pretty` on prose lines~~ | Removed — see below |
| **Hanging punctuation** | `hanging-punctuation: first` | WebKit only, i.e. the Mac and iPhone apps |
| **Old-style figures** | `oldstyle-nums` in body; lining in titles, headings, citations, list numbers | Ignored by faces without them; Plainsong keeps tabular |
| **Dateline** | `editor/dateline.ts`, a block widget above line 1; setting on by default | Each voice in its own ornament (themes.css, "The dateline"). Dawn's fading hairline under the title is gone; its sunrise rule sits above the date instead |

**Settling, not reflowing.** Balanced and pretty wrapping re-break a paragraph
as it changes, so applied to the line being typed, a word would hop lines under
the writer's pen. They apply only to lines without `.cm-activeLine`
(`highlightActiveLine()`, painted transparent): a paragraph settles once, as
you move on. Measured: Cloister's title is 624 / 155px while typed, 435 / 343px
after.

**Removed, 1 Oct 2026.** In use, "settles once, as you move on" meant the
paragraph rearranged itself at the exact moment the writer looked at it:
press Return under a paragraph ending in one word, and three words dropped
down to keep it company. Reported as a bug, and it is one — the editor is
sacred, and words already written do not move. Both wraps are gone from the
editor and the reading view (which must break identically). The cost note
below is kept for the record.

**Cost.** Synchronous layout per keystroke in a 33-paragraph entry, settling
on vs off: 1.9–2.0ms median, 2.7–3.0ms p95, both ways. No measurable
difference.

**Not adopted:** "Accent once" (headings in ink).

**Voice carets.** `editor/voiceCaret.ts` draws a cursor-only layer (CodeMirror's
`layer` API, as `drawSelection` draws its cursor) and hides the native caret;
selection stays native. Shape and blink are CSS per voice (themes.css, "The
caret"): Dawn breathes (1.6s), Sabbath breathes slower (2.6s), Vellum is a
1.5px line of ink, Cloister a 1px hairline, Plainsong a one-cell terminal
block, Vigil dim and steady. Every keystroke restarts the blink, so the caret
is solid while you type. Desktop only: on iOS and Android the caret belongs to
the system's text machinery (handles, loupe, autocorrect), so those keep it —
the one deliberate device check on this surface, documented in place. Setting:
Writing → Theme cursor.

**Rituals.** Desktop rituals write in the real editor, so they get all of the
above. The phone's filmstrip writes in a `<textarea>`; it now takes the
writer's leading (was a fixed 1.5), old-style figures, hanging punctuation, and
the voice's caret and selection colours — not the settling wraps, since a
textarea is always the line being written. Also fixed: the editor's 42rem cap,
centred in the slightly wider ritual page, set every answer ~6px right of its
question; they now share an edge.

## 8. Reading = writing — 1 Oct 2026

The rule: **a page reads exactly as it was written.** The same words land on
the same line, at the same height, at the same indent, in every voice, light
and dark, on desktop, tablet and phone. Measured, not eyeballed: a Playwright
pass types a sample into the editor, opens the same page in Pages, and
compares the position of every line of text against the dateline above it
(a structural sample, and a rich one: bold, italics, all five highlights,
underline, link, heading, bullet, task, quote, prayer and scripture blocks).

**Before:** Cloister drifted 116px on the rich sample; every voice drifted
226–315px on a phone. **After:** 0–1px in every voice × mode at 390, 768, 1024 and 1440px (one
documented exception below).

What was different, and is now the same:

| Was | Now |
|---|---|
| Reader paragraphs had their own margins; the editor's gap between blocks is one blank line | `.markdown-body` sets `--block-gap` = one line of the writer's leading; headings, lists, quotes, rules all use it |
| `marked` emitted newlines between tags, and the reader collapsed white space; the editor keeps it (`break-spaces`) | Newlines between tags dropped at render (`dropInterTagNewlines`); the reader sets `white-space: break-spaces` too |
| Task checkboxes were `<input>`s with browser metrics | Drawn boxes (`.read-task__box`), the editor's size and column |
| Lists used the browser's markers and indent | The editor's 1.5em marker column, its drawn bullets (solid / hollow / square), its numbering (decimal → alpha → roman) |
| Highlights had a margin the editor's didn't | Same −0.02em bleed on both |
| Scripture citation: the editor's face vs the theme's | Both from `--font-label` and the voice's label tracking and case |
| Reader date: small mono caps, its own size | The editor's dateline — same ornament per voice, same size, one rule in global.css for both |
| Reader margin was fluid (`clamp(1rem, 3vw, 2rem)`); the editor's is fixed | `--read-gutter` = the editor's own: 1.5rem, 1.25rem below 768px. 8px of extra measure on a phone and 2px on a tablet were each enough to re-break a paragraph |
| Vellum's ¶ before headings sat in flow on the reader only (27px) | Hangs in the margin on both surfaces; off on phones on both, where a 20pt margin can't hold it |

**Sizes are one system.** Each voice sets `--voice-scale`; `--voice-text-size`
is the writer's size × voice × device. Everything set beside the writing
derives from it rather than from fixed rems, so switching voices keeps the
proportions: the ritual's passage reads at 0.80× the writing and its question
at 1.07×, in every voice (Plainsong's 0.78 scale had been shrinking the
writing under a fixed-size passage). The scripture pane follows the face.

**Every voice reads at one size.** Apparent size measured as √(x-height ×
cap height), at the default 24px: Dawn 14.6; Vellum, Cloister, Vigil 13.4–13.5
(92%); Sabbath was 12.4 (85%) and Plainsong 11.1 (76%), and the Advanced
typography faces Mono and Typewriter 76–79%. Plainsong 0.72 → 0.84, Sabbath
1.05 → 1.12, faces Typewriter 0.88 / Mono 0.84 / Sans 0.90 / Readable 0.97.
Everything now sits at 87–94% of Dawn, the band the serif voices already
shared; Mono keeps ~56 characters a line. The ritual's passage beside the
writing was a fixed 1.28rem in every voice (larger than Plainsong's writing);
it is 0.85× the writer's size now, and the phone's pane and strip keep their
old Dawn sizes as ratios.

**The one exception: Vellum's versal.** The reading view opens Vellum with an
illuminated letter; the editor does not (see the note in themes.css — a drop
cap on a contenteditable line is not a safe place for a caret). The float
re-wraps the opening paragraph, so that paragraph — and only it — breaks
differently. With the versal switched off the measurement is 0px.

## 9. Re-running

```bash
npm run typecheck
npm test                       # the whole suite
npx vitest run src/editor      # the writing surface alone
```

`src/editor/pointerInput.test.ts` is the regression net for §3;
`listLayout.test.ts`, `listContinue.test.ts` and `concealMarkers.test.ts` for §5;
`src/lib/editorFace.test.ts` for §6; `dateline.test.ts` (lib and editor) and `voiceCaret.test.ts` for §7; `src/lib/markdown.test.ts` ("read as written") for §8. It drives real
events through a real `EditorView` and asserts on what a handler *below*
`editorTap` sees, so it tests the property that actually matters: nothing
downstream gets a second crack at a gesture already served.

What it cannot do is prove the gesture felt right. The findings above were found
by reading; the fixes still want ten minutes on an actual iPad, ideally with a
Magic Keyboard attached and then removed, since that is the configuration every
capability check gets wrong.
