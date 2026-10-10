# App Store assets

Generated. Don't hand-edit — regenerate instead, so they can't drift from the app:

```bash
npm run screenshots:appstore          # IAP review shot
npm run screenshots:appstore-listing  # the marketing gallery
```

| File | Where it goes | Notes |
|---|---|---|
| `listing/6.9/*.png` | App Store version → **Previews and Screenshots → iPhone 6.9"** | The marketing gallery — ten shots (Apple's maximum), upload in filename order |
| `listing/6.5/*.png` | Same, **iPhone 6.5"** | Same ten shots at the legacy size |
| `listing/ipad-13/*.png` | Same, **iPad 13"** | Nine shots — no 09; required, see below |
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

Ten shots, in the order they appear — Apple's maximum per device size. All copy
lives in **`src/features/appstore/shots.ts`** — a wording change is a one-line edit
plus a re-run, and the gold-gradient italic stays real text rather than baked
pixels.

| # | Shot | Lifted out | Palette | Says |
|---|---|---|---|---|
| 01 | The page — a verse, a prayer, and the capture bar | the prayer | `dawn` | A journal built for *spiritual growth.* |
| 02 | The Ascent at the year — the climb, then what the year kept returning to | — | `ink` | See what God has been *making of you.* |
| 03 | The ritual library — named practices with their authors | Luther's Garland | `dawn` | When you don't know where to *begin.* |
| 04 | Lectio Divina, mid-walk — the passage, a phrase drawn from it, a line written | the passage | `dawn` | Scripture that *stays with you.* |
| 05 | One thread of the year — a prayer for Dad, ask to now, in the writer's words | Maya's line | `ink` | Your prayers, *remembered.* |
| 06 | A beta tester's words — no screen | — | — | "…a new way to engage my heart with God." |
| 07 | The Lamp — the canon lit where you've lived | Psalms | `ink` | Find the verses that *actually met you.* |
| 08 | Pages — a decade of them, with the page from ten years ago this week | that page | `dawn` | Bring your journal *with you.* |
| 09 | Desktop and phone, the same entry on both (iPhone only) | — | `ink` | Start on your phone, *finish on your Mac.* |
| 10 | The lock screen, with Face ID | the PIN field | `dawn` | Private & *secure.* |

**The order is the argument.** App Store search shows the first three shots side
by side, so those three make the whole case on their own: what it is (01 — the
front door D-001 chose, word for word the site's hero), what it gives back (02 —
the year, read back), and what it holds for someone who doesn't know how to
start (03). The rest deepen it in the order a reader asks: Scripture, prayer,
what someone who uses it says, the long view of the Bible, the archive, whether
it fits how they live — and last, whether it is safe to write the truest things
there.

**One writer runs through the whole strip.** The prayer on the page in 01 ("For
Dad, and for Thursday") is the same Thursday the Lectio reflection in 04 names,
and the thread the year carries in 02 and 05 — Dad's diagnosis, from "Pray for
Dad's tests" in March to "Maya prayed for Dad by herself tonight. Nobody asked
her to." in October. "Your prayers, remembered" is made by the gallery, not only
claimed by its captions. Note where that thread ends: on a daughter praying, not
on a scan result. The year's fixture does hold "Dad's scan is clear", and the
thread shows it if the capture clock is moved back to mid-October — but a
marketing image that closes a prayer on a medical outcome reads as a promise the
product cannot make (PRINCIPLES #1, light not verdict). Keep it on the asking
changing shape.

### The frame — what came from studying Stoic

The 2026-10 pass took four moves from Stoic's listing (a strong, conventional
App Store gallery) and declined the rest.

- **The device runs off the frame's foot.** A phone (or iPad) outline with a drawn
  status bar hangs under a centred caption and is cut off by the frame's bottom
  edge, so the screen is as large as the width allows instead of shrinking to fit
  a whole device. The frame never shows the device's foot, and doesn't need to.
- **One line is lifted out of the screen** (`Pop` in `shots.ts`, `PopOut` in
  `ShotFrame.tsx`), larger, rising from where it sits — the line the shot is
  about, made legible at gallery size. It is the *real element*, verbatim by
  construction: the frame loads the snippet a second time, hides everything but
  that element, and crops to its box. Never a restyled quote.
- **A line runs across the frames.** The Ascent's own gold trail climbs the whole
  strip, from the foot of 01 to a lit summit beside 10. Each frame draws its slice
  of one curve (`trailY`), so where a screenshot ends the next picks the line up
  at the same height. It runs behind the devices — a frame shows it in its
  gutters, and whole on 06, where the sunrise mark sits on it.
- **A real voice, and privacy last.** See 06 and 10 below.

Declined: headlines that name features ("AI Diary", "Track Mood & Habits" — ours
name what you get, and *AI*, *track* and *streak* are banned words); a first
slide with no app on it (Stoic fills it with an award and a famous name; a new
app has to show itself); and Stoic's light grey ground (ours stands out on the
App Store's white, and the glow surfaces need dark).

**06 — the quote.** One real beta interview, quoted exactly as the marketing site
quotes it (`site/src/content/home.ts → testimonial`): anonymous — "A therapist and
spiritual director" — because her name is withheld until she consents to it. No
stars, no rating, no user count: there are none yet, and BRANDSCRIPT forbids
implying social proof we do not have. Before naming her, or before swapping in a
different line, get the speaker's consent for *this* use.

**10 — private & secure.** Every claim is one the product already makes in public:
the lock (PIN, Face ID on iPhone) is D-023; "encrypted on the way and in storage"
is the privacy page's own line (`site/src/content/privacy.ts`); "never sold, never
used for training" is BRANDSCRIPT's agreement plan. Nothing says end-to-end, which
would be false (PRINCIPLES #7, D-011). The lock screen is the real `LockScreen`
(`lockShot.tsx`), met three digits into its PIN; a capture seam in
`applock/biometric.ts` answers "Face ID", because a browser can never reach the
plugin that would, and without it the shot would be a lock screen no iPhone with
Face ID shows.

**Every headline has to answer "how does this help me?"** The reader is the hero;
the app is the guide. A line can be true and beautiful and still fail that test —
"Thus far the Lord has helped" is a statement *about God*, not a benefit to the
person reading. Same discipline turned "Ten years of journaling" (a fact about a
fixture) into "Bring your journal with you" (something you get to do).

**No counts that go stale.** The first gallery said "Nine contemplative forms";
the shelf grew to fifteen within weeks and the uploaded listing was false. The
library grows by design, so 03 names forms instead of counting them.

**First light across the strip.** Every frame has a sun below its foot, a little
higher each shot (`--dawn`, 0 → 1, set in `ShotFrame.tsx` from the shot's place
in its set), while the trail climbs toward the summit on the last. The first frame
is the hour before dawn; the last has the horizon gold and the morning palette.
None of it sits behind a caption, so every headline is on the same dark. It is
the name — Luke 1:78, the dayspring from on high — said without a word.

**Why the set is mixed light and dark.** The Ascent, the thread and the Lamp are
built on glow — a lit chapter cell only reads as *lit* against darkness, and on
cream the whole ember→gold metaphor collapses. The writing and reading surfaces
go to `dawn` because that is what the shipped default (`appearance: 'auto'`)
gives anyone on a light-mode phone, it matches the app icon (a sunrise on cream),
and a Christian journal's dominant moment is the morning. Alternating also stops
the back half of the strip running dark four frames in a row.

**One idea per shot.** A full phone screen is unreadable at gallery-thumbnail size,
so each iPhone shot renders a *single* shipped surface with no app chrome — no
header, no tab bar, no FAB — under a drawn status bar, and lifts its one line out.
Two pieces of chrome are hidden by name for that reason: the Ascent's
ascend/descend pair (sticky to a phone's foot) and Pages' floating "Look for"
disc. Everything else is the real components and the real CSS; only the framing
differs. A surface anchored to the screen's bottom (01's capture bar, 04's Next)
lays out in a shorter `screen` so the bar lands above the frame's foot.

**What each shot is made of.**

- **02 and 05** are the real `AscentView`, opened at the year (`climb.tsx`), and
  the year is the real `buildYearLedger` run over a synthetic writer's entries
  (`ascent/ledger/fixtureYear.ts`, shared with `?__preview=ledger`). Since
  `yearLedger` graduated this *is* the Summit for every user; the
  mountain-and-refrain Summit the first gallery showed no longer exists in the
  app, which is why that shot had started rendering an empty "Reading 2026…".
  02 frames the top; 05 crops down to the first thread.
- **04** is the real `RitualComposer` in entry mode over a Lectio Divina page built
  the way `?__preview=ritual` builds one (`scriptureRitual.tsx`). Its words come
  from `passageFixtures.ts` — the public-domain WEB, fetched, never model memory —
  because a capture has no session for the ESV endpoint. The composer shows no
  translation label; the *page* view would say "· ESV" over WEB text, which is
  why 04 is the composer and not the page.
- **08** is Pages, list on a phone and the wall on iPad, over a decade of fixture
  entries at realistic per-year counts — what the caption asserts, the screenshot
  shows.
- **09** is the deliberate exception: the only shot with two devices, and the
  only one with a list. Both panes are real layouts, picked purely by iframe width
  against `useIsMobile()`'s 767px breakpoint. The phone pane shows the voice sheet,
  which auto-starts dictation, so the capture passes
  `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`. Everything
  in its list has to be real (the offline line is the `outbox` store in
  `src/lib/db.ts` plus the service worker; the export line is BRANDSCRIPT promise
  #4). Check before adding to it.

Two rules the shots are checked against, both from `docs/product/`:

- **PRINCIPLES #1** — "could a user screenshot this UI and feel judged by it?" The
  Lamp's unlit books are the point, not a coverage score.
- **BRANDSCRIPT** — no *journey*, *unlock*, *track*, *streak*, *score*, *insights*,
  *AI-powered*, *mindfulness*. Never sermonize, never gamify.

### Every shot is taken at the same moment

`src/features/appstore/clock.ts` shifts the page's clock to **Tuesday 27 October
2026, 7:40am** before any fixture reads the date. Without it a shot was a function
of the day the script ran: the year view taken in February had one month in it,
and fixture pages dated "the 27th of this month" sat in the future for most of
every month (the first gallery's History shot showed pages dated after the day it
was captured). The 27th is when the newest fixture page falls and it is titled
"Tuesday", so the date and the title agree wherever a shell shows both. Shifted,
not frozen — time still moves from that instant.

### Capture previews never read an account

Every surface reads fixtures through a seam guarded by `isCapturePreview()`
(`src/lib/previewMode.ts`) — a privacy boundary, because these images are public.
Two holes were closed with this gallery: the year ledger (`ascent/ledger/load.ts`)
had no seam at all once `yearLedger` graduated, and the check itself read the
*current* URL, which in-app navigation rewrites (`history.replaceState` drops
`?__preview=`) — so a shot that navigated, like the iPad Ascent going to the year,
fell through to live data mid-capture. The check now latches at boot.

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

Fixtures live in `src/features/appstore/mock.ts` (and the year in
`src/features/ascent/ledger/fixtureYear.ts`) and are reached only through a
dynamic `import()` under a literal `import.meta.env.DEV`, so Vite drops them from
production. To confirm after a change — one line from each fixture:

```bash
npm run build && grep -rlE "rehearsing the worst version|Nobody asked her to" dist/ | wc -l   # must be 0
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
whole screen is unreadable at thumbnail size, so each frame is one surface with
its chrome stripped. On iPad the chrome *is* the story: `useIsMobile()` is
`(max-width: 767px)` and the boundary is deliberately 767 rather than 768 so iPad
portrait gets the three-column shell. So an iPad shot shows the real shell with
the surface live in the canvas (`src/features/appstore/ipad.tsx`), and `cropTop` /
`padTop` / `screen` are ignored — those target snippet headers that aren't there.
The same lifted lines rise from the shell (08's from a page card on the wall
rather than a list row, hence its two selectors).

What that changes per shot: 01 gets a fuller page (`MOCK_DOC_FULL` — an iPad page
is twice a phone's width, and the phone's few lines left three quarters of it bare
paper); 03 shows the library's real grid, because `.practice-library__grid` is
only forced to one column under 480px; 04 is the scripture ritual's side-by-side
leaf, passage beside the writing; 05 scrolls the year down to its threads
(`ToTheThreads` in `climb.tsx`) rather than cropping — the lifted line waits for
that scroll to settle before it measures; and 08 is the Pages wall in the shell, a
decade of pages beside the years they span — it used to be the editor again, the
same picture as 01. 06 (the quote) and 10 (the lock) are the same as on iPhone.

09 is dropped from the iPad set — a phone-and-Mac composite argues the wrong
thing on an iPad sheet — so the iPad files go 08, then 10.

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

- **The window is taller than the frame, on purpose.** New headless Chrome's
  viewport is ~87pt shorter than its window, and nothing past the viewport is
  painted. The frame is told its true size (`&w=` / `&h=`) instead of reading
  `innerHeight`, the window gets `WINDOW_SLACK` below it, and `finalizePng` crops
  back to Apple's size from the top. Sized exactly, every PNG had a bare strip
  along its foot — invisible on a flat frame, a hard seam under the sunrise.
- **Animations are stopped dead in the snippet.** The virtual time budget does
  not drive compositor animations inside the frame's iframe, so entrances were
  photographed half-run (the year shot's lower half came out dimmed). The raw
  page zeroes every animation and transition duration, landing each on its end
  state.
- **Padding percentages are widths.** CSS resolves `padding: … 34%` against the
  frame's *width*, so moving the quote up the frame is done in pixels on iPad.
- **A lifted line waits for stillness.** `PopOut` measures its element only once
  the box has held still for six polls; measured on first sight, the iPad year's
  line was found before its scroll and the card rose from off the frame.
- **`padTop` pads.** The iframe sits inside `.shot__window`, which clips at the
  top of the pad. Before, shifting the iframe up moved its whole box, so the rows
  above the crop slid back into the "pad" — and in a headless capture spilled over
  the card's top edge. That is how the Lamp's range row kept turning up half cut.
- **Don't lower the viewport width below ~640 CSS px.** macOS enforces a ~500px minimum
  window width, and Chrome lays out at that minimum but still crops to `--window-size`,
  which slices the right-hand side off the auto-renew disclosure.
- **Keep `--virtual-time-budget`.** The app boots asynchronously; without it Chrome
  photographs a blank page.
- **Old `--headless` won't do.** It lays out at its own default width regardless of
  `--window-size`. Use `--headless=new`.
- **Any Chrome will do.** The script looks for Chrome, Chromium or Edge on macOS and
  Chromium on Linux (`/opt/pw-browsers/chromium` in a cloud container), and
  `CHROME=/path/to/chrome` overrides it. As root it adds `--no-sandbox`.
- **`--size=6.9`** (or `6.5`, `ipad-13`) renders one size for a quick look, and any
  bare argument filters shots by filename (`npm run screenshots:appstore-listing --
  02 05 --size=6.9`).
