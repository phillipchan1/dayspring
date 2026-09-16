# The ritual thread

```bash
npm install && npm run dev      # http://localhost:5190/rituals/#intro
```

Five screens arguing one thing: **rituals are the only surface in Dayspring that
never comes back to you.**

## The finding that started it

Grepping the live app: nothing in `api/` knows what a ritual is. The Keeping,
echoes, declared, altar and concordance all read a ritual's answers as
undifferentiated prose. The only ritual-awareness downstream is a Pages filter
chip (`facets.ts:37`) and a name list on a card (`pageExcerpt.ts:34`), both
page-grained. `track('ritual_begun')` in `JournalScreen.tsx:794` is the only
ritual event in the product — there is no completion event and no return event.

Meanwhile the entry itself already carries `<!-- ritual:name:… -->` and
`<!-- ritual:section:… -->` on every movement. It is the most structured writing
in the archive and nothing reads it.

## The screens

| Hash | What it is |
|---|---|
| `#intro` | The argument |
| `#shelf` | Practices you have walked — the door that does not exist today |
| `#thread` | One practice, one movement at a time |
| `#one` | **The payoff.** One question, everything you ever answered to it |
| `#inside` | The riskier variant — the same return, inside the composer |
| `#prefer` | Which half is worth building |

## The toggle, and why it is on every screen

Top right of every data screen switches the archive:

- **A writer's five months** — invented, in `src/data/archive.ts`. Every word made
  up, written unevenly on purpose.
- **Phil's real archive** — `src/data/real.local.json` — gitignored, generated from the live
  database.

The real one holds **twelve ritual blocks across 2,994 entries**: 23 movements
answered, 22 left blank, and the deepest single movement has four answers of
which two are `Ihoijio` and `Dnd`. That is not a rendering problem the prototype
should hide — it is the actual decision. A reading surface with nothing to read
is not worth building, however good it looks on invented data.

Regenerate it any time:

```bash
npx tsx --tsconfig tsconfig.app.json scripts/ritual-threads-extract.ts --owner <you> --out prototypes/rituals/src/data/real.local.json
```

That script calls the app's own `parseRitualBlocks`, so what it extracts is
exactly what the real surface would have to render. It reads the database and
writes nothing to it.

## Constraints baked into the build

**No counts, no streaks, no gaps.** `MORNING_RITUALS_PLAN` §5.3 wrote this down
before anyone built it: a row reflecting how often you practise is one design
review away from a frequency, and a frequency here is a streak (Principle 2).
The shelf orders by last walked and shows names. `SHOW_COUNTS` in `model.ts` is a
permanently-false constant rather than a setting, and `walks` is carried through
the data model without ever being rendered.

A date on one answer is a fact about a page. A number over a column is a verdict
about a person.

**Nothing is computed.** No model call, no summary, no "you keep saying the same
thing". The reader does the noticing. That is why this surface cannot
hallucinate — there is nothing on it the writer did not type.

**Ties break toward shorter answers.** In the invented archive "Everything" and
"What matters" are both answered eighteen times, but eighteen brain dumps is a
wall and eighteen one-liners is a thread. Depth alone does not make a movement
worth threading.

## Cost, if it ships

`parseRitualBlocks` already returns `{name, labels, texts}` from raw markdown and
Pages already holds the entries in memory. No migration, no endpoint, no model —
a parse and a group-by, client-side.

## Privacy

`real.local.json` is gitignored and loaded via `import.meta.glob`, which resolves
to nothing when the file is absent instead of failing the build. This matters:
`prototypes/scripts/build-all.mjs` builds every prototype whose status is not
`archived` and publishes it to prototypes.usedayspring.app, and `listed: false`
only hides it from the hub index — the URL is still public. So the real archive
never leaves the machine that extracted it, and on any other machine the toggle
is greyed out.
