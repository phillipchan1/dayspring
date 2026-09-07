# iOS App Store — deployment checklist

Living tracker for getting Dayspring on the App Store. Update as you go.

**App:** Dayspring Journal · Apple ID `6776925077` · bundle `com.phillipchan.dayspring`  
**IPA to ship:** `~/Desktop/Dayspring-1.0.213.213.ipa` (sunrise icon — **not** 1.0.206)

---

## Done

- [x] App ID — Sign in with Apple + In-App Purchase enabled
- [x] Services ID `com.phillipchan.dayspring.auth` (domain + Supabase callback)
- [x] Sign in with Apple key → Supabase Apple provider enabled
- [x] Subscription group **Dayspring Premium**
- [x] `dayspring_monthly` ($7.99/mo, no intro offer) — screenshot + localization
- [x] `dayspring_annual` ($69.99/yr upfront, no intro offer) — screenshot + localization
- [x] Group localization (English)
- [x] IAP review screenshot regenerated at **1284×2778** (`assets/appstore/iap-review-screenshot.png`)
- [x] Vercel: `APPLE_APP_APPLE_ID`, `APPLE_BUNDLE_ID` (production)
- [x] Legal pages live (`/terms`, `/privacy`)
- [x] Backend endpoints live (`/api/apple/verify`, `/api/webhooks/apple`)

---

## In progress / next

### Step 1 — IAP API key → Vercel (YOU ARE HERE)

Purchases on device call `/api/apple/verify`. Without these three env vars, payment succeeds in StoreKit but **the account never unlocks**.

- [ ] Create **In-App Purchase** API key in App Store Connect
- [ ] Note **Issuer ID** + **Key ID**
- [ ] Download `.p8` (one-time download — store in 1Password)
- [ ] Add to Vercel Production (+ Preview if you want):
  - `APPLE_ISSUER_ID`
  - `APPLE_KEY_ID`
  - `APPLE_PRIVATE_KEY`
- [ ] Redeploy production (push to `stable` or manual redeploy in Vercel)

→ **Walkthrough:** [Step 1 detail](#step-1--iap-api-key--vercel-env-vars) below.

### Step 2 — App Store Server Notifications

- [ ] ASC → app → **App Information** (or General → App Store Server Notifications)
- [ ] Production URL: `https://dayspring-eosin.vercel.app/api/webhooks/apple`
- [ ] Sandbox URL: same

### Step 3 — Upload IPA

- [ ] Transporter → deliver `~/Desktop/Dayspring-1.0.213.213.ipa`
- [ ] Wait for processing in ASC (TestFlight / builds list)

### Step 4 — App Store version + submit

- [ ] **Do not** click **Add for Review** on subscriptions alone (first group goes with app version)
- [ ] App Store tab → version **1.0.213**
- [ ] Paste listing from `assets/appstore/listing.json`
- [ ] iPhone screenshots (6.5" or 6.9" — see [Apple specs](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/))
- [ ] Attach build 213
- [ ] Submit for review (subscriptions included automatically)

### Step 5 — Sandbox test (device)

- [ ] Settings → App Store → Sandbox Account
- [ ] Sign in with Apple + Google
- [ ] Paywall shows StoreKit prices ($7.99 / $69.99)
- [ ] Purchase unlocks entitlement
- [ ] Restore purchases works

---

## Step 1 — IAP API key → Vercel env vars

This is a **different key** from the Sign in with Apple `.p8` you used for Supabase.

| | Sign in with Apple (done) | In-App Purchase (this step) |
|---|---|---|
| Created in | Apple Developer → Keys | **App Store Connect → Integrations** |
| Used for | Supabase login | Vercel `/api/apple/verify` + webhooks |
| Goes in | Supabase dashboard | **Vercel** env vars |

### 1a. Open the right page

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. **Users and Access** (top nav or account menu)
3. **Integrations** tab
4. Under **In-App Purchase**, click **Generate In-App Purchase Key** (or **+**)

Direct link: https://appstoreconnect.apple.com/access/integrations/api

### 1b. Copy Issuer ID (before you leave the page)

At the **top** of the Integrations page you'll see **Issuer ID** — a UUID like `69a6de7d-...`

Save it as:

```text
APPLE_ISSUER_ID=<that UUID>
```

### 1c. Generate the key

1. Name it something like `Dayspring IAP Server`
2. Access: **App Manager** or **Admin** (default is fine)
3. Click **Generate**
4. Note the **Key ID** (10 chars, e.g. `AB12CD34EF`) — this is `APPLE_KEY_ID`
5. Click **Download API Key** → saves `AuthKey_XXXXXXXXXX.p8`

⚠️ **You can only download the `.p8` once.** Put it in 1Password or `~/Documents/keys/` — **never commit to git.**

### 1d. Add to Vercel

1. [Vercel → dayspring → Settings → Environment Variables](https://vercel.com/phillipchan1s-projects/dayspring/settings/environment-variables)
2. Add for **Production** (and Preview if you test IAP against preview):

| Name | Value |
|---|---|
| `APPLE_ISSUER_ID` | Issuer ID from 1b |
| `APPLE_KEY_ID` | Key ID from 1c |
| `APPLE_PRIVATE_KEY` | Full contents of the `.p8` file |

**`APPLE_PRIVATE_KEY` tips:**

- Paste the entire file including:
  ```text
  -----BEGIN PRIVATE KEY-----
  ...
  -----END PRIVATE KEY-----
  ```
- Vercel accepts real newlines in the value field
- Or use `\n` between lines if pasting as one line

Already set (don't duplicate):

- `APPLE_APP_APPLE_ID` = `6776925077`
- `APPLE_BUNDLE_ID` = `com.phillipchan.dayspring`

### 1e. Redeploy

Production deploys from the `stable` branch. Either:

- Push any commit to `stable`, or
- Vercel dashboard → Deployments → ⋯ on latest production → **Redeploy**

### 1f. Verify (optional)

After redeploy, a sandbox purchase should unlock the account. Before that, the verify endpoint still returns 401 without auth (that's normal).

---

## Reference

| Product ID | Price | Intro offer |
|---|---|---|
| `dayspring_monthly` | $7.99/mo | None |
| `dayspring_annual` | $69.99/yr | None |

| File | Purpose |
|---|---|
| `assets/appstore/iap-review-screenshot.png` | Subscription review screenshot |
| `assets/appstore/listing.json` | App Store listing copy |
| `docs/IOS.md` | Full technical reference |
| `npm run ios:preflight` | Automated pre-upload checks |

---

*Last updated: 2026-07-31*
