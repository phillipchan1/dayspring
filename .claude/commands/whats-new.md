---
description: Draft a What's new announcement (First Light) for a major release
---

Draft the What's new announcement for: **$ARGUMENTS**

"What's new" is the user-facing name. **First Light** is the internal name (folder
`src/features/firstlight/`, `?__preview=firstlight`) — never put it in copy.

Read first, all of it:
- `src/features/firstlight/releases.ts` — the header holds the rules (gate, copy
  discipline, VOICE AND SHAPE). That header is the single source; follow it.
- `docs/product/BRANDSCRIPT.md` and `docs/product/PRINCIPLES.md` — words we never use.
- The commits and diff for the release, so every sentence is true of what shipped.

Then:
1. Write the release into **`DRAFTS`** in `releases.ts` — never straight into
   `RELEASES` (that stamps new accounts as having seen it before it exists). Use an
   id like `2026-10-topic`, `major: true`, and a `land` / `landLabel` that opens the
   surface where the thing lives.
2. Shape: card 1 pitches with a picture and says what the reader **can now do**
   ("You can now…"); a later card gives the **numbered steps** to start, if there is
   a sequence; the last card holds the details. Kickers name the topic, never
   "What changed" / "Also new". Max 3 cards, 3 paragraphs each.
3. If card 1 needs a picture that does not exist, add a `CardArt` kind: an inline
   SVG in `FirstLight.tsx` (`Art`) styled in `FirstLight.css` from theme tokens
   only. Draw it from the real surface; bars for words, no scripture or journal text.
4. `npm run typecheck` and `npx vitest run src/features/firstlight`. The tests
   enforce the shape for every release from 2026-10 on.
5. Preview: `npm run dev`, then `?__preview=firstlight&draft=1` (any palette).
   Share a screenshot or an Artifact copy with Phil before promoting.
6. Report what you drafted and the promotion steps below. Do not promote yourself.

**Promotion (Phil's call, per CLAUDE.md "Shipping to beta"):** move the entry from
`DRAFTS` to `RELEASES` in the same commit that makes the feature visible to
everyone, then merge `master` into `stable`. The Resend Broadcast email goes out
after the stable build finishes and apps have auto-updated, never before.

**Voice, in one line:** say what the reader can now do; don't celebrate, count what
they wrote, or sell them anything — they already paid.
