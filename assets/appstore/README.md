# App Store assets

Generated. Don't hand-edit — regenerate instead, so they can't drift from the app:

```bash
npm run screenshots:appstore
```

| File | Where it goes | Notes |
|---|---|---|
| `iap-review-screenshot.png` | Subscription → **Review Information → Screenshot** | Review-only, never shown publicly |
| `paywall.png` | Spare — first-run paywall variant | Not currently required |
| `listing.json` | Paste into ASC App Store version metadata | Description, keywords, review notes |
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

## Prices in the screenshot

StoreKit doesn't exist in a browser, so the preview substitutes `PREVIEW_PRODUCTS`
from `src/lib/appleIap.ts`. **Those values must match App Store Connect** — currently
**$7.99/month** and **$69.99/year**. A screenshot showing no price, or the wrong one,
is a 3.1.2 rejection. Note these differ from the web/Stripe prices ($7 and $64):
Apple's tiers are .99-based, so the two platforms genuinely don't match.

## Dimensions

IAP **Review Information** screenshots must match [Apple's screenshot
specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
for a device your app supports — not an arbitrary size. We generate **1284×2778**
(iPhone 6.5" portrait). PNG must be RGB with no alpha channel.

## Gotchas if you touch the capture script

- **Don't lower the viewport width below ~640 CSS px.** macOS enforces a ~500px minimum
  window width, and Chrome lays out at that minimum but still crops to `--window-size`,
  which slices the right-hand side off the auto-renew disclosure.
- **Keep `--virtual-time-budget`.** The app boots asynchronously; without it Chrome
  photographs a blank page.
- **Old `--headless` won't do.** It lays out at its own default width regardless of
  `--window-size`. Use `--headless=new`.
