# App Store assets

Generated. Don't hand-edit — regenerate instead, so they can't drift from the app:

```bash
npm run screenshots:appstore          # IAP review shot
npm run screenshots:appstore-listing  # the marketing gallery
```

| File | Where it goes | Notes |
|---|---|---|
| `listing/6.9/*.png` | App Store version → **Previews and Screenshots → iPhone 6.9"** | The marketing gallery |
| `listing/6.5/*.png` | Same, **iPhone 6.5"** | Same seven shots at the legacy size |
| `listing/ipad-13/*.png` | Same, **iPad 13"** | Six shots — required, see below |
| `iap-review-screenshot.png` | Subscription → **Review Information → Screenshot** | Review-only, never shown publicly |
| `paywall.png` | Spare — first-run paywall variant | Not currently required |
| `listing.json` | **Source of truth** for listing copy | Edit here; regenerate paste sheet below |
| `listing-paste.md` | Open beside ASC and copy field-by-field | `npm run listing:paste` |
| `external-status.json` | Ops checklist — not uploaded | Live verification of env / auth / IPA |
| `../../docs/IOS-DEPLOY-STATUS.md` | **Deployment checklist** — update as you go | |
| `../../src-tauri/icon-1024.png` | Subscription → **Image (Optional)** | 1024×1024, no alpha |

Helpers:

```bash
npm run ios:preflight   # automated half of docs/IOS.md checklist
npm run asc:setup-iap   # create Dayspring Premium products via ASC API (needs APPLE_* key)
```

## Why these are generated, not screenshotted by hand

App Review requires a screenshot showing the in-app purchase, and the most common
rejection for a subscription app is a reviewer who can't find the paywall. Capturing
it manually needs a provisioned device, a signed-in account, and a deliberately
expired trial — enough friction that the image goes stale every time the paywall
changes, silently. The script renders the real components through the dev-only
`?__preview=` route (`src/features/paywall/preview.tsx`), so what you upload is
always what ships.

## The listing gallery

Seven shots, in the order they appear. All copy lives in
**`src/features/appstore/shots.ts`** — a wording change is a one-line edit plus a
re-run, and the gold-gradient italic stays real text rather than baked pixels.

| # | Shot | Theme | Says |
|---|---|---|---|
| 01 | The Ascent — the mountain and the verbatim line of the year | `ink` | See what God has been *making of you.* |
| 02 | The page — a scripture block, a prayer block, and the capture bar | `dawn` | Beautiful to write in. *Made for the inner life.* |
| 03 | The ritual library — four forms with their authors | `dawn` | When you don't know where to *begin.* |
| 04 | The Altar — the subjects you keep bringing, with their warmth | `ink` | Your prayers, *remembered.* |
| 05 | The Lamp — the canon lit where you've lived | `ink` | Find the verses that *actually met you.* |
| 06 | The year list — a decade with real counts | `dawn` | Bring your journal *with you.* |
| 07 | Desktop and phone, the same entry on both | `ink` | Start on your phone, *finish on your Mac.* |

**Every headline has to answer "how does this help me?"** The reader is the hero;
the app is the guide. A line can be true and beautiful and still fail that test —
"Thus far the Lord has helped" is a statement *about God*, not a benefit to the
person reading — and it is a symbol the reader has to decode before it pays off.
04 now names the pain instead: you write a prayer down and never see it again. Same
correction turned "Ten years of journaling" (a fact about a fixture) into "Bring
your journal with you" (something you get to do), with the one-minute import
leading its subcaption because that is what removes the barrier to starting.

**The surfaces carry the gallery, not the editor.** VISION.md is blunt about it —
a journal you write in is table stakes; Day One and a paper notebook clear that
bar. So four of six shots are things nothing else has (Ascent, Rituals, Altar,
Lamp). There was briefly a separate bare-editor shot; it and the capture shot were
the same picture twice, so they were merged into 02, where the scripture and
prayer blocks *are* the output of `/scripture` and `/pray`. That also avoids
mocking `InlineScripturePopover`, which is backed by the live ESV passage search.

**Why the set is mixed light and dark.** Ascent, Altar and Lamp are built on glow
— a lit chapter cell only reads as *lit* against darkness, and on cream the whole
ember→gold metaphor collapses. The writing surfaces go to `dawn` because that is
what the shipped default (`appearance: 'auto'`) actually gives anyone on a
light-mode phone, it matches the app icon (a sunrise on cream) and the name (Luke
1:78, first light), and a Christian journal's dominant moment is the morning.

The frame never changes, so the strip still reads as one system; only the card's
palette alternates. To go all-dark or all-light, set or drop `theme` per shot in
`shots.ts`.

**One idea per shot.** A full phone screen is unreadable at gallery-thumbnail size,
so each shot renders a *single* shipped component with no app chrome — no header,
no tab bar, no FAB — scaled up until it reads at a glance. Still the real
components and the real CSS; only the framing differs.

**07 is the deliberate exception** — the only shot that isn't one card, and the
only one with a list. Both panes are real layouts, picked purely by iframe width
against `useIsMobile()`'s 767px breakpoint: 1120pt gets the three-column desktop
shell, 420pt gets the phone. The same entry is open in both and both headers say
"Synced" — the claim proving itself rather than asserting itself.

The phone pane shows the **voice sheet**, not a second copy of the editor, so
"speak and it writes it down" has a picture instead of a promise. `VoiceCapture`
auto-starts dictation on mount and needs a microphone, so the capture script
passes `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`;
without them it renders its "couldn't reach the microphone" state.

**Why this one gets a list.** Every other frame answers *"what is this?"*, where a
list would be noise. This one answers *"will it fit how I live?"* — a practical
question, and practical questions want facts. Six of them, running down the
L-shaped gap a landscape window above a portrait phone always leaves, so that
column is filled by design rather than the frame carrying a hole. Six is what it
takes to reach the phone's lower edge.

Everything listed has to be real. The offline line is true because of the
`outbox` store in `src/lib/db.ts` plus the service worker; the export line is
BRANDSCRIPT promise #4. Check before adding a seventh.

The desktop viewport is deliberately tall-ish (1120x880) rather than 16:10 —
width is the binding constraint in a portrait frame, so a wide-short window can
only float in dead space it cannot grow into.

Two rules the shots are checked against, both from `docs/product/`:

- **PRINCIPLES #1** — "could a user screenshot this UI and feel judged by it?" The
  Lamp's unlit books are the point, not a coverage score.
- **BRANDSCRIPT** — no *journey*, *unlock*, *track*, *streak*, *score*, *insights*,
  *AI-powered*, *mindfulness*. Never sermonize, never gamify.

Shot 06 claims ten years, so the fixture actually contains ten years of entries at
realistic per-year counts. Same grounding discipline as the product: what the
caption asserts, the screenshot shows.

### How it renders

`?__preview=listing-<shot>` draws the framed page; `&raw=1` draws just the snippet.
The framed page embeds the raw one in a **same-origin iframe**. That is not
incidental — `.scrim`, `.drawer`, `.mobile-fab` and `.slash-palette` are all
`position: fixed`, so inside a CSS-scaled `<div>` they resolve against the real
viewport and render full-size *outside* the phone. In an iframe, `position: fixed`,
`100dvh` and body portals all resolve against the iframe's viewport, and scaling
the iframe element takes the fixed layers with it.

The card lays out at **420 CSS pt**, not the frame's width, so line breaks and touch
targets match a real phone rather than a tablet.

Fixtures live in `src/features/appstore/mock.ts` and are reached only through a
dynamic `import()` under a literal `import.meta.env.DEV`, so Vite drops them from
production. To confirm after a change:

```bash
npm run build && grep -rl "never see it again" dist/ | wc -l   # must be 0
```

## Prices in the screenshot

StoreKit doesn't exist in a browser, so the preview substitutes `PREVIEW_PRODUCTS`
from `src/lib/appleIap.ts`. **Those values must match App Store Connect** — currently
**$7.99/month** and **$69.99/year**. A screenshot showing no price, or the wrong one,
is a 3.1.2 rejection. Note these differ from the web/Stripe prices ($7 and $64):
Apple's tiers are .99-based, so the two platforms genuinely don't match.

## Dimensions

Everything here must match [Apple's screenshot
specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
for a device the app supports — not an arbitrary size. PNG, RGB, **no alpha
channel** (ASC rejects transparency; the capture scripts flatten onto the frame
background).

- **IAP review shot** — 1284×2778 (iPhone 6.5" portrait).
- **Listing gallery, iPhone** — both 1320×2868 (6.9", ASC's current default slot
  for new submissions) and 1284×2778 (6.5"). Filling both avoids a
  missing-required-size block at submission and any upscaling.
- **Listing gallery, iPad** — 2064×2752 (iPad 13" portrait).

## The iPad set is not optional

`src-tauri/gen/apple/app.xcodeproj` sets `TARGETED_DEVICE_FAMILY = "1,2"`, so the
build declares iPad support and App Store Connect will not accept a submission
with an empty iPad slot. The only way to skip it is dropping iPad — family `"1"`
— which costs a rebuild and a re-upload.

**iPad shots are shaped differently from iPhone shots, on purpose.** On a phone a
whole screen is unreadable at thumbnail size, so each frame is one component with
its chrome stripped. On iPad the chrome *is* the story: `useIsMobile()` is
`(max-width: 767px)` and the boundary is deliberately 767 rather than 768 so iPad
portrait gets the three-column shell. So an iPad shot shows the real shell with
the surface live in the canvas (`src/features/appstore/ipad.tsx`), and `cropTop` /
`padTop` are ignored — those target snippet headers that aren't there.

Two things fall out of this for free: the entry list sits open beside the canvas,
so shot 06's decade of years needs no special arrangement; and the ritual library
renders its real 3x3 grid, because `.practice-library__grid` is only forced to a
single column under 480px. All nine forms, with their authors, in one frame.

Shot 07 is dropped from the iPad set — a phone-and-Mac composite argues the wrong
thing on an iPad sheet.

## Known: the paywall preview renders unthemed

`src/features/paywall/preview.tsx` sets `data-theme='dusk'`, and **there is no
`dusk` theme** — `src/styles/themes.css` defines only `dawn/vellum/cloister/sabbath`
and `ink/ember/compline/nocturne`, and `--bg`/`--text` live *inside* those blocks,
not on `:root`. So the paywall renders on no palette and only looks dark because
`finalizePng` flattens its alpha onto `(20,18,16)`.

The uploaded IAP screenshot reads fine, so this was left alone rather than
regenerating an asset already in review. The listing shots set `ink` explicitly.
Fix the `dusk` string if you regenerate the paywall for any other reason.

## Gotchas if you touch the capture script

- **Don't lower the viewport width below ~640 CSS px.** macOS enforces a ~500px minimum
  window width, and Chrome lays out at that minimum but still crops to `--window-size`,
  which slices the right-hand side off the auto-renew disclosure.
- **Keep `--virtual-time-budget`.** The app boots asynchronously; without it Chrome
  photographs a blank page.
- **Old `--headless` won't do.** It lays out at its own default width regardless of
  `--window-size`. Use `--headless=new`.
