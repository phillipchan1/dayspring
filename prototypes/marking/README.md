# Marking Scripture — prototype

**Start:** `/marking/#intro`

A phrase inside a scripture block cannot be marked today. Not by decision — the
block renders as an atomic CodeMirror replace widget with `user-select: none`
(`src/editor/spiritualBlockDecoration.ts:226`), and marks refuse to paint inside
one (`src/editor/markDecoration.ts:47`). So the refusal is invisible: every drag
across a verse is swallowed and logged nowhere.

This walkthrough proposes one rule — **the citation is the door, the words are
text** — and lets you feel it on both pointer types before any of it is built.

| Screen | Shows |
|---|---|
| `#intro` | What it is and what's being asked |
| `#today` | Control — the block as it ships, with a counter for refused selections |
| `#mark` | Proposed — cursor split, drag / long-press to select, one-button bar, chapter pane |
| `#back` | A marked phrase on Pages, carrying its reference |
| `#take` | The three questions |

Deliberately one self-contained `index.html` and no bundler: what it has to
demonstrate is a browser selection gesture, and a React tree between the finger
and the DOM selection is the one thing that could make the demo lie.

Chapter text is public-domain WEB standing in for ESV, matching
[`prototypes/scripture/src/corpus.ts`](../scripture/src/corpus.ts) — never model
memory (GUARDRAILS H3).

```bash
cd prototypes/marking && npm run dev   # http://localhost:5173
```

Background: [`docs/product/SCRIPTURE.md`](../../docs/product/SCRIPTURE.md) ·
D-016 (marking is the writer's signal) · D-024 (tap opens the chapter) ·
D-026 (scripture excluded from marking kinds).
