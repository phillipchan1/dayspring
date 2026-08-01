# App Store Connect — paste sheet

_Generated from `listing.json`. Edit that file, then run `npm run listing:paste`._

App Store Connect has **no JSON upload** for listing text — open this file beside ASC and copy each block into the matching field.

---

## App Information

_ASC: **Apps → Dayspring Journal → General → App Information**_

### Name

> Already set to **Dayspring Journal** (plain “Dayspring” is taken on the App Store). Home screen still shows **Dayspring**.

### Subtitle _(30 chars max)_

See what God is making of you

### Privacy Policy URL

https://dayspring-eosin.vercel.app/privacy

### Primary category

Lifestyle

### Secondary category _(optional)_

Reference

---

## iOS App Version (English U.S.)

_ASC: **Distribution → App Store → iOS App** (your version, e.g. 1.0)_

### Promotional Text _(170 chars, optional — can change without new build)_

You've been writing for years. Dayspring is the first journal that reads it back to you. Start with a 14-day free trial.

### Description

You've been writing for years. Dayspring is the first journal that reads it back to you.

Most journals are storage. You write faithfully, the entries pile up, and you never go back — not because you didn't care, but because a pile of entries isn't a story. Meanwhile the answers arrive and go unnoticed, because the asking was forgotten. Dayspring is built against that one enemy.

HOW IT WORKS
1. Bring in your history. Import from Day One or Diarly in about a minute on Mac or the web, with your original dates kept exactly.
2. Write like you already do. Nothing to learn. Scripture, prayer, and what you sensed are captured on the page as you go — by keyboard, by voice, or from a photograph of a page you wrote by hand.
3. See what's been happening. Week, month, quarter, and year, in your own words.

WHAT YOU'LL SEE
• The Ascent — the threads of a season and the one line of the year, lifted verbatim from your own entries.
• The Altar — the people, places, and matters you keep bringing to God, gathered from the prayers you laid down while writing.
• The Lamp — every passage you've written, lit across the whole Bible, so you can find the verses that actually met you.
• Rituals — nine contemplative forms, among them the Daily Examen, Lectio Divina, and the Prayer of Recollection, laid over the page as scaffolding and never as a script.

Mac, iPhone, and the web, synced without you thinking about it. Eight themes, four writing faces, and a focus mode with nothing between you and the words.

OUR PROMISES
• Nothing is invented. Every reflection traces to something you actually wrote — the facts are computed in code and the quotes are verbatim.
• Your entries are yours. We never train on them and we never sell them.
• Your original dates are preserved exactly. Re-importing never duplicates.
• You can export everything, any time, in plain markdown.
• We will never score your spiritual life.

No streaks, no badges, no verdict on your walk with God.

Dayspring — Luke 1:78, "the dayspring from on high hath visited us." First light, and mercy after darkness.

FREE TRIAL & SUBSCRIPTION
Every new account begins with a 14-day free trial. No card required to start. After the trial, Dayspring is an auto-renewing subscription:
• Monthly: $7.99
• Annual: $69.99
Payment is charged to your Apple Account at confirmation of purchase. The subscription renews automatically unless auto-renew is turned off at least 24 hours before the end of the current period. Manage or cancel anytime in your Apple Account settings.

Privacy Policy: https://usedayspring.app/privacy
Terms of Use: https://usedayspring.app/terms

### Keywords _(100 chars, comma-separated, no spaces after commas)_

journal,faith,prayer,bible,scripture,devotional,diary,examen,lectio,quiet time,gratitude

### Support URL

https://dayspring-eosin.vercel.app

### Marketing URL _(optional)_

_(leave blank)_

### Copyright

2026 Phillip Chan

---

## App Review Information

_ASC: same version page, scroll to **App Review Information**_

### Notes

WHAT THE APP IS
A journal for practicing Christians. Entries are written on the phone; the
reflection surfaces (Ascent, Altar, Lamp) are generated from the user's own
entries and are empty until there is history to read.

SANDBOX TESTING
1. Sign in with Apple or Google.
2. New accounts receive a 14-day app-managed trial (no card, no StoreKit trial).
3. To reach the paywall: use an account whose trial has ended, or shorten
   trial_ends_at in Supabase on a fresh sandbox account.
4. Subscribe via StoreKit (dayspring_monthly / dayspring_annual). No
   introductory offer is attached — charging starts immediately at subscribe,
   which matches our web Stripe products.
5. Restore Purchases is on the paywall and in Settings.

NOTE ON IMPORT
The description mentions importing from Day One or Diarly. That runs on the Mac
app and the web app only — archives are several hundred MB and parse best on a
computer. On iPhone, Settings > Import shows a note directing to desktop.
Imported entries sync to the phone and appear in the journal normally.

Contact: phillipchan1@gmail.com

### Contact

phillipchan1@gmail.com

---

## Version release (same page)

### Export compliance

When prompted: **No** — app uses only standard HTTPS encryption.

Info.plist already has `ITSAppUsesNonExemptEncryption = false`.

---

## Not in this file (upload separately)

| Item | Path |
|------|------|
| iPhone 6.9\" screenshots | `assets/appstore/listing/6.9/*.png` |
| iPhone 6.5\" screenshots | `assets/appstore/listing/6.5/*.png` |
| iPad 13\" screenshots **(required)** | `assets/appstore/listing/ipad-13/*.png` |
| Build | Attach **1.0.213 (213)** when processing finishes |
| Subscription review screenshot | `assets/appstore/iap-review-screenshot.png` _(already on products)_ |
