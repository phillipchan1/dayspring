# iOS (Tauri) — App Store, TestFlight, IAP, Sign in with Apple

Dayspring on iPhone/iPad is the same Vite app wrapped by **Tauri 2**, not Capacitor.
Bundle ID: `com.phillipchan.dayspring` · Team: `4629AQ24Z2`

Product IDs (must match App Store Connect + code):

| Plan | Product ID | Price |
|---|---|---|
| Monthly | `dayspring_monthly` | $7/mo |
| Annual | `dayspring_annual` | $64/yr |

In-app, the first-run trial is the **app-managed reverse trial** (`ONBOARDING_REQUIRE_CARD=false`)
— never enable card-first on iOS builds.

> ⚠️ **Decide before you create the products: do NOT add a 14-day introductory
> offer on top of the app-managed trial.**
>
> Every new account already gets 14 free days in-app, granted by `ensureProfile()`
> with no card and no store involved. If the App Store products *also* carry a
> 14-day free trial, an iOS user gets **28 free days** and reaches the paywall
> having paid nothing, while a web user on Stripe converts straight to paid at
> day 14. Same product, double the free runway, entirely by accident.
>
> Recommended: create both products with **no introductory offer**, matching
> Stripe. The subscribe button then charges immediately — which is exactly what
> the paywall copy now says on iOS.
>
> If you decide you *do* want an Apple intro offer, the code already handles it
> correctly (`appleStatusToPlan` maps a `FREE_TRIAL` offer to `plan = 'trialing'`
> and records `trial_ends_at`) — but shorten the app-managed trial to match, or
> you are giving away the difference.

**IAP architecture:** StoreKit 2 on device (`tauri-plugin-purchases`) → `/api/apple/verify` (JWS + App Store Server API) → `profiles`. Lifecycle: App Store Server Notifications V2 → `/api/webhooks/apple`. RevenueCat is optional (legacy webhook at `/api/webhooks/revenuecat`); prefer the first-party Apple path.

---

## Phase A — External setup (you must do this in dashboards)

### A1. App Store Connect

1. [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) — ensure App ID `com.phillipchan.dayspring` exists with **Sign in with Apple** and **In-App Purchase** enabled.
2. [App Store Connect](https://appstoreconnect.apple.com) → **My Apps → +** → New App
   - Platforms: iOS
   - Name: Dayspring
   - Bundle ID: `com.phillipchan.dayspring`
   - SKU: `dayspring-ios`
3. **Subscriptions** → create group **Dayspring Premium**:
   - `dayspring_monthly` — $7.00 / month, **no introductory offer** (see the warning above)
   - `dayspring_annual` — $64.00 / year, **no introductory offer**
4. **Users and Access → Integrations → In-App Purchase** — create an API key (.p8). Note Key ID + Issuer ID.
5. **App Information** — note the numeric **Apple ID** (for production JWS verification).
6. **App Store Server Notifications V2** → Production + Sandbox URL:
   `https://dayspring-eosin.vercel.app/api/webhooks/apple`

### A2. Sign in with Apple (Apple Developer)

1. App ID → enable **Sign in with Apple**.
2. Create a **Services ID** e.g. `com.phillipchan.dayspring.auth`:
   - Domains: `dayspring-eosin.vercel.app`
   - Return URL: `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. Create a **Sign in with Apple Key** (.p8) → note Key ID + Team ID. Never commit the `.p8`.

### A3. Supabase Auth

Dashboard → Authentication → Providers → **Apple**:

- Enable
- Client IDs: Services ID **and** App ID `com.phillipchan.dayspring` as required
- Secret: JWT from the Sign in with Apple `.p8`
- Redirect allowlist: `https://dayspring-eosin.vercel.app/auth/callback` + web origin

### A4. Vercel environment variables

| Variable | Purpose |
|---|---|
| `APPLE_ISSUER_ID` | App Store Connect API issuer |
| `APPLE_KEY_ID` | In-App Purchase key id |
| `APPLE_PRIVATE_KEY` | Full `.p8` PEM contents |
| `APPLE_APP_APPLE_ID` | Numeric App Store app id (production verify) |
| `APPLE_BUNDLE_ID` | Optional; defaults to `com.phillipchan.dayspring` |
| `REVENUECAT_WEBHOOK_SECRET` | Legacy — unused by the first-party Apple path |

Also ensure iOS **build-time** `.env.local` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

Optional client overrides:

| Variable | Default |
|---|---|
| `VITE_APPLE_IAP_MONTHLY_PRODUCT_ID` | `dayspring_monthly` |
| `VITE_APPLE_IAP_ANNUAL_PRODUCT_ID` | `dayspring_annual` |
| `VITE_TERMS_URL` | `/terms` (served from `public/legal/terms.html`) |
| `VITE_PRIVACY_URL` | `/privacy` (served from `public/legal/privacy.html`) |

The legal pages are hosted by our own Vercel app — `dayspring.app` does **not** resolve, so
any link pointing there is dead and would fail review. `vercel.json` rewrites `/terms` and
`/privacy` to the static files; `lib/legal.ts` makes them absolute inside Tauri.

Apply BOTH migrations to Supabase, in order:

1. `20260730120000_apple_iap_columns.sql` — extra Apple columns on `profiles`
2. `20260730130000_apple_original_txn_unique.sql` — makes `apple_original_txn` **unique**, so one
   App Store subscription can never entitle two Dayspring accounts (the classic
   "signed in with Google, then with Apple, then tapped Restore" double-entitlement).
   It aborts with the offending ids if duplicates already exist.

Per the memory note on this project: apply these in the Supabase **SQL editor**, not via `db push`.

---

## Local / TestFlight commands

```bash
# Dev on simulator or plugged-in device
npm run tauri:ios:dev

# Release IPA for App Store Connect / TestFlight
# Build number must exceed the last uploaded CFBundleVersion (last known: 0.1.0)
npm run tauri:ios:build -- --build-number 207 --verbose
```

IPA path: `src-tauri/gen/apple/build/arm64/Dayspring.ipa`

Upload with **Transporter**, then App Store Connect → TestFlight → Internal Testing.

> **Note:** If Xcode/Transporter says your Apple ID session expired, open Xcode → Settings → Accounts and re-sign in before uploading.

Sandbox IAP: iPhone Settings → App Store → Sandbox Account.

After `tauri ios init`, re-check `gen/apple/app_iOS/Info.plist` for the privacy keys and `dayspring://` URL scheme (Tauri merges `Info.ios.plist` inconsistently; the committed file is the source of truth — patch the generated plist if keys are missing before shipping).

### Pre-upload checklist

- [ ] Sign in with Apple (cold start + return from Safari)
- [ ] Google sign-in via deep link
- [ ] Mic / photo permission prompts (no crash)
- [ ] Sandbox purchase monthly + annual unlock entitlement
- [ ] Restore purchases after reinstall
- [ ] No Stripe checkout links reachable on iOS
- [ ] App-managed 14-day trial still granted on first sign-in

**App Store Review Guideline 3.1.2** — the most common rejection reasons for a
subscription app. `AppleSubscriptionTerms` renders the disclosure and both links
on every screen that sells; verify they actually work on device:

- [ ] Paywall shows length, price and that it auto-renews, before purchase
- [ ] Prices come from StoreKit (not hardcoded `$64`/`$7`) — check on a non-US sandbox storefront
- [ ] `https://dayspring-eosin.vercel.app/terms` and `/privacy` both return 200 **after deploy**
- [ ] Both links open in Safari from the iOS paywall, not a dead tab inside the webview
- [ ] Swap the contact address in both pages if you don't want a personal Gmail public
- [ ] "Restore purchases" is visible without scrolling past the buy buttons

**Cross-platform entitlement** — guideline 3.1.3(b) lets us honour a web
purchase, but only if we never steer users off-platform to buy:

- [ ] A Stripe subscriber signing in on iPhone is entitled with no paywall shown
- [ ] An Apple subscriber on web/desktop sees "manage in App Store", never the Stripe portal
- [ ] `/api/stripe/checkout` returns 409 `managed_by_apple` for an Apple-billed account
