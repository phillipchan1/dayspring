# Flagship

The one picture that carries the whole product: the Mac app, mid-entry, with the
`/` palette open — the gesture nothing else in the category has.

Everything else we make is a *detail*. A listing shot is one surface at phone
width; an ad is a fragment under a headline. That is the right shape for someone
who has already decided to look, and the wrong shape for the first and often
only image a stranger sees. This is the frame that has to work alone.

Generated. Don't hand-edit and don't retouch — regenerate instead, so the image
can't drift from the app:

```bash
npm run flagship                     # everything
npm run flagship -- --canvas=16x9    # one canvas, while iterating
npm run flagship -- --theme=ink      # one palette
```

`MANIFEST.md` (generated beside this file) lists every export and what it is for.

## Which one do I reach for

| Want | Use |
|---|---|
| Site hero, press, a slide, Product Hunt | `write-dawn/16x9.png` |
| A link anyone pastes (`og:image`) | `write-dawn/og.png` |
| Facebook / Instagram feed | `write-dawn/4x5.png`, then `1x1` |
| Stories, Reels | `write-dawn/9x16.png` |
| A dark page, or a dark placement | the matching `write-ink/…` |
| Somewhere that brings its own words | `bare-dawn/16x9.png` |

## Things worth knowing

**Every pixel of the app is the real app.** The scene renders the shipped
`DesktopJournal` and the shipped `Editor` through a dev-only preview route, and
the palette is opened through the shipped `+` gutter path — not faked state. If
that door ever breaks, this image fails to render rather than lying about it.
Source: `src/features/flagship/`.

**The writing is fabricated, always.** The same rule the ad and listing fixtures
keep: no real journal, ever, in a public asset.

**Look at `CONTACT_SHEET.png` after every run.** The failure that matters here is
a palette that silently did not open — the capture is on a virtual clock, and a
hero image of an app with no menu open is the one thing this must not be.
Nothing throws. It is obvious on the sheet.

**The copy is the site's H1, word for word.** Deliberate: someone who sees this
and then lands on usedayspring.app should meet the sentence they were promised.
It lives in `src/features/flagship/flagship.ts`, with the ad and App Store
registries it deliberately echoes.
