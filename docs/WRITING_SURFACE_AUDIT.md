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

## 5. Re-running

```bash
npm run typecheck
npm test                       # the whole suite
npx vitest run src/editor      # the writing surface alone
```

`src/editor/pointerInput.test.ts` is the regression net for §3. It drives real
events through a real `EditorView` and asserts on what a handler *below*
`editorTap` sees, so it tests the property that actually matters: nothing
downstream gets a second crack at a gesture already served.

What it cannot do is prove the gesture felt right. The findings above were found
by reading; the fixes still want ten minutes on an actual iPad, ideally with a
Magic Keyboard attached and then removed, since that is the configuration every
capability check gets wrong.
