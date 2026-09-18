# The walk

```bash
npm install && npm run dev      # http://localhost:5173/walk/#intro
```

Six screens arguing one thing: **thirteen practices on the shelf, one shape** —
and the shape has started contradicting the practices it carries.

## The finding that started it

`RitualComposer.tsx:395-425` renders every movement of every ritual identically:
an amber label, an italic question, one `<textarea>`. The library varies the
*words*; nothing varies the *form*. Three live consequences:

- **Lectio Divina** opens by asking the writer to *type the passage out*
  (`practicesData.ts` — "Write the passage, then the word that found you…"), and
  movements 2–4 all need that passage, which the composer has swiped off screen.
  Lectio is re-reading. The surface reads once.
- **The Morning Offering**'s own tips say *"read your own dump back before
  answering the second — the answer is usually already in it."* On movement two,
  movement one is hidden. The practice and the surface contradict each other in
  writing.
- **Contemplatio** and Recollection's **Stillness** are movements whose content
  is not writing. They get a cursor, a placeholder, and then count as unanswered.

## The six kinds

The proposal is not thirteen bespoke surfaces. It is one field — `kind` on
`PracticePrompt` — and six values (`src/kinds.ts`):

| Kind | The writer does | Scene |
|---|---|---|
| **Write** | answers the question — today's movement, and the default | — |
| **Bring** | names a passage, or returns to one already marked | `#bring` |
| **Mark** | touches the word that caught them | `#mark` |
| **Carry** | nothing: the movement before is still on screen | `#carry` |
| **Dwell** | nothing at all, for as long as they like | `#dwell` |
| **Walk** | moves through their own domains, passing any of them | `#round` |

`Walk` is not speculative — The Round already resolves its movements from the
Life Map at open time (`PracticeDynamic`, `practicesData.ts:62`). This is that
idea generalised to the other five.

## Every scene is two columns

Left is what ships today; right is the proposal. A sketch drawn on its own is
asking to be liked. Drawn beside the thing it replaces, it can be turned down for
a reason.

On a phone the columns stack **proposal first** — the thing being argued for
should not be the thing below the fold.

## The check on the whole thing

`#shapes` is the last screen for a reason: **five of the thirteen live practices
take no new kind at all**, and they are greyed on purpose. A vocabulary of six
kinds is only safe if most practices decline it. The Daily Examen is four
questions asked in order — giving it a mechanism would be an interface enjoying
itself.

## What is invented, and what is not

Practice names and movement labels are read off the real
`src/editor/practices/practicesData.ts`, so the shelf screen argues about the
actual library. Everything a writer "wrote" is invented
(`src/data/sketch.ts`) — a shape can be judged on invented words, so unlike the
`rituals` prototype this one loads no real archive and needs nothing gitignored.

The passage is Matthew 11:28–29, WEB (public domain). The live app fetches ESV
through `api/spiritual/scripture-chapter.ts`, which is already wired and already
licensed — **Bring needs no new backend**, only a new movement kind.

## The falsifier

If drop-off is flat across movement index, the shape is not what is losing
people and this is decoration. `track('ritual_finished')` already reports
`{movements, answered}` — adding the index the writer stopped at answers it
before any of this gets built.

## Its other half

`prototypes/rituals` is the return — what a practice looks like when it comes
back to you. Shape without return is a prettier one-way street; return without
shape is a well-lit surface nobody finished walking.
