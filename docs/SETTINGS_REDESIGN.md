# About Tab Redesign — June 2026

## What Changed

The About tab was redesigned to implement a cohesive settings design system. This document captures the before/after and the principles applied.

### Before (Spacing Issues)

```
Dayspring
A quiet place to write, every day.

┌─────────────┬─────────────┐
│ VERSION     │ STORAGE     │
│ 0.1.93      │ Private...  │
└─────────────┴─────────────┘

────────────────────────────  [divider]
Welcome        [Replay button]  ← cramped
────────────────────────────  [divider]
Account        phil@...      ← cramped
────────────────────────────  [divider]
Dev Mode       [toggle]      ← cramped
────────────────────────────  [divider]
[Sign out button]              ← visually disconnected
[Reset button]                 ← part of unclear "danger zone"
```

**Problems:**
1. Too many dividers breaking visual flow
2. Welcome / Account / Dev Mode section had no breathing room (cramped)
3. Action buttons (Sign out / Reset) felt orphaned, not grouped
4. No clear visual separation between account info and destructive actions
5. Inconsistent row heights and padding

### After (Cohesive Design System)

```
┌─ App Identity ──────────────────────────────────┐
│ Dayspring                                        │
│ A quiet place to write, every day.              │
│ ┌─────────────┐ ┌──────────────┐               │
│ │ VERSION     │ │ STORAGE      │               │
│ │ 0.1.93      │ │ Private...   │               │
│ └─────────────┘ └──────────────┘               │
└─────────────────────────────────────────────────┘

                 ↓ 32px gap ↓

┌─ Account ───────────────────────────────────────┐
│ EMAIL                     phil@example.com      │  ← 44px tall
│ WELCOME            [Replay the welcome]         │  ← hover bg
│ DEVELOPER MODE               [toggle]            │  ← hover bg
└─────────────────────────────────────────────────┘

                 ↓ 32px gap ↓

┌─ Account Actions ───────────────────────────────┐
│ [Sign out button (full width)]                  │
│ [Reset all settings button (full width)]        │
└─────────────────────────────────────────────────┘
```

**Improvements:**
1. ✅ Clear visual grouping into 3 distinct sections
2. ✅ 44px minimum height per row → easily tappable, less cramped
3. ✅ 24px gap between rows within a section → breathing room
4. ✅ 32px gap between sections → clear separation
5. ✅ "Account Actions" labeled danger zone at bottom (subtle border + background)
6. ✅ Hover states on rows (slight background) → affordance
7. ✅ Right-aligned controls (email, button, toggle) → consistent alignment
8. ✅ Removed confusing dividers → replaced with section containers

## Design System Applied

### Spacing Grid (8px base)

| Element | Spacing | Reasoning |
|---------|---------|-----------|
| Row height | 44px min | Thumb-friendly, not cramped |
| Row padding | 0.75rem (6px) V, 1rem (8px) H | Consistent breathing room |
| Between items in section | 24px (3 units) | Visual separation within group |
| Between sections | 32px (4 units) | Clear visual break between groups |
| Section border | 1px subtle | Gentle containment |
| Hover state | `--bg-hover` | Subtle, not jarring |

### Visual Hierarchy

**Section Headers** (Account Actions, Account)
- Small caps, uppercase, muted
- Font-size: 0.82-0.95rem
- Opacity: 70-80%
- Letter-spacing: +0.05em

**Row Labels** (Email, Welcome, Developer Mode)
- Left-aligned, consistent width
- Color: `--text-bright`
- Font-size: 0.9rem

**Right-Aligned Content**
- Email address: monospace, muted
- Buttons: contextual styling
- Toggles: consistent styling

**Danger Zone** (Sign out, Reset)
- Subtle background (`--bg-input`)
- Subtle border (`--border-subtle`)
- Visual containment signals "grouped action"
- Full-width buttons for clarity

## CSS Classes Introduced

New classes to support the design system:

```css
.settings-about             /* Container, flex column, 2rem gap */
.settings-about__header     /* App identity section, bottom border */
.settings-about__section    /* Account/Updates section, flex column */
.settings-about__section-title  /* "Account", "Updates" labels */
.settings-about__row        /* Label + control row, 44px min-height */
.settings-about__row:hover  /* Hover state for rows */
.settings-about__row-toggle /* Special layout for toggle row */
.settings-about__danger     /* Danger zone container */
.settings-about__danger-title   /* "Account Actions" label */
```

## Extensibility

Adding new settings to the About tab is now straightforward:

### To add a row to the Account section:

```jsx
<div className="settings-about__section">
  <div className="settings-about__section-title">Account</div>
  
  {/* Existing rows... */}
  
  {/* New row */}
  <div className="settings-about__row">
    <span className="settings-field__label">New Setting</span>
    <span className="settings-field__value">Display Value</span>
  </div>
</div>
```

All spacing, hover states, and alignment will be inherited from `.settings-about__row`.

### To add a new section:

```jsx
<div className="settings-about__section">
  <div className="settings-about__section-title">New Group</div>
  <div className="settings-about__row">
    <span className="settings-field__label">Setting 1</span>
    <button className="btn btn--ghost">Action</button>
  </div>
  <div className="settings-about__row">
    <span className="settings-field__label">Setting 2</span>
    {/* Control */}
  </div>
</div>
```

The `settings-about` container's 2rem gap automatically spaces the new section.

## Other Settings Tabs

The same design system principles (spacing grid, visual hierarchy, grouping) are designed to work across all settings tabs:

- **Appearance** — uses `.settings-stack` (24px gaps, which matches the new About system)
- **Writing** — same `.settings-stack` pattern
- **Shortcuts** — informational layout
- **Billing** — status + action pattern

Future tabs should follow the same rules:
- Section groups separated by 32px (or `.settings-divider` for faint line)
- Rows within sections spaced by 24px
- Right-aligned controls for consistency
- Visual grouping via containers, not just dividers

## Verification Checklist

- [x] Code compiles without errors
- [x] New classes follow naming convention (`settings-about__*`)
- [x] Spacing grid is consistent (8px base unit)
- [x] Hover states work on interactive rows
- [x] Danger zone is visually distinct
- [x] Mobile layout preserved (full-width bottom sheet)
- [x] Extensibility pattern clear for future additions
- [x] Design system doc created (SETTINGS_DESIGN_SYSTEM.md)

## Future Opportunities

1. **Animated section collapse** — "Account Actions" could be collapsible to save space
2. **Account level indicator** — Visual badge for account type/trial status
3. **Preference export** — Let users export their settings as JSON
4. **Settings search** — Quick way to find a setting across tabs (low-priority)
