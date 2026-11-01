# Native-feel audit

> **Run 1 — 2026-11-01.** Static read of `src/`, `src-tauri/` and `index.html` in
> four slices, plus a live pass of the shell (`?__preview=screens`, desktop and 375pt).
> Measured against [`docs/product/DESIGN_PRINCIPLES.md`](product/DESIGN_PRINCIPLES.md):
> **behave like the platform, look like Dayspring.** Items marked *(verify)* were
> inferred from code and need a device check before fixing.

The short version: Dayspring is already unusually careful in the places most web
wrappers ignore: native caret, inline predictions and Writing Tools, a pinned shell,
`useSwipeToDismiss` physics, scroll restoration, the iPhone reader push, a privacy screen
and a cache-first launch. What gives it away is **a handful of global defaults**
(hand cursor, selectable chrome on the Mac, unguarded hover, no press states, no exit
animations) and **the missing OS layer** (menu bar, window state, theme-synced native
chrome, haptics, native capture). Fixing about ten things removes most of the "web" feel.

Severity: **P0** says "website" on first use · **P1** an attentive user notices · **P2**
polish. Platform: 🖥 Mac · 📱 iOS · both if unmarked.

---

## The ten that matter most

| # | Fix | Sev | Where | Principle |
|---|---|---|---|---|
| 1 | **Arrow cursor on controls (Mac).** One global rule plus about 280 local `cursor: pointer`s give every button the link hand. | P0 🖥 | `global.css:126-129` | N1 |
| 2 | **Chrome is selectable on the Mac.** The `user-select: none` chrome rule only exists inside `@media (pointer: coarse)`, so a triple-click paints the top bar blue (confirmed live) and ⌘A selects the UI. | P0 🖥 | `global.css:2114-2176` | N1 |
| 3 | **A real menu bar.** No `.menu()` is built; the app ships Tauri's default (no Settings…, no File/Format/Go). Generate it from `shortcuts.ts`. | P0 🖥 | `src-tauri/src/lib.rs:900-911` | N4 |
| 4 | **"Inspect Element"/"Reload" in right-click menus.** The `devtools` Cargo feature enables the inspector in release, and the context-menu guard is only installed inside `JournalScreen`/`PageWall`, so sign-in, onboarding, paywall, lock and error screens show WebKit's menu. *(verify on a stable build)* | P0 🖥 | `Cargo.toml:27`, `JournalScreen.tsx:362-371` | N1 |
| 5 | **Hover guarded, press states added.** About 380 `:hover` rules, about 25 inside `@media (hover: hover)`. Few `:active` states; the grey tap-highlight is only cleared on a few elements. Hover sticks on iPad/iPhone and taps feel dead. | P1 📱 | global; see §2 | N2 |
| 6 | **Exit animations.** Settings, Shortcuts, context menus, the You menu and capture sheets have entrances but unmount instantly. Mac menus do the reverse of NSMenu (animate in, vanish out). | P1 | `JournalScreen.tsx:3277,3303`, `global.css:956,4233` | N3 |
| 7 | **Native chrome follows the theme.** No `setTheme()` on the Mac window and no `overrideUserInterfaceStyle` on iOS, so the status bar, keyboard, traffic lights, native menus and Writing Tools stay in the *system* appearance when the voice differs. No `tintColor`, so iOS selection handles are system blue against a gold caret. | P1 | `App.tsx:72-90`, `lib.rs` | N8 |
| 8 | **Launch without the white frame.** The window `show()`s before first paint, there's no `backgroundColor`, and the iOS launch screen and opaque WKWebView are system white. | P1 | `lib.rs:950-955`, `tauri.conf.json`, `LaunchScreen.storyboard:18` | N5 |
| 9 | **Haptics.** None exist. Add `@tauri-apps/plugin-haptics` behind one `haptic()` helper and wire the moments in §8. | P1 📱 | — | N6 |
| 10 | **Paywall buys on touch-down.** `useTapAction` commits on `pointerdown` for touch (deliberate, for an iPad click bug), so a scroll starting on a plan tile can open StoreKit. Money and auth buttons must commit on touch-up-inside with a movement threshold. | P0 📱 | `lib/tapAction.ts:27`, `PaywallScreen.tsx:105-110`, `LockedScreen.tsx:241-251` | N2 |

Items 1, 2 and 5 are mostly mechanical CSS and can land in one PR. Item 3 is the largest
single "this is a Mac app" upgrade.

---

## 1. App, not a page (N1)

| Sev | Where | Problem → fix |
|---|---|---|
| P0 🖥 | `global.css:126-129` + ~280 local rules | `cursor: pointer` on every control → under `html[data-platform='desktop']`, `:is(button,[role=button],[role=menuitem],[role=tab],[role=option],[role=switch],[role=checkbox],label){cursor:default}`. Keep `pointer` for `a[href]` and inline scripture refs. Includes in-editor widgets: `lineMenu.ts:115`, `taskListExtension.ts:186`, `attachmentImageExtension.ts:937,1190`, `spiritualBlockDecoration.ts:393,465,502`. |
| P0 🖥 | `global.css:2114-2176` | Move the chrome `user-select:none` + `-webkit-touch-callout:none` list and its prose opt-back-in out of the coarse-pointer query. Better: `body{user-select:none}` with `.cm-content`, `.markdown-body`, `[data-selectable]` and verse/quote classes opted back in. Add portaled popovers to the list (`.slash-palette`, `.format-bar`, `.link-popover`, `.voice-capture`, `.page-scan`). |
| P1 🖥 | `index.html` / global | No themed `::selection` outside the editor; a stray selection shows browser blue (seen live) → `::selection { background: var(--selection-bg) }` globally. |
| P2 🖥 | global | Drag ghosts: links and images in chrome are draggable (`volumes/Cover.tsx:66`, `ascent/ledger/SpanPhotos.tsx:40`, Settings help links) → `a,img,svg{-webkit-user-drag:none}` in chrome; `draggable={false}` on those images. |
| P1 📱 | `global.css:1980` (only `.mobile-tab`) | Grey tap flash everywhere else → `html{-webkit-tap-highlight-color:transparent}` once. |
| P1 | `entryActions.ts:140-141` | **Print… does nothing**: `window.open(..., 'noopener')` returns null → print from a hidden same-origin iframe (native print panel / AirPrint); bind ⌘P. |
| P2 | `ErrorBoundary.tsx:99-107` | "Reload" + `location.reload()` → "Restart Dayspring" via `relaunch()` from `plugin-process` in Tauri. |
| P2 🖥 | `LockedScreen.tsx:222-231`, `DeleteAccountFlow.tsx:63-71` | Backup via blob `<a download>` probably does nothing in WKWebView while the UI says "✓ Backup downloaded" *(verify)* → native save panel (`plugin-dialog` + `plugin-fs`) on Mac; share sheet / Files on iOS. |
| P2 | ~95 `title=` attrs (e.g. `StatusCluster.tsx:78`, `RitualThreads.tsx:150,283`, `attachmentImageExtension.ts:243`) | Essential info only reachable by hover. Fine as a Mac extra; move anything essential into visible text. Remove the photo "Click for options · drag to move" tooltip. |
| P2 | `LifeMap.css:169` | `cursor: help` → default arrow. |

## 2. Press, hover, focus (N2, N7)

| Sev | Where | Problem → fix |
|---|---|---|
| P1 📱 | global.css (`.btn:157`, `.pill:2711`, `.segmented__btn:3349`, `.settings-nav__item:4360`, `.font-picker__option:2964`…), `You.css:56,125`, `ThemePicker.css:32`, `Pages.css` (71 hover / 3 guarded), `Ascent.css` (34 / 0), `Ledger.css`, `Scripture.css`, `Volumes.css`, `LifeMap.css`, `Welcome.css`, `Onboarding.css`, `format-bar:1426`, `Passage.css:125` | Wrap every `:hover` in `@media (hover: hover)`. The tapped card, B button or verse stays "on" after a tap today. |
| P1 | `.btn`, `.pill`, `.toggle-pill`, `.segmented__btn`, `.settings-nav__item`, `.switch`, `.you__item`, `.voice-row`; Ascent/Ledger rows; Rituals rows; Scripture tiles; Volume cards; Life Map chips; Find rows | No `:active` → instant-in wash or ink shift on press (0ms in, ~150ms out) in Dayspring tones. `.altar-strand:active` (`Altar.css:728`) is the model. |
| P0 🖥 | `Pages.css:3827-3861` | **Hover-lift on wall cards**: `translateY(-3px)` + big shadow + `will-change` on hundreds of cards, contradicting the file's own rule at `:878`. Delete; keep the warm wash at `:905-919`. |
| P1 | `Volumes.css:42`, `Scripture.css:84-87,478,546`, `Ascent.css:370,455`, `Altar.css:274,565`, `Paywall.css:376,575`, `Welcome.css:290,333`, `Onboarding.css:257,327` | Same lift or scale-on-hover pattern → border or wash only. Native controls don't levitate. |
| P1 | `Scripture.css:639` | Hover adds `padding-left`, reflowing the row → inset accent rule, no geometry change. |
| P1 📱 | `Pages.css:3850` | `.pgc:active` lifts → touch-down *darkens* (as narrow rows already do, `:6497`). |
| P2 🖥 | `global.css:2072-2077,1009` | Press scales `.rail-btn` / menu items. Mac presses tint, they don't shrink → tint on desktop, keep the scale on touch. |
| P1 | `SettingsPanel.tsx:136`, `ShortcutsOverlay.tsx:23` | `aria-modal` without focus trap or `inert` → `inert` on the shell while open; focus in on open, back to the opener on close. |
| P2 🖥 | `global.css:2883` | `.settings-select:focus` ring on click → `:focus-visible`. |
| P1 📱 | `taskListExtension.ts:50-54,74` | Checkbox toggles on touch-*down* (a scroll ticks it), focuses the editor (raises the keyboard while reading), and has a ~17px hit area → `editorTap()`, no focus if not already focused, 44pt `::before`. |
| P2 📱 | `LifeMap.css:156,261`, `PageScanCapture.css:71`, `Scripture.css:689` | Sub-44pt targets (ⓘ 15px, chip × 14px, scan × 20px, chapter cells 26px) → pad the hit area, not the glyph. |

## 3. Motion (N3)

| Sev | Where | Problem → fix |
|---|---|---|
| P1 | `themes.css:122-123` + ~340 transition decls | Two tokens, ~25 distinct durations, ~57 hand-written curves → a motion scale: `--dur-quick 120ms`, `--dur-base 200ms`, `--dur-push 300ms` (iOS push curve `cubic-bezier(.32,.72,0,1)`, already used at `global.css:3051`), `--dur-sheet 380ms`, `--ease-out-soft`, a `linear()` spring. Replace literals. |
| P1 | see top-10 #6 | Exit phases: keep nodes mounted until `animationend`. iOS sheets slide down the way they came; Mac dialogs fade/scale out in about 150ms. |
| P1 🖥 | `global.css:956,999-1003,5894` | Context menu and slash palette: appear instantly, fade out about 150ms, row highlight with **no** transition. |
| P2 | `SelectionFormatBar.tsx:383,413,440,492`, `global.css:1410-1425` | Staggered per-button pop-in on the format bar → appears in one piece. |
| P1 📱 | `useSheetDismiss.ts:29,90,94-97` | Sheets dismiss on distance only (110px), no velocity flick, no rubber-band, vanish where the finger let go, `setState` per `touchmove` → port `useSwipeToDismiss`'s velocity projection, leaving phase and rubber-band; write `transform` directly. Covers Settings, entry/image sheets, CommandPopover, capture sheets. |
| P1 📱 | `Pages.css:5873-5885` | iPhone push slides the reader over a static wall → parallax the wall about −30% and dim it, tied to `--pg-out` during swipe-back. *(Native wins over the existing comment; it's a geometry cue.)* |
| P2 | `Pages.css:5874`, `global.css:3051`, `Scripture.css:345` | Push/pop timings differ (260 / 220 / 420ms) → one `--dur-push`; the book panel uses `useSwipeToDismiss({exit:true})`. |
| P2 | `Ascent.css` `ascent-rise` (`:171,247,291…`), `Pages.css:4703`, `Scripture.css:106` (2.6s × 3 glow), `Welcome.css` (staggers to 1.5s) | Decorative entrances that replay every visit → first visit only; cap ceremonial entrances at about 600ms with title and body visible immediately. |
| P1 | `WelcomeFlow.tsx:489` vs `Welcome.css:1066` | JS waits 760ms while the reduced-motion exit is 280ms; input is blocked → drive from `animationend`. |
| P2 | `Ledger.css:625`, `PracticeLibrary.css:323`, `global.css:5690,5740` | `transition: all` → named properties. |
| P2 | `global.css:142-150` | Reduce Motion deletes *all* transitions → swap movement for crossfades so spatial cues survive. |
| P2 | `global.css:3344,2714` | Segmented and pill selection jumps → one sliding selection plate. |
| P2 | `typewriter.ts:111-145` | An extra scroll transaction after every keystroke and a snap per wrapped line → only when the line block changes, with a ~120ms eased glide. |

## 4. Mac grammar (N4)

| Sev | Where | Problem → fix |
|---|---|---|
| P0 | `lib.rs:900-911` | **Menu bar**: Dayspring (About, Settings… ⌘,, Check for Updates…) · File (New Entry ⌘N, Close ⌘W, Export…, Print… ⌘P) · Edit (standard + Spelling/Substitutions/Transformations/Speech, Find ⌘F, Find or Ask ⌘K) · Format (Bold, Italic, Underline, Highlight ⇧⌘H, Link ⌘K) · View (Focus ⌘↩, text size, Full Screen ⌃⌘F) · Go (rooms ⌘1-5, Back ⌘[) · Window · Help (Keyboard Shortcuts). Built in Rust and emitting to JS; items generated from `shortcuts.ts`. |
| P1 | `global.css:3060-3105` | `-webkit-app-region` is ignored by WKWebView; only `data-tauri-drag-region` drags. The window can't be dragged from Pages (the default surface), Settings, Life Map, Rituals or any `.center-screen` → add the attribute to those headers, or a 28px drag strip under the traffic lights everywhere. Also restore a strip in settled mode (`global.css:3146-3152`). |
| P1 | `lib.rs:979-993` | ⌘W hides the app even with Settings open → close the top overlay first; ⌘. = Esc. |
| P1 | `tauri.conf.json:13-24` | No window size or position restore → `tauri-plugin-window-state`. |
| P1 | `EntryContextMenu.tsx:93-160`, `EntryBulkMenu`, `ImageContextMenu`, `YouMenu.tsx:108-127`, `WritingFontPicker.tsx:148` | Menus have no ↑/↓, type-ahead, Return, or press-drag-release, and auto-highlight the first item on right-click → one shared `useMenuKeyboard`; commit on `pointerup` for right-click menus; highlight the first item only when opened by keyboard. *Keep the glass look; don't switch to `Menu.popup()`.* |
| P1 | `global.css:922-929` | Context menu dims and blurs the window and eats the next right-click → transparent backdrop; a right-click elsewhere re-targets. |
| P1 | `find/FindPalette.tsx:212,237` | `onMouseEnter` steals the keyboard selection when results scroll under a resting pointer → `onMouseMove`. Selected row in theme accent, not grey (`Find.css:123`). First Esc clears, second closes. |
| P2 | `Find.css:9-28` | ⌘K palette blurs the whole window and fades in over 200ms → no window blur, about 80ms opacity. |
| P1 | `Editor.tsx:795`, `SelectionFormatBar.tsx:183-212` | Format bar chases the selection *during* a drag, ⇧-arrow and ⌘A → show after the selection settles (pointerup or ~350ms idle); never for ⌘A. View-side only. |
| P1 | `Editor.tsx:423-440` | Right-click shows the format bar *and* the native menu, and moves the caret (killing spelling suggestions) → native menu only on right-click. |
| P1 | `Editor.tsx:623` (defaultKeymap) | **⌥↑/↓ moves the line; ⇧⌥↑/↓ duplicates it**: a writer reaching for paragraph navigation reorders their entry → paragraph start/end and extend. ⌥⌫ / ⌥← stop at apostrophes → `Intl.Segmenter` word commands. Drop code-editor bindings (⌘/ comment, ⌘⇧K delete line); ⌃L = centre; Home/End scroll only. |
| P1 | `SelectionFormatBar.tsx:336-344`, `SlashPalette.tsx:95-114,198` | Caret-summoned bar can't be driven by keyboard; slash palette detaches on scroll and stays open on ⌘Tab; commits on mousedown → roving ←/→ + Return; close on scroll and blur; commit on mouseup. Esc closes a selection-triggered bar too. |
| P2 | — | Inactive window: listen to `onFocusChanged`, set `html[data-window-inactive]`, and mute selection/accent (editor `::selection:window-inactive`, wall `Pages.css:989`, rail). |
| P2 | `platform.ts:85-98` | Traffic-light clearance stays in full screen → zero it under `html[data-fullscreen]`. Set `trafficLightPosition` to centre the lights on the frame bar row. |
| P2 | `PageWall.tsx:1206-1278` | No type-to-select; Space = open → Space = Quick Look-style peek (reuse `PhotoPeek`), Return/⌘↓ = open. No ⌘[ / mouse back button anywhere → bind to "up one layer". |
| P1 | `applock/biometric.ts:42,70` | No Touch ID on the Mac lock → small LocalAuthentication command. |
| P2 | `EntryContextMenu.tsx:116-121` | Return confirms *delete* → Cancel is the default; ⌘⌫ confirms. |
| P1 | `SignIn.tsx:56-60,333-353` | Mac OAuth bounces to the browser with "Open again / Cancel" → `ASWebAuthenticationSession` sheet (as iOS already does). |

## 5. iOS grammar (N4)

| Sev | Where | Problem → fix |
|---|---|---|
| P0 *(decision)* | `lib.rs:249-300` | The system edit menu is suppressed process-wide; the HTML format bar replaces it. This loses Writing Tools from the menu, AutoFill, Scan Text, Paste and Match Style and third-party actions, and may break **paste from other apps** (WebKit's paste-permission callout is a `UIEditMenuInteraction`) *(verify)*. Recommended: return `suggestedActions` plus a Dayspring group as `UIAction`s; the glass bar becomes the "Format…" page. See Rulings in DESIGN_PRINCIPLES. |
| P0 | `selectionEdit.ts:24-32` | Bar Paste uses `navigator.clipboard.readText()` and skips CodeMirror's paste pipeline (no scripture/image paste handling, no `userEvent`) → `input.paste` userEvent; native pasteboard read if the custom bar stays. |
| P1 | `SlashPalette.tsx:151`, `Editor.tsx:622` | "No undo on mobile": shake, three-finger and iPad ⌘Z don't see programmatic edits → bridge CM history to the web view's `undoManager`. |
| P1 | `CommandToolbar.tsx:272-279`, `useKeyboard.ts`, `lib.rs:194` | Accessory bar docks *after* the keyboard animation and snaps → a real `inputAccessoryView` in Dayspring colours, or drive from `keyboardWillChangeFrame` with UIKit's curve. |
| P1 | `lib.rs:61-63` + inner scrollers | Status-bar tap does nothing → `scrollViewShouldScrollToTop:` → JS `scrollToTop()` on the active surface. |
| P0 | `PageScanCapture.tsx:212-218` | Page scan is `<input capture>`, one shot at a time, no deskew → `VNDocumentCameraViewController`, feeding `transcribePages`. |
| P1 | `InlineImagePopover.tsx:110-124` | Image insert = popover → dropzone → WebKit file sheet → picker → `PHPickerViewController` directly. |
| P1 | `useDictation.ts:259-265`, `:177` | Mic denied offers "Try again" (can't succeed) → "Open Settings". WebKit may show a second "localhost would like to access the microphone" prompt *(verify; P0 if so)* → grant in the `UIDelegate`. |
| P1 | `PhotoViewer.tsx:166-186`, `index.html:5` | Photo viewer: no pinch or double-tap zoom, swipe judged only on release, wraps last→first, opens with a fade → live-tracked paging, pull-down-to-shrink dismissal, FLIP zoom from the thumbnail, Space = Quick Look on Mac. |
| P1 | `attachmentImageExtension.ts:903-905`, `global.css:2169-2176` | Tap on a photo opens *options* (via a ~300ms compat click); long-press raises WebKit's image callout → tap = viewer, long-press / right-click = options. |
| P1 | `EntryContextMenu.tsx:31-38,225-260`, `useWallPointer.ts:13,57-61` | Long-press = bare 500ms timer → action sheet. Native: shrink while held, lift a preview, dim the backdrop, compact menu, medium haptic. Keep the sheet for "⋯". |
| P1 | `Pages.css:2726` / `PageRow.tsx` | No swipe actions on rows → trailing swipe for existing verbs (danger/accent tints). |
| P1 | `PagesView.tsx:1503-1531`, `RitualThreads.tsx:157-178`, `OnboardingFlow.tsx:155,183,204` | Shelf→Volume, Practices→thread and onboarding steps swap in place with text "← Back" links, no push, no edge swipe, leaked scroll → reuse the reader push + `useSwipeToDismiss`; key the scroller; top-leading back control. |
| P1 | `Pages.css:5228-5233`, `PageReader.tsx:227-240` | Reader prose is `pointer-events:none` on touch (for the full-surface swipe), so **you can't select your own words** → edge-strip swipe (~24pt), prose selectable. |
| P1 | `DrillSheet.tsx:28-40` | Ascent drill-ins are centred cards with no swipe and no exit → render like `WriteSheet` (grabber, drag, slide-out). |
| P1 | `Pages.css:2246`, `LookFor.tsx:647` | Look-for sheet *drops in* 3px and unmounts on close → slide up from 100%, slide out. |
| P2 | `global.css:4241-4294` | Settings is a full-height sheet with its grabber under the status bar → stop ~10pt below safe-top, recess the shell (scale ~0.94, rounded) behind it. Phone Settings as a grouped inset list that pushes panes. |
| P1 | `WelcomeFlow.tsx:556-566`, `FirstLight.tsx:112-185` | Welcome swipe judged on release only; What's new has no swipe at all → finger-tracked paged track with spring settle; swipe down dismisses What's new. Pin CTAs to the bottom safe area (`Onboarding.css:11-17`). |
| P1 | `applock/LockScreen.tsx:63-140` | PIN is a masked field + "Open" → gold dots that fill, auto-submit on the last digit, damped shake + error haptic on a wrong PIN. *(House look, native behaviour.)* |
| P1 | `PaywallScreen.tsx:128-152` | Every price tile is a buy button → selectable plan rows + one pinned Subscribe (StoreKit pattern). Stripe path never clears `loading` after returning (`:71-72`). |
| P1 | `SignIn.css:148-174` | **Sign in with Apple uses the gold outline** → solid black/white per Apple's HIG. App Review risk; native wins. |
| P2 | `SignIn.tsx:211`, `DeleteAccountFlow.tsx:167-180`, `FindPalette.tsx:167`, `LookFor.tsx:688`, `LifeMapView.tsx:124`, `Paywall.css:1006`, `LinkPopover`/`Capture.css` inputs | Return keys that do nothing, search fields without `type=search` / clear button / `autoCorrect=off`, inputs under 16px hidden behind `maximum-scale=1` → fix per field; then `user-scalable=no` can go. |
| P2 | `global.css:4134-4139` | Tab labels about 9.9px with no selected glyph weight → 10-10.5px, weight 500, heavier stroke when active. Mono stays. |
| P2 | `index.html:5` | No Dynamic Type for chrome → `html{font:-apple-system-body; font-family:var(--font-sans)}` on iOS, bounded. |
| P2 | `iPad` | Pinch on the wall (`PageWall.tsx:853-865` is ctrl+wheel only); `UIKeyCommand`s for editor shortcuts so they appear in the ⌘-hold overlay; voice/scan as popovers or form sheets; FindPalette focus outside the gesture may not raise the keyboard *(verify)*. |

## 6. Instant, then honest (N5)

| Sev | Where | Problem → fix |
|---|---|---|
| P1 | see top-10 #8 | `visible:false` + themed `backgroundColor`; JS calls `show()` after the first painted frame. iOS launch screen in a Dayspring ground; WKWebView non-opaque with a matching background. |
| P1 | `ScriptureBookView.tsx:116-119,238`, `useLifeMap.ts:120` | Every open nulls data → "Reading…" → pop-in → cache in `asyncCache` and paint instantly, refresh behind. |
| P1 | `attachmentImageExtension.ts:279-285,1100-1108` | Photos reserve a fixed 120px then jump on decode, shifting the caret line → `width`/`height`/`aspect-ratio` from stored dimensions. |
| P1 | `LifeMapView.tsx:75-77` | Add/remove wait on two round trips and swallow errors → optimistic with Undo; roll back visibly. |
| P1 | `ScriptureBookView.tsx:113-135` | A second book opens at the previous book's scroll offset → reset on `bookOsis` change. |
| P2 | `ChapterPane.tsx:123` | "Loading…" text → line placeholders at verse height. |
| P2 | `LockedScreen.tsx:450` | Manual "Refresh" control → already refetched on focus; remove or demote. |
| P2 | `Editor.tsx:686-688,785` | Duplicate-UUID filter reparses the whole document on every keystroke (latency grows with length) → early-out unless a fence is touched. *(Principle 3.)* |

## 7. Depth and materials (N8)

| Sev | Where | Problem → fix |
|---|---|---|
| P2 | `You.css:89-103` vs `global.css:938-957` | Two menu materials (solid vs glass) → one `--surface-3` glass for every menu and popover. |
| P2 | global | No elevation scale; ad-hoc shadows → `--surface-0…4` built on the glass tokens, per voice. |
| P2 | `global.css:4162-4182` | FAB uses `--shadow-3`, the most Material thing on screen → softer shadow, press haptic. *(Open ruling.)* |
| P2 | `Pages.css:6112-6119` | Reader bar is opaque paper → optionally blur only once scrolled. House mostly wins. |

## 8. Haptics map (N6)

One helper, `haptic(kind)`, fire-and-forget, `prepare()` on press. Never on typing,
scrolling or B/I/U.

| Kind | Moments |
|---|---|
| **selection** | tab change (`MobileJournal`), slash command commit, segmented/pill/period change (`WhenControl`), year scrubber step, wall zoom crossing cards↔rows, page turn, subject pill lit, multi-select toggle, photo page change, photo reorder slot change, Welcome page settle, switch toggle |
| **light** | task checkbox, sheet/swipe crossing its dismiss point (once per crossing), FAB press, Done in voice, photo dropped, Altar "yes", Life Map chip added/removed |
| **medium** | long-press menu opens, voice recording actually starts, photo lifts for reorder |
| **success** | purchase/restore succeeds, scan transcription ready, sign-in, PIN saved |
| **warning** | delete confirmed, purchase pending, DELETE typed in account deletion |
| **error** | wrong PIN (with shake), transcription failed, sign-in error, restore found nothing |

No haptic on a Face ID match (the system gives one) or as a reward. Principle 2.

---

## Already native (protect these)

- Native OS caret; `autocorrect`/`spellcheck`/`writingsuggestions`, inline predictions
  and Writing Tools enabled; `proseHighlighting` leaves the word being typed undecorated.
- `pointerInput.ts` input model (touch acts on release, compat clicks swallowed); toolbar
  buttons preserve the caret and keyboard.
- Pinned shell with no document scroll or bounce; inner scrollers bounce; native overlay
  scrollbars.
- ⌘W hides (not quits) and the Dock reopens; overlay title bar; traffic-light tokens.
- iOS: viewport reclaim, privacy screen, accessory bar suppressed, ⌘, on iPad, re-tap a
  tab to pop to root and scroll to top, the nav steps aside for the keyboard.
- `useSwipeToDismiss`: velocity projection, point of no return, leaving phase. **The
  model for every other gesture.**
- iPhone reader push and swipe-back; exact scroll restoration from reader to wall; the wall's
  keyboard and marquee selection (Finder-like); trackpad pinch-to-zoom the wall; two-finger
  page turns.
- Theme resolved before paint; cache-first launch; `SurfaceLoader` is never a spinner.
- No `alert`/`confirm`/`prompt`; external links via the opener; `dropGuard`.
- Sign-in fields tuned for password managers; StoreKit-localised prices; Restore
  purchases; Apple's manage-subscriptions sheet.
- `:focus-visible` used almost everywhere; reduced motion honoured broadly.

## Housekeeping found along the way

- `src/features/reflect/Reflect.css` (685 lines) has no importer. Delete it.
- `.entry-list__*` / `.entries-panel*` in `global.css` (~311-920, 2316-2364) has no TSX
  references. Deleting it removes about a dozen unguarded `:hover`s.
- Voice and scan aren't on the Mac yet; if they ever are, the Mac needs
  `NSMicrophoneUsageDescription` / `NSCameraUsageDescription` and the audio-input and camera
  entitlements first.

## Suggested order

1. ✅ **CSS defaults** (2026-11-01):
   - Arrow cursor on every control; link-styled text buttons keep the hand.
   - `body` is unselectable on every platform, with an allow-list for the user's own
     words; themed `::selection`; no tap flash.
   - Every CSS `:hover` is guarded at build time (`scripts/postcss-hover-guard.ts`),
     and the editor's TypeScript hovers by hand.
   - Shared `:active` press wash; hover-lifts removed (the wall keeps its warm shadow);
     no `transition: all`.
   - Tripwires: `src/styles/nativeFeel.test.ts`.
   - Still open from §2: per-surface `:active` states on Ascent/Ledger/Rituals rows,
     Scripture tiles, Life Map chips and Find rows; focus trap and `inert` for modals.
2. **Mac shell PR**: menu bar from `shortcuts.ts`, drag regions, window-state, theme
   sync, white-flash fix, devtools gating, global context-menu guard, ⌘W/⌘. layering.
3. **Motion PR**: tokens, exit phases, menu timing, `useSheetDismiss` physics.
4. ✅ **Touch-up-inside for money and auth buttons** (2026-11-01): `useTapAction`
   commits on release only. It lets go when the finger travels more than 10px or the
   press becomes a scroll, and keeps every iPad release path from #84/#86. Needs an
   on-device pass on the paywall and sign-in before shipping to `stable`.
5. **Haptics PR**: plugin + helper + the map above.
6. **iOS native capture**: VisionKit scan, PHPicker, accessory view, edit-menu ruling.
7. **Lists & navigation**: long-press previews, swipe actions, push for Volumes/Rituals,
   reader selection, menu keyboard nav, editor keymap fixes.
