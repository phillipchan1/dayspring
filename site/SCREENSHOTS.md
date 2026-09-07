# Screenshot slots

Real product screenshots are dropped into `public/screenshots/` and swapped in
**without touching layout**. Every slot renders inside `<PhoneFrame>` (or a
matching desktop frame) with `width`/`height` set so there's **no layout shift**
when the real asset replaces the placeholder.

Rules:

- Export at **@2x** (retina). Provide both `{name}.png` and `{name}@2x.png`.
- The frame components (`PhoneFrame`) clip to a rounded screen — export the raw
  app screen, no device chrome (the frame supplies the chrome).
- Always pass `width` + `height` (intrinsic CSS px) so the box reserves space.
- Never drop a bare rectangular screenshot into a section. It always goes in a frame.

## How to wire a real screenshot

`PhoneFrame` already accepts a `screenshot` prop. Replace a native-mock slot like:

```astro
<PhoneFrame width={160} rotate={3} />  {/* with a screenshot: */}
<PhoneFrame
  width={300}
  rotate={3}
  screenshot={{
    src: "/screenshots/home-wins.png",
    src2x: "/screenshots/home-wins@2x.png",
    width: 300,
    height: 640,
    alt: "Dayspring on iPhone showing the day's three wins",
  }}
/>
```

## Slots

| Slot key        | Page                 | Where                              | Frame       | Native mock today    | Target file(s)                | Intrinsic size |
| --------------- | -------------------- | ---------------------------------- | ----------- | -------------------- | ----------------------------- | -------------- |
| `app-editor`    | `/` + `/features`    | Editor showcase (`<AppMock>`)      | app window  | `<AppMock>` (CSS)    | `app-editor.png` / `@2x`      | 860 × ~520     |
| `home-letter`   | `/` (Home)           | Year-in-review (`<LetterCard>`)    | none/native | `<LetterCard>` (CSS) | optional — intentionally native | —            |

> `<AppMock>` is a **native HTML/CSS recreation of the real desktop app**
> (rail + entries sidebar + editor), so it stays crisp and themed. It's used on
> both Home and the `/features` editor deep dive. Swap it for a real screenshot
> only if a capture reads better — and if so, drop the capture into a matching
> desktop frame at the size above so there's no layout shift.

## Pending slots (added when the other routes are built)

These pages need the missing copy docs (`dayspring-onepager-copy.md`,
`dayspring-manifesto.md`) before they're built. Their screenshot slots will be
documented here at that point:

- `/features` — three deep dives (editor / year-in-review / formation), each
  with a live app-element mock or framed screenshot.
- `/why`, `/privacy`, `/faq`, `/maker` — mostly text; framed screenshots only
  where they add trust.

## OG image

`public/og/dayspring-og.svg` is a placeholder OG card (1200×630). For maximum
social-scraper compatibility, render it to **PNG** at 1200×630 and save as
`public/og/dayspring-og.png`, then point `ogImage` in `src/layouts/Base.astro`
back to the `.png`.
