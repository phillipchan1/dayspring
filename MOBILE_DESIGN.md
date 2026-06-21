# Mobile-First Responsive Design Strategy

**Goal**: Make the app fully functional and delightful on mobile without compromising desktop experience. Single responsive codebase, zero duplicative logic.

**Branches**: All mobile work on `claude/mobile-responsive-design-T46MH`

---

## Design Principles
1. **Single responsive codebase** — No feature duplication between mobile/desktop components
2. **Desktop & mobile ready** — Every new design must work on both form factors before shipping
3. **Thumb-reach optimization** — Actions within easy thumb distance, no full-hand stretches
4. **Touch-friendly** — 48px min tap targets, 12px+ min spacing between interactive elements
5. **Progressive disclosure** — Hide secondary actions, reveal only what's needed
6. **Keyboard power-users** — All keyboard shortcuts still work; mobile gets touch alternatives

---

## Component Status & Mobile Treatment Plan

### ✅ READY FOR MOBILE (Priority 1)

#### 1. **Welcome Screen** (`src/features/welcome/`)
- **Desktop state**: Fixed full-screen overlay with cinematic slides
- **Mobile treatment needed**:
  - Safe-area inset padding (✓ already using `env(safe-area-inset-top)`)
  - Responsive motif sizing (SVGs should scale down on small screens)
  - Theme toggle positioning (✓ already safe-area aware)
  - Ensure touch targets are large enough for accurate tapping
  - Test motion/animation performance on mobile
- **Key file**: `Welcome.css` — add responsive media queries for motif sizes

#### 2. **Paywall/Billing** (`src/features/paywall/`)
- **Desktop state**: Centered flex layout with plan cards side-by-side
- **Mobile treatment needed**:
  - Plan cards already stack with `flex-wrap: wrap` ✓
  - Ensure button sizing for touch (min 48px height)
  - Safe-area bottom inset for CTA button
  - Optimize headline font size on small screens (uses `clamp()` ✓)
- **Key file**: `Paywall.css` — verify touch targets, safe-area bottom

#### 3. **Editor (Capture)** (`src/editor/` & `src/features/capture/`)
- **Desktop state**: CodeMirror + inline command palettes + popovers
- **Mobile treatment needed** — **HIGHEST PRIORITY**:
  - **Slash commands** (the big challenge):
    - Add touch-friendly toolbar with 4 main actions: Scripture, Pray, Sense, Remind
    - Show in bottom sheet or floating action menu
    - Keep `/` still triggerable (for users with keyboards)
    - Suggested location: Bottom toolbar, always visible or slide-up on focus
  - Selection format bar (⌘B, ⌘I, etc.):
    - Already surfaces formatting buttons, good for touch
    - Verify button sizing and spacing
  - Editor viewport:
    - Ensure keyboard doesn't cover input
    - Use `useViewportHeight()` (already in use in MobileJournal) ✓
  - Pop-overs (scripture search, prayer dialog, etc.):
    - Reposition on mobile to not cover input
    - May need bottom-sheet modal style on small screens
- **Key files**: 
  - `SlashPalette.tsx` — add touch UI alternative
  - `Capture.css` — adjust spacing and sizing for mobile
  - `CommandPopover.tsx` — mobile positioning

#### 4. **Entry List** (`src/features/journal/EntryList.tsx`)
- **Desktop state**: Persistent left panel, searchable, context menu actions
- **Mobile state** (already exists): Drawer triggered by swipe or tap
- **Mobile treatment needed**:
  - Larger entry row tap targets (already 0.62rem padding, good)
  - Touch-friendly context menu (current: right-click, mobile: long-press) — already handled via `EntryContextMenu`
  - Search input sizing — verify input height and touch padding
  - Delete/archive actions — consider swipe-to-delete on mobile
  - Keyboard (Shift+↑↓ for multi-select) — add touch UI for bulk actions
- **Key files**: 
  - `EntryList.tsx` — verify touch targets
  - `EntryContextMenu.tsx` — ensure long-press triggers menu on mobile

#### 5. **Settings Panel** (`src/features/settings/`)
- **Desktop state**: Modal with left nav + content area (2-column)
- **Mobile treatment needed**:
  - Switch from centered modal to full-screen bottom sheet
  - Tab navigation:
    - Desktop: Vertical sidebar nav (current)
    - Mobile: Horizontal scrollable tabs or stacked single-column tabs
  - Content area should take full width on mobile
  - Back button for navigation (already structured, just needs mobile layout)
  - Larger touch targets for toggles and sliders
  - Consider safe-area bottom padding for CTA buttons
- **Key files**: `SettingsPanel.tsx` — add mobile sheet layout

#### 6. **Navigation/Rail** (`src/features/journal/Rail.tsx`)
- **Desktop state**: Vertical rail on left, expandable labels, icon + text buttons
- **Mobile state**: Bottom navigation bar — **redesigned** (see below)
- ✅ **Redesigned (mobile bottom bar)**:
  - Cryptic glyphs (☰ ▲ ✦ ◇ ⚙) replaced with the same line-icons the desktop
    rail uses, now **stacked over a word label** (Entries / Ascent / Lamp /
    Altar / Settings). Shared icon set lives in `navIcons.tsx` (used by both
    `Rail` and `MobileJournal`), so a destination reads the same everywhere.
  - **New entry** is a perpetual floating accent FAB (`.mobile-fab`) above the
    bar — always in thumb reach, and freeing the bar for full-width labels.
  - **Focus mode** removed from the permanent bar (a "permanent" nav shouldn't
    hold a control that hides itself). It now lives in the floating writing
    controls cluster (`WritingControls`, mobile only), beside the appearance
    toggle. Exit stays on the in-focus pill (`✕ esc`).
  - Bar + FAB hide while the entries drawer is open, the keyboard is up, or in
    focus mode. 50px+ tap targets; safe-area insets respected.
- ✅ **Fixed**: tapping an entry in the mobile drawer did nothing — opening an
  entry navigated with `replace`, then the drawer closed via `history.back()`,
  which popped that very frame and reverted to the prior entry. Opening now
  folds `sidebar: false` into the same navigation (`handleBrowse` /
  `handleEditEntry` in `JournalScreen`) instead of a separate back().
- **Key files**: `MobileJournal.tsx`, `navIcons.tsx`, `WritingControls.tsx`,
  `JournalScreen.tsx`, `.mobile-bar--tabs` / `.mobile-tab` / `.mobile-fab` CSS

---

### 🚧 LOWER PRIORITY (WIP but can start)

#### 7. **Altar** (`src/features/altar/`)
- Structure in place but incomplete
- Mobile treatment: Same responsive principles, test once feature is complete

#### 8. **Lamp (Scripture)** (`src/features/scripture/`)
- Part of Lamp view, some structure exists
- Mobile treatment: Verify list/detail view layout on small screens

#### 9. **Ascent** (`src/features/ascent/`)
- Structure exists, feature incomplete
- Mobile treatment: Verify chart/data display on mobile (may need horizontal scroll)

---

## Mobile-Responsive Implementation Checklist

### Phase 1: Editor & Commands (High Impact)
- [x] Add slash command toolbar/sheet for mobile
  - [x] 4 buttons: Scripture, Pray, Sense, Remind
  - [x] Triggered on focus (integrated into editor)
  - [x] Keep `/` as alternate entry point for keyboard users
- [x] Create CommandToolbar component with CSS
- [x] Extend Editor API with triggerCommand() method
- [ ] Verify command popovers reposition on mobile (visual test needed)
- [ ] Test selection format bar touch targets (visual test needed)

### Phase 2: Settings & Navigation
- [x] Refactor SettingsPanel to use bottom sheet on mobile
  - [x] Full-screen sheet on mobile (max-width: 767px)
  - [x] Horizontal tab navigation instead of sidebar
  - [x] Safe-area inset padding for notches
- [x] Ensure Navigation Rail / MobileBar safe-area insets
- [x] Test tab navigation on small screens

### Phase 3: Refinement ✅ IN PROGRESS
- [x] Welcome screen motif sizing on mobile
  - [x] Scale motifs from 150px to 100px on mobile
  - [x] Responsive title with clamp()
  - [x] Touch-friendly 44px+ buttons
- [x] Paywall button sizing and safe-area bottom
  - [x] Stack plan cards on mobile
  - [x] 48px minimum button heights
  - [x] Safe-area padding for home indicators
- [ ] Entry list row sizing and swipe actions
- [ ] End-to-end testing: New user flow → Welcome → Paywall → Editor

### Phase 4: Lower Priority Features (WIP)
- [ ] Altar mobile layout
- [ ] Lamp mobile layout
- [ ] Ascent mobile layout (charts)

---

## Technical Notes

### Already Mobile-Ready
✓ Responsive breakpoint hook: `useIsMobile()` in `useMediaQuery.ts`
✓ Viewport height tracking: `useViewportHeight()` 
✓ Safe-area inset CSS: `env(safe-area-inset-*)`
✓ Entry list drawer with swipe gesture detection
✓ Bottom navigation bar structure
✓ Mobile/Desktop conditional rendering pattern

### Needs Addition
- Mobile command palette (slash commands)
- Touch-friendly settings sheet
- Tablet breakpoint consideration (iPad)
- Gesture handlers (long-press for context menu)

### CSS Media Queries to Use
```css
/* Mobile first (default styles for mobile) */
@media (min-width: 768px) {
  /* Tablet and up */
}

@media (min-width: 1024px) {
  /* Desktop and up */
}

/* Or use useIsMobile() hook in components for conditional rendering */
```

---

## Testing Strategy

1. **Manual Testing**:
   - iPhone (375px wide, tight vertical space)
   - iPad (768px+, wider but portrait)
   - Desktop (1024px+)

2. **Scenarios**:
   - New user: Welcome → Paywall → First entry
   - Existing user: Launch → Editor with entry list + settings
   - Focus mode: Full-screen editor, all chrome hidden
   - Settings: Change appearance, fonts, import/export

3. **Touch-specific**:
   - All buttons/taps register on first touch (no hover states blocking)
   - Swipe gestures work (drawer open/close)
   - Keyboard doesn't cover input on small screens
   - Safe-area insets respected (no notch overlap)

---

## Implementation Summary

### ✅ Completed Work

**Mobile Command Toolbar** (`src/editor/CommandToolbar.tsx`)
- 4 quick-action buttons for slash commands (Scripture, Pray, Sense, Remind)
- Integrated into editor for mobile users
- Hides when slash palette is open (avoids UI confusion)
- Preserves keyboard shortcut flow for power users
- Touch-friendly 48px+ button heights with icons and labels

**Settings Panel Bottom Sheet**
- Responsive 2-column modal → full-screen bottom sheet on mobile
- Navigation converted from vertical sidebar to horizontal scrollable tabs
- Bottom indicator bar replaces left accent bar on mobile
- Full-width content area optimized for narrow screens
- Safe-area insets for notches and home indicators
- Maintained smooth animations and transitions

**Welcome Screen Mobile Optimization**
- Motif SVGs scale down (150px → 100px on mobile)
- Responsive headlines using clamp() for fluid scaling
- Increased button touch targets to 44px+ minimum
- Compact padding and spacing for small screens
- Safe-area insets for full-screen cinematic experience

**Paywall/Billing Screens**
- Plan cards stack vertically on mobile (flex-wrap)
- Responsive pricing display with clamp()
- Minimum 48px button heights for touch accuracy
- Safe-area bottom padding for home indicators
- Full-width optimization for narrow viewports

**Entry List Mobile Touch Targets**
- Minimum 48px height for entry rows on mobile
- Flex layout ensures vertical centering
- Maintains 36px desktop minimum for compact view
- Increased padding (0.75rem) for mobile spacing
- Drawer respects safe-area-inset-top via CSS

**Editor Integration**
- Extended Editor API with `triggerCommand()` method
- CommandToolbar shown below editor on mobile (hidden on desktop)
- Properly hidden during focus mode
- Responsive to keyboard and touch input

### 📋 Testing Checklist (Manual)
- [ ] Mobile (iPhone 12/13 - 390px viewport)
  - [ ] Welcome screen: all slides readable, buttons tappable, animation smooth
  - [ ] Paywall: plan cards stack, CTA button reachable without stretching
  - [ ] Editor: command toolbar visible, each button works
  - [ ] Settings: tabs scroll, content readable, safe area respected
  - [ ] Entry list: rows tappable, drawer opens/closes smoothly

- [ ] Tablet (iPad - 768px viewport)
  - [ ] Settings uses desktop modal (not full-screen sheet)
  - [ ] Entry list drawer is usable
  - [ ] All controls sized appropriately for medium screens

- [ ] Desktop (1024px+)
  - [ ] Command toolbar hidden (no mobile toolbar visible)
  - [ ] Settings modal centered, 2-column layout
  - [ ] Navigation rail visible (not bottom bar)
  - [ ] All existing functionality preserved

- [ ] Safe-Area Testing (devices with notches/home indicators)
  - [ ] Welcome theme toggle doesn't collide with notch
  - [ ] Settings sheet respects top/bottom safe areas
  - [ ] Paywall CTA button doesn't hide under home indicator
  - [ ] Drawer header doesn't overlap notch
  - [ ] Mobile bar at bottom respects home indicator space

### 🎯 Next Steps (For When Ready)
1. **Visual Testing**: Run app on real devices or emulator to verify responsive layout
2. **Gesture Testing**: Test swipe-to-dismiss drawer, long-press for context menu
3. **Performance**: Check animation performance on older iOS/Android devices
4. **Accessibility**: Verify touch targets meet WCAG 2.1 AA standards (48px+)
5. **Lower Priority Features**: Altar, Lamp, Ascent mobile layouts when features stabilize

## Design Files for Reference
- `src/styles/global.css` — Core responsive styles, breakpoints, safe-area handling
- `src/editor/CommandToolbar.tsx` — Mobile command toolbar component
- `src/features/journal/MobileJournal.tsx` — Mobile layout pattern (drawer + bottom nav)
- `src/features/journal/DesktopJournal.tsx` — Desktop layout pattern (rail + panel + main)
- `src/features/settings/SettingsPanel.tsx` — Settings component (responsive modal/sheet)
- `src/features/welcome/Welcome.css` — Welcome screen responsive styles
- `src/features/paywall/Paywall.css` — Paywall responsive styles

## Responsive Breakpoints Used
- **Mobile**: max-width: 480px (small phones)
- **Mobile+**: max-width: 767px (phones and small tablets)
- **Tablet**: 768px - 1023px
- **Desktop**: 1024px+ 

## Safe-Area CSS Variables
App respects iOS/Android notches and home indicators using standard CSS:
```css
env(safe-area-inset-top)     /* Notch space at top */
env(safe-area-inset-bottom)  /* Home indicator space at bottom */
env(safe-area-inset-left)    /* Side notches (rare) */
env(safe-area-inset-right)   /* Side notches (rare) */
```

Used throughout for padding, min-heights, and positioning.
