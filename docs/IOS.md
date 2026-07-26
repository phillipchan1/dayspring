# Shipping Dayspring to iOS

The same Vite bundle that runs on the web and inside the macOS app runs inside
the iOS app — Tauri v2 wraps it in a WKWebView. There is no second codebase.

| | Desktop | iOS |
|---|---|---|
| Channel branch | `master` (alpha), `stable` (beta) | `stable` only |
| Workflow | `release.yml`, `release-stable.yml` | `release-ios.yml` |
| Distribution | GitHub release + Tauri updater | TestFlight → App Store |
| Updates | silent auto-update | through the App Store (no Tauri updater) |

Pushing to `stable` now triggers three builds: alpha stays on `master`, and
Apple's review queue is not an alpha channel — so iOS never builds from `master`.

---

## One-time Apple setup

None of this can be automated; it is all in Apple's web UIs. Budget an
afternoon, plus 24–48h if the developer account is brand new.

1. **Apple Developer Program** — $99/yr, [developer.apple.com/programs](https://developer.apple.com/programs/).
   The team id is already in `tauri.conf.json` (`4629AQ24Z2`), so an account exists.

2. **Register the bundle id** — Certificates, Identifiers & Profiles →
   Identifiers → `com.phillipchan.dayspring`. Match it exactly; it is baked into
   `tauri.conf.json`, `project.yml` and the deep-link URL type.

3. **Distribution certificate** — Certificates → `+` → **Apple Distribution**.
   Download, double-click to add it to your local Keychain, then export it from
   Keychain Access as a `.p12` **with a password**.

4. **Provisioning profile** — Profiles → `+` → **App Store Connect** → pick the
   bundle id and the distribution certificate. Download the `.mobileprovision`.

5. **App Store Connect record** — [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
   → Apps → `+` → New App, with the same bundle id. Uploads are rejected until
   this record exists.

6. **API key for uploads** — App Store Connect → Users and Access → Integrations
   → App Store Connect API → `+`, role **App Manager**. Download the `.p8`
   **once** (Apple will not show it again) and note the Key ID and Issuer ID.

## Repository secrets

Add under Settings → Secrets and variables → Actions. Until all of these exist,
`release-ios.yml` still runs the compile check and then stops with a notice
rather than failing, so it is harmless to have merged early.

| Secret | Value |
|---|---|
| `IOS_CERTIFICATE` | `base64 -i dist.p12 \| pbcopy` |
| `IOS_CERTIFICATE_PASSWORD` | the password you set exporting the `.p12` |
| `IOS_MOBILE_PROVISION` | `base64 -i Dayspring.mobileprovision \| pbcopy` |
| `APPSTORE_API_KEY_ID` | the Key ID, e.g. `A1B2C3D4E5` |
| `APPSTORE_API_ISSUER_ID` | the Issuer ID (a UUID) |
| `APPSTORE_API_PRIVATE_KEY` | `base64 -i AuthKey_XXXX.p8 \| pbcopy` |

`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `RELEASES_TOKEN` are already
set for the desktop workflows and are reused as-is.

## What each run does

1. Compile-checks the Rust side for `aarch64-apple-ios` (fails fast, needs no secrets)
2. Stamps the version — marketing `major.minor.<run number>`, build number `<run number>`
3. Builds the frontend, archives, signs, exports an `.ipa`
4. Validates and uploads to TestFlight, and attaches the `.ipa` to the run

Submitting for review and releasing to the App Store stay manual buttons in App
Store Connect. Deliberately: CI ships builds, a human ships releases.

Run it by hand from Actions → *Release iOS (TestFlight)* → Run workflow.
`skip_upload` builds and signs without uploading — useful for testing signing
without burning a build number.

## Local development

```bash
npm run tauri ios dev        # simulator or a tethered device
npm run tauri ios build      # local archive
```

`src-tauri/gen/apple/` is committed (unusually — it is in `src-tauri/.gitignore`
but tracked) so CI does not have to regenerate the Xcode project. If you ever
re-run `tauri ios init`, xcodegen rewrites `Info.plist` from the `info.properties`
block in `project.yml` — which is why the purpose strings live in **both** files.

## Things Apple will hold the build for

These are policy, not code, and none of them are fixed yet. See the notes in
the PR/issue that introduced this workflow for detail.

- **Guideline 3.1.1 — in-app purchase.** The paywall sends users to Stripe
  Checkout in the system browser. For a subscription unlocking app functionality
  on iOS, Apple requires StoreKit IAP. `api/webhooks/revenuecat.ts` is already
  stubbed for this; it needs the RevenueCat SDK on the client and a platform
  split so iOS uses IAP while web/desktop keep Stripe.
- **Guideline 4.8 — Sign in with Apple.** Sign-in is Google-only, so Apple
  requires an equivalent privacy-preserving option. Supabase supports Apple as a
  provider, so this is mostly configuration plus a second button.
- **Guideline 5.1.1(v) — account deletion.** An account can be created in-app,
  so it must be deletable in-app. Settings currently offers sign-out and a
  settings reset only.
- **Privacy policy URL** — required on the App Store listing, and there is no
  privacy policy page in the repo or on the marketing site.
- **App privacy questionnaire** — declare what is collected. Journal content,
  audio and images go to OpenAI for processing; that has to be disclosed.
