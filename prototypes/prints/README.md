# Prints in the margin — prototype

**Start:** `/prints/#color` (also `#ships`, `#tipped`, `#camera`, `#asked`)

How the entries list (`src/features/pages/PageRow.tsx`) could show that a page
carries a photo. Day One and Diarly lead with a thumbnail; Dayspring's rule for a
page is *her words, her date and her markings* (`PageCard.tsx`). A photo she put
on the page passes that rule. A camera icon we draw beside it doesn't.

| Direction | What it is |
|---|---|
| `#ships` | Control — today's list. Only a photo-only page shows anything (its caption). |
| `#color` | **Pick.** A tiny print in the photo's stored average color (`analyzeImage`); a set fans; hover steps it forward into the photos, as rows, with her caption. |
| `#tipped` | A real thumbnail at the row's end — the Day One way, kept small. |
| `#camera` | Our glyph and a count, like a mail attachment. |
| `#asked` | Nothing at rest; **Photos** in Look for dims the rest and shows the prints. |

The **Photos** chip in Look for works in every direction.

One self-contained page, no bundler. `page.html` is the source (published as a
Claude artifact, which supplies its own document skeleton); `index.html` is the
same page wrapped in `<!doctype html>` for the prototypes site. Regenerate it after
editing `page.html`:

```bash
{ printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'; sed -n '1,/^<\/style>/p' page.html; printf '</head>\n<body>\n'; sed -n '/^<\/style>/,$p' page.html | tail -n +2; printf '</body>\n</html>\n'; } > index.html
```

Pages and photos are invented; photos are painted on a canvas so the print color
is computed from real pixels the same way the app computes it.

Known gap for `#color`: photos brought in by the Day One / Diarly importer go
through `ensureAttachment` without `analyzeImage`, so they have no stored color.
Shipping this needs a color backfill (or a neutral print as the fallback).
