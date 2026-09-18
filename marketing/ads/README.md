# Ad creative

Meta/Facebook ad images, generated. The campaign thinking — test structure, blockers,
policy risk — lives in [`docs/product/PAID_SOCIAL.md`](../../docs/product/PAID_SOCIAL.md);
this file is just how to drive it.

```bash
node marketing/ads/render.mjs                 # everything → out/
node marketing/ads/render.mjs --only b1       # one concept, while iterating
node marketing/ads/render.mjs --format 1x1    # one canvas
node marketing/ads/render.mjs --copy-only     # regenerate the copy sheet, skip images
```

Nothing to install. It drives the Chrome already on this Mac and loads the brand faces
from `fonts/`, so exported PNGs carry real Fraunces instead of a fallback serif.

## Two kinds of creative in here

**The nine concepts** (`a1`…`d2`) are headline-led posters: the words own the frame,
a small proof card sits under them. They vary the *message*.

**The five recipe frames** (`r1`…`r5`) own the whole canvas — a photo plate, or a
full-bleed editor — and vary the *form*. They set `layout`, which routes them to
`buildRecipe()` in `template.mjs` instead of the poster builder. See
[`docs/product/PAID_SOCIAL.md` §8](../../docs/product/PAID_SOCIAL.md) for why, and for
the confound to avoid when you put them in an ad set together.

R1, R2 and R5 want a photograph. With none on disk they render their `photoBrief` as
a dashed direction plate — see [`photos/README.md`](photos/README.md).

## Adding a variant

Add an entry to `variants.mjs` and re-run. That file is the only place copy lives —
both the image and `out/CREATIVE_SHEET.md` are generated from it, which is what stops
a headline being changed in one place and not the other.

Two rules worth knowing before you write one:

- **Line breaks are hand-set.** `<br>` in `head` is deliberate; the display size is too
  large to trust to auto-wrap. `<em>` marks the dawn-italic accent phrase.
- **Describe the product, not the viewer's faith.** Meta's personal-attributes policy
  reliably rejects second-person religious copy. See the note on `d1b-refusals-safe`.

## Things that will bite

**Overflow clips silently.** A concept with a long headline, a sub, and a tall proof
fragment can outgrow its canvas; the layout has a minimum gap so it clips at the footer
rule rather than colliding with the wordmark, but nothing errors. Look at
`out/CONTACT_SHEET.png` after every run — that's what it's for.

**Chrome never exits.** In both headless modes it writes the PNG and then sits there,
so `render.mjs` waits on the *file* and kills the process. That's why a run is two
minutes and not forty. If a run is interrupted, the next one rebuilds `.tmp/` from
scratch to clear the profile lock.

**No offer on the art.** The footer carries a soft CTA, never a price and never the
trial. An offer in a PNG cannot be scrubbed later — it is in the asset. See
`PAID_SOCIAL.md` §9.

**No screenshots of the app, ever.** Every product fragment here is hand-built in the
site's visual language — the same choice `site/` already made. It keeps the creative
from drifting out of sync with whatever theme a user runs, and it means no real journal
content can end up in a public asset. Sample content is fabricated.

One exception worth knowing: the slash palette in the recipe frames copies its labels
and hints **verbatim** from `src/editor/slashCommands.ts`, because that card is the
claim the ad makes. If that file changes, the ad is lying. It drops the badge column
(two of the four badges are colour emoji, which at ad scale become the loudest object
in the frame) — leaving a column out is a fidelity trade; inventing one would not be.
