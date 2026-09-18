# Photo plates

Photographs for the R1 / R2 / R5 recipe frames. Keyed by the `photo` field on
a variant in `variants.mjs` — `photo: 'r1-face'` loads `r1-face.jpg` from here.

**Absent is the normal state.** With no file, the frame renders its `photoBrief`
as a dashed direction plate: reviewable composition, obviously unshippable art.
Drop the file in and re-run `node marketing/ads/render.mjs` — no layout work.

- Shoot or license 4:5 at 2160 × 2700 or larger. The frame crops, it never upscales.
- `.jpg`, `.png` or `.webp`. The basename is the key.
- Object-position is set per layout in `template.mjs` (R1 sits the crop high, at
  `50% 26%`, so a face lands in the top third and the UI window clears it).
- **Never a real person's likeness without a release**, and never a stock photo of
  someone performing piety. The brief in each variant says what credible looks like.
