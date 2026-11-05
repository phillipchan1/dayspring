# Design Principles — Native Feel

> **Status:** Draft 1, 2026-11-01. Written alongside the first native-feel audit
> ([`docs/NATIVE_FEEL_AUDIT.md`](../NATIVE_FEEL_AUDIT.md)), which is the record of where
> the app stands against these today. The audit changes; these shouldn't, often.

[`PRINCIPLES.md`](./PRINCIPLES.md) settles *what* Dayspring does. This doc settles *how
it feels in the hand*. The bar: someone using Dayspring on a Mac or an iPhone should
never get the thought *"oh, this is a website."* Not because they inspected it, but
because nothing it does is something only a web page does.

## The one rule

**Behave like the platform. Look like Dayspring.**

Native feel lives in *behaviour*: how fast things answer a press, how they move, what
the keyboard does, what a long-press offers, what a stray click selects. Those we take
from Apple, exactly. Identity lives in *appearance*: the faces, the voices, the palette,
the dawn glow, the pace of the ceremonial moments. Those stay ours. We are not trying to
look like Notes. We are trying to be as trustworthy under the finger as Notes, while
looking like nothing else.

| We take from the platform | We keep as Dayspring |
|---|---|
| Press, hover, focus and selection *behaviour* | Typefaces: Newsreader, Fraunces, Inter, and each voice's own face |
| Motion timing and physics for utility UI (menus, sheets, navigation) | The voices and their palettes; accent stays the theme's, never system blue |
| Gestures: swipe-back, drag-to-dismiss, long-press, pinch | Iconography and the Mark |
| Keyboard grammar: menu bar, ⌘-shortcuts, arrow keys, Esc, Tab | Materials: glass, grain and glow, tinted by the voice |
| Hit targets, safe areas, keyboard avoidance | The slower pace of ceremonial moments (welcome, rituals, What's new) |
| OS integration: menu bar, haptics, share sheet, Writing Tools, window restore | Copy and vocabulary (see [`BRANDSCRIPT.md`](./BRANDSCRIPT.md)) |

When the two genuinely conflict, see **Rulings** at the bottom. Don't improvise a third
answer.

---

## N1. An app, not a page

Chrome is not a document. Nothing outside the writing and the reading should behave
like web content.

**Forbids:**
- **Selectable chrome.** Bar labels, buttons, nav, headings and counts are
  `user-select: none`. Only the writing, the reading, and text a person would plausibly
  copy (a quote, a verse, an email address) are selectable. A stray triple-click must
  never paint the top bar blue.
- **The hand cursor on controls.** Mac controls use the arrow. `cursor: pointer` is for
  real hyperlinks only. It's the most visible web tell on the Mac, and it currently
  comes from one global rule.
- **Drag ghosts.** Images, icons and links in chrome are not draggable
  (`-webkit-user-drag: none`, `draggable={false}`), unless dragging them does something.
- **Browser behaviour leaking through.** No default browser context menu, no
  `alert`/`confirm`/`prompt`, no ⌘R reload, no browser ⌘F find, no ⌘± page zoom, no
  pinch-zoom of the shell, no iOS link-preview callout on chrome
  (`-webkit-touch-callout: none`), no grey tap-highlight flash.
- **Default selection colour.** `::selection` and the caret use the theme's accent,
  never the browser's blue.
- **The document scrolling.** The shell never scrolls or rubber-bands. Inner scrollers
  do, with momentum. (Already true; keep it.)

**Costs us:** a CSS reset and a `user-select` default to maintain, plus a small amount of
care whenever we add something people *should* be able to copy.

**Test:** Select-all (⌘A) with focus outside the editor, then triple-click every bar.
Does anything highlight that isn't writing or reading?

---

## N2. Answer the press, not the release

Native controls react the instant a finger or mouse goes down. Web controls react on
hover and fire on release, so a press feels like nothing happened.

**Requires:**
- Every pressable thing has a `:active` state: a dim, darken or slight inset that
  appears on touch-down. iOS rows and cells highlight on touch-down and unhighlight if
  the touch becomes a scroll.
- Hover is a pointer-only extra. Every `:hover` rule lives inside
  `@media (hover: hover)` so it never sticks on iOS after a tap.
- Nothing important is reachable *only* by hover. Anything hover reveals on the Mac has a
  touch path on iOS: always visible, a long-press, or a swipe.
- Hit targets of at least 44×44pt on touch, even when the glyph is smaller (pad the hit
  area, not the icon).

**Forbids:** hover-lift cards (`translateY` plus shadow on hover). It is the single most
"website" interaction there is. Cards may brighten or show a border on hover. They
don't float.

**Test:** On an iPhone, tap every control once. Does each one visibly acknowledge the
touch *before* the finger lifts, and does nothing stay in a hover state afterwards?

---

## N3. Motion has a vocabulary

Movement communicates where something came from and where it went. It's never
decoration, and it never makes anyone wait.

**Requires:**
- **Motion tokens, not literals.** Durations and curves come from a small set of named
  tokens (`--motion-*`, extending the existing `--transition` and `--transition-slow`).
  The audit found roughly 25 different durations in use; the target is about five.
- **Utility motion follows the platform:**
  - *Mac menus and popovers* appear instantly (or within ~80ms) and fade out over
    ~150ms. They don't slide or scale in.
  - *iOS sheets* spring up from the bottom, follow the finger when dragged, and dismiss
    on a flick or past a threshold, with a rubber band at the top.
  - *iOS navigation* pushes from the right with the outgoing view parallaxing left, and
    the left-edge swipe is interactive and cancellable.
  - *State changes* (toggles, selections, counts) take 100–200ms on a deceleration curve.
- **Interruptible.** A gesture or a second tap mid-animation takes over from where the
  thing *is*, not where it was going. No animation ever blocks input.
- **Exits are faster than entrances** (roughly ⅔ the duration).
- **Ceremonial motion is Dayspring's own** (welcome, rituals, What's new, the dawn
  glow). It may be slower and softer than the platform's, but it is still skippable and
  still respects Reduce Motion.
- **Reduce Motion** swaps movement for a crossfade. It doesn't just delete it, so
  spatial cues survive. (The current global kill-switch removes everything, which
  breaks some of those cues.)

**Forbids:** `transition: all`; staggered fade-ins that hold back content on a surface
someone visits daily; animations that replay on every visit; layout that jumps when
data arrives.

**Test:** Turn on slow animations (iOS Simulator ⌘T, or a 10× motion multiplier). Does
every movement go somewhere meaningful, and can you interrupt it?

---

## N4. Speak each platform's grammar

Same app, two dialects. A Mac user and an iPhone user should each find their habits
honoured without thinking about it.

**Mac:**
- A real **menu bar**: Dayspring / File / Edit / Format / View / Go / Window / Help,
  holding the app's actual commands with their shortcuts (⌘N new entry, ⌘, Settings,
  ⌘1–4 rooms, ⌘F find in journal, ⌘[ / ⌘] back and forward). A command that exists
  only as a hidden keyboard shortcut is undiscoverable.
- **Keyboard everywhere:** arrow keys move through lists and grids, Return opens,
  Space previews, Esc closes the top layer, Tab moves between controls, type-to-select
  in lists.
- **Window behaviour:** you can drag the window from every empty part of the title area;
  double-clicking it zooms; the window's size and position are restored on relaunch; when
  the window loses focus, the chrome dims slightly and the selection colour goes grey.
- **Right-click** on anything that has actions opens a menu that looks and behaves like a
  Mac menu: keyboard navigable, with separators and shortcut hints, appearing instantly.

**iOS:**
- **Tab bar** that scrolls its surface to the top when you tap the current tab again.
  The status bar tap does the same.
- **Swipe-back** from the left edge on every pushed view.
- **Sheets** with grabbers, detents, drag-to-dismiss and a dimmed backdrop. Not centred
  modals.
- **Long-press** on any item that has actions opens a context menu with a lifted preview.
- **Keyboard avoidance** that moves with the keyboard's own curve and timing, never after it.
- Text inputs at 16px or larger (no zoom on focus), with the right `inputmode`,
  `autocomplete`, `autocapitalize` and `enterkeyhint`.

**Test:** Hand the app to a long-time Mac user and a long-time iPhone user and ask each
to do five things without explaining anything. Count the times they reach for a habit
that doesn't work.

---

## N5. Instant, then honest

Native apps open to where you left off and show content immediately. Web apps show a
spinner.

**Requires:**
- **Launch into the last state** (same room, same entry, same scroll position), painted
  from local data before the network answers.
- **No blank or white flashes:** on launch, on theme change, or between surfaces. The
  window background matches the theme before the first frame (already handled for theme;
  extend it to every transition).
- **Optimistic writes.** Save, mark, archive and delete look done immediately and roll back
  visibly if they fail.
- **Placeholders shaped like the content** for anything slower than ~300ms. Spinners only
  for work the user explicitly started and is waiting on (an import, a purchase).
- **Scroll position restored** when you come back to a list or the wall.

**Forbids:** full-surface spinners on navigation; content that pops in and shoves other
content down; "Loading…" text in chrome.

**Test:** Throttle the network to Slow 3G and relaunch. Is the first thing you see your
journal, or a loader?

---

## N6. Felt, not just seen (iOS)

Haptics are part of how iOS says "that worked". An iOS app without them feels numb, even
when the user can't say why.

**Requires** a small haptic vocabulary, exposed as one helper (`haptic('selection' |
'light' | 'medium' | 'success' | 'warning' | 'error')`) and used sparingly:

| Moment | Haptic |
|---|---|
| Toggle, segmented control, picker detent, checkbox | selection |
| Sheet snaps to a detent; drag crosses a dismiss threshold; long-press menu opens | light |
| Voice capture starts / stops | medium |
| Purchase or restore succeeds; app unlocks | success |
| Wrong PIN; a failed save the user needs to notice | error |

**Forbids:** haptics on typing, scrolling or anything continuous; haptics as reward.
Principle 2 governs here: no celebratory buzz for writing, ever. A haptic confirms an
action. It never praises a behaviour.

**Test:** Does every haptic answer something the user's finger just did?

---

## N7. Focus belongs to the keyboard

**Requires:** focus rings only on keyboard focus (`:focus-visible`), drawn in the theme's
accent with the same radius as the control. Every interactive element is reachable with
Tab, and every layer that opens moves focus into itself and returns it on close.

**Forbids:** focus rings after a mouse click or a tap; `outline: none` with no
replacement.

---

## N8. Depth comes from the theme

Native apps have a consistent stack of materials: window, sidebar, content, popover,
sheet, menu. Each level has a known background, blur, shadow and edge. Ad-hoc shadows
are a web tell.

**Requires:** a named elevation scale (`--surface-0` through `--surface-4`: canvas, rail,
card, popover/menu, sheet/dialog). Each level sets background, blur, border and shadow,
tinted per voice and built on the existing glass tokens. Menus and popovers use the glass
material at a consistent radius. Shadows come from the scale, not from literals.

---

## N9. Type: our faces, platform metrics

Dayspring's faces are the identity and stay. What we take from the platform is
**scale and rhythm** for chrome:

- Mac chrome body is about 13px. Menus are 13px with 22px rows. The sidebar is
  11–13px.
- iOS chrome body is about 17pt. Tab labels are about 10pt. Row height is at least 44pt.
- Numbers that change (counts, dates in lists) use tabular figures.
- On iOS, chrome text should respond to the system text size (Dynamic Type) within a
  bounded range. The writing surface already has its own size control.

---

## Rulings: where native and Dayspring disagree

| Conflict | Ruling | Why |
|---|---|---|
| SF Pro vs Dayspring faces | **Dayspring.** Use platform sizes and metrics with our faces. | Faces are identity; sizes are ergonomics. |
| System blue / accent colour vs theme accent | **Dayspring.** Selection, caret, focus and toggles use the theme accent. | The voice is the product's personality. |
| Platform motion speed vs Dayspring's calm | **Platform** for utility UI; **Dayspring** for ceremonial moments. | A menu that drifts in feels broken. A ritual that snaps in feels cheap. |
| Mono tab-bar labels vs SF labels | **Dayspring face, iOS size and hit area.** | Same as faces above. |
| Floating compose button (a Material pattern) vs iOS toolbar compose | **Open.** See `DECISIONS.md` once it's raised. Leaning: keep a single compose action, but give it iOS behaviour (press state, haptic, no overlap with content). | Real trade-off: thumb reach vs platform idiom. |
| Celebratory feedback the platform would allow | **Dayspring.** Principle 2 wins. | A haptic is not a sticker. |
| Standard iOS edit menu vs Dayspring's format bar | **Open, leaning native.** Today the system menu is suppressed (`lib.rs:249`). That costs Writing Tools in the menu, AutoFill, Scan Text and possibly paste from other apps. Leaning: the system menu plus a Dayspring group (Bold, Italic, Highlight, Mark) as `UIAction`s, with the glass bar as its "Format…" page. | OS services can't be rebuilt in HTML; the format bar can live inside the system menu. |
| Sign in with Apple button styling | **Platform.** Solid black or white, per Apple's HIG; Google may stay gold. | App Review requirement, not taste. |
| Custom glass menus vs a real NSMenu (`Menu.popup()`) | **Dayspring look, native behaviour.** Keep the glass menus; give them arrow keys, type-ahead, press-drag-release, instant appear and fade-out exit. | NSMenu can't carry the voice. |
| NSVisualEffect sidebar vibrancy | **Dayspring.** The rail's own glass over the dawn glow. | Desktop show-through would wash out the palette. |
| Mac press = scale (iOS-style) | **Platform.** Tint on Mac; scale only on touch. | Mac controls don't shrink when pressed. |
| Wall: single click opens (Notes/Books) vs select-then-double-click (Finder/Photos) | **Dayspring.** It's a reading surface. | Books is the right precedent. |
| Reader: two-finger swipe turns the page (Books) vs means Back (Safari/Finder) | **Dayspring**, with ⌘[ as the native Back. | Same. |
| Full-surface swipe-back that blocks text selection in the reader | **Platform.** Use an edge-strip swipe; prose stays selectable. | People copy their own words. |
| Settings as an in-window glass modal vs a separate Settings window | **Dayspring**, as long as ⌘W and ⌘. close it rather than the app. | Cheaper; the look is the product. |

---

## Enforcement

Principles that aren't checked rot. Each of these should become a tripwire test in the
style of `App.guestPath.test.ts` (a source-level assertion) as it's fixed:

- No `cursor: pointer` outside link selectors.
- No `:hover` rule outside `@media (hover: hover)`.
- No `transition: all`; transition durations reference `--motion-*` tokens.
- No `window.alert` / `confirm` / `prompt` in shipped code.
- `body` defaults to `user-select: none` on **every** platform (today it's touch-only); the
  editor and reader opt back in.
- Money and auth buttons commit on touch-*up* inside the control, never on touch-down.

Before merging UI work, run the five tests above (N1 select-all, N2 tap-every-control,
N3 slow-motion, N4 hand-it-over, N5 slow-network) on the surfaces you touched. They're
also a section of `/product-audit`.
