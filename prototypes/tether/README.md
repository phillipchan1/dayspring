# Drawn lines

`index.html` is static with no build step. Run `npx -y serve -l 5213 prototypes/tether`,
or use the launch config `tether-proto`. **Fill an example** loads a finished
SOAP so you can go straight to the close.

**The idea (Phil, Sept 26):** while you write a movement of a scripture ritual,
drag across a phrase in the passage. It lands in your answer as a quote, and a
thin line ties the words in the passage to the quote. At the close you see every
line you drew, one tone per movement.

Built on the facing leaf that shipped in `7ff701a` (`prototypes/passage`).

| Scene | Shows |
|---|---|
| `#walk` | Drag, then **Reflect on this** (or ↵), and the quote lands at the caret. Lines for this movement only; earlier highlights stay as an underline. The bar compares *Always · On hover · Numbers, no lines*. |
| `#weave` | The close: every line, one tone per movement, legend to isolate one. Two movements drawing from the same words deepen the highlight. |
| `#phone` | No room for lines, so it's a round trip: tap a quote and the passage opens at it. |
| `#edges` | Edge cases: reordering, choosing words, editing, the passage, seeing it. |
| `#touch` | The downstream sweep: every reader of a page, and what a quoted verse does to it. |
| `#decide` | Open calls and cost. |

**Also here:** **Open Reading** (Practice toggle in scenes 1–2). A scripture ritual with no framework: Read, then one open page. The hover preview: resting on a word underlines it and shows a margin bracket; dragging shows a dashed ghost of the quote where it will land. A card on an existing highlight says where you quoted it and what you wrote. The grip reorders quotes.

**One visual finding:** a line from the end of a highlight cut straight
across the passage text. It now leaves from a bracket in the leaf's right
margin that spans the highlighted lines, so it never crosses words.

**No new storage:** a quote is `> phrase (v. N)` in the answer, the same
markdown as Lectio's caught word. Highlights are derived by matching that
text in the passage, so deleting the quote removes its highlight.

Verse text is WEB (public domain), from bible-api.com, never model memory.
