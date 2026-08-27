# Domains

The headings someone already writes, noticed.

Phil's Saturday practice is a domain reflection: `## personal`, `## faith`,
`## frontier`, `## sce`, `## family` as headings in the entry, so he can look at
the key areas of his life. This prototype asks what it would take for Dayspring
to make that pay — through writing, and through remembering — without becoming a
tag manager, a filing system, or a dashboard.

The whole mechanism is: **a domain exists because someone typed a heading and
wrote under it.** There is no way to create one, in any scene. `src/lib.ts` has
no function that could.

## Run it

```bash
npm --prefix prototypes/domains run dev
```

Or the `domains-proto` config in `.claude/launch.json` (port 5187).

## Scenes

`1`–`7` to jump · `S` hides the scene bar for a screen-share · `?` for
facilitator notes.

| | | |
|---|---|---|
| 1 | `heading` | Typing `##` offers the words you have used before. A completion, not a picker — its job is spelling, not meaning. |
| 2 | `continue` | The last thing you said under this heading, in the margin. Never inserted. |
| 3 | `rounds` | The Saturday sit-down. Your headings, ordered by when you last wrote in each. |
| 4 | `domain` | Every line under one heading, in time. All of it. |
| 5 | `asked` | The same domain, filtered to lines ending in a question mark. No model. |
| 6 | `house` | All of them at once. Two toggles: *someone else* and *scoreboard*. |
| 7 | `rhyme` | The only AI, and the refusal underneath it. |

## The fixture

`src/corpus.ts` is a fictional journal — invented people, nothing that happened.
The domains are Phil's because they are the worked example. `OTHER_ENTRIES` is a
second writer with a completely different set, run through the same derivation,
which is how the house scene shows that no list ships with the app.

`validateDomains()` runs on mount and fails loudly in the console if a heading
has nothing written under it, if entries fall out of order, or if the model's
pick is not a verbatim substring of the entry it points at.
