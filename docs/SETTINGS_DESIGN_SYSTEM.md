# Settings Design System

Dayspring's settings pages follow a cohesive visual language designed for clarity, breathing room, and extensibility.

## Philosophy

Settings should feel like a calm, organized space—not a form to rush through. Each setting has its place, and relationships between settings are visually clear. New settings can be added without breaking the system.

## Spacing System

**Base unit:** 8px grid

| Scale | Value | Usage |
|-------|-------|-------|
| Compact | 8px | Internal spacing within elements |
| Breathing | 16px | Spacing between related items |
| Section | 24px | Vertical gap between logical groups |
| Divider | 32px | Visual separation between major groups |

## Field Structure

All settings follow a consistent **label + control** pattern:

```
[Label]                    [Control]
[Hint/detail text]
```

**Row Layout (label left, control right):**
- Used for: toggles, buttons, displays (email, version)
- Label stays constant width; control is right-aligned
- Gap between label and control: 16px (flex: 1)
- Vertical padding: 12px
- Horizontal padding: 16px

**Stack Layout (label above content):**
- Used for: complex controls (sliders, color pickers, long text)
- Label on its own line
- Content below, no padding between

## Section Grouping

Sections are organized into **visual groups**, each with its own identity:

### Type 1: Info Blocks (Metadata)
- **Use for:** Version, storage status, account email, metadata
- **Style:** Grid of small cards OR left-label + right-value rows
- **Background:** None (inline)
- **Example:** Version 0.1.93, Storage: Private to you · synced

### Type 2: Preference Sections (Active Settings)
- **Use for:** Toggles, sliders, font pickers, appearance options
- **Style:** Column stack, each row 44px+ tall
- **Background:** None
- **Spacing:** 24px between settings
- **Example:** Theme, Font size, Developer mode

### Type 3: Actions (Primary)
- **Use for:** Buttons that accomplish something (Replay welcome, Check for updates)
- **Style:** Inline in row layout or standalone button
- **Spacing:** 24px above, grouped together
- **Example:** Replay the welcome, Restart to update

### Type 4: Danger Zone (Destructive)
- **Use for:** Actions that can't be undone (Sign out, Reset)
- **Style:** Separate visual group, appears at bottom
- **Background:** Subtle warning (dark + faint warning color border)
- **Spacing:** 32px above, clear visual separation
- **Button style:** Ghost or subtle danger variant
- **Example:** Sign out, Reset all settings

## Typography Hierarchy

| Element | Font | Size | Weight | Color | Usage |
|---------|------|------|--------|-------|-------|
| App name | Display | 1.8rem | 600 | bright | Hero (About tab only) |
| Tagline | Serif | 0.95rem | regular | dim | Subtitle (About tab only) |
| Section title | Display | 1.25rem | 600 | bright | Page/tab header |
| Label | Sans | 0.9rem | regular | bright | Field labels |
| Hint | Sans | 0.74rem | regular | faint | Explanatory text |
| Value | Mono | 0.8rem | regular | dim | Config values, emails |
| Small text | Sans | 0.72rem | regular | faint | Metadata, attribution |

## Common Patterns

### 1. Row with Right-Aligned Control
```
Label                                Button
Hint text optional                   
```
- Min height: 44px
- Padding: 12px 16px
- Gap between label and control: flex: 1

### 2. Meta Grid
```
┌─────────┐ ┌─────────┐
│ VERSION │ │ STORAGE │
│ 0.1.93  │ │ Private │
└─────────┘ └─────────┘
```
- Cards with border + subtle background
- Each card: 70px min-width
- Responsive: 1–3 columns depending on space
- Padding: 8px 12px per card

### 3. Section Stack
```
[Label]           [Control/Value]
[Hint text]

[Label]           [Control/Value]
[Hint text]

↓ 24px gap

[Label]           [Control/Value]
[Hint text]
```
- Each item: min 44px tall
- 24px gap between items
- Group separated by 24px from next group

### 4. Danger Zone (Bottom)
```
32px gap (visual break)
┌─────────────────────────┐
│ ⚠️ Account Actions      │ (subtitle)
│ □ Sign out              │
│ □ Reset all settings    │
└─────────────────────────┘
```
- Container with subtle border + faint background
- Grouped actions vertically
- Clear labeling: "Account Actions" or similar
- Padding: 16px

## Color Variables (Light/Dark Theme)

- `--text-bright` — primary text, labels
- `--text-dim` — secondary text, values, hints
- `--text-faint` — tertiary text, small metadata
- `--accent` — interactive elements
- `--danger` — destructive action hint
- `--bg-input` — card backgrounds
- `--border-subtle` — field separators, group containers

## Interactive States

All buttons and controls:
- **Idle:** Neutral, color is `--text-dim` or `--accent`
- **Hover:** Slight brightening, +opacity on background
- **Active:** Full opacity, `--accent` or `--danger` color
- **Disabled:** `--text-faint` + 50% opacity

## Responsive Behavior

### Desktop (>768px)
- Two-pane layout: nav sidebar + main content
- Settings stack max-width: 30rem
- 1.4rem padding around main body

### Tablet/Mobile (<768px)
- Single-pane full-screen bottom sheet
- Settings stack max-width: 100%
- 1rem padding around body
- Danger zone actions remain grouped at bottom

## When Adding New Settings

1. **Decide its type:** Info? Preference? Action? Danger?
2. **Place it in the right group:** Group similar settings together
3. **Use the right field component:** Row for toggles/buttons, stack for complex
4. **Maintain spacing:** 24px between settings in the same group
5. **Separate groups:** 32px visual break between different groups (or a divider)
6. **Label it clearly:** Label should be noun or short phrase ("Theme", "Font size", not "Change theme")
7. **Add hint if needed:** Only if the label isn't fully clear
8. **Test:** Visually compare to neighboring settings—should look cohesive

## Examples

### ✅ Good: About Tab
```
┌─ App identity ──────────────────┐
│ Dayspring                        │
│ A quiet place to write, every... │
│                                  │
│ VERSION: 0.1.93  STORAGE: Private│
└──────────────────────────────────┘

┌─ Account ───────────────────────┐
│ Welcome      [Replay the welcome]│
│ Account      [phil@example.com]  │
│ Developer... [toggle switch]     │
└──────────────────────────────────┘

┌─ Updates ───────────────────────┐
│ Checking... [Check for updates]  │
│ ▶ What's new [collapsible]       │
└──────────────────────────────────┘

┌─ Account Actions ───────────────┐
│ [Sign out button]                │
│ [Reset all settings button]       │
└──────────────────────────────────┘
```

### ✅ Good: Appearance Tab
```
┌─ Visual settings ───────────────┐
│ Theme        [Light/Dark/System] │
│                                  │
│ Writing font [Font picker]       │
│                                  │
│ Nav labels   [toggle switch]     │
│ Show names beside icons          │
└──────────────────────────────────┘
```

## CSS Class Reference

**Containers:**
- `.settings-stack` — vertical flex group with consistent gap
- `.settings-group` — visual container for related settings (future)
- `.settings-danger` — visual danger zone at bottom

**Fields:**
- `.settings-field` — wrapper for a single setting
- `.settings-field__head` — label + hint
- `.settings-field__head--row` — label left, control right
- `.settings-field__label` — the setting label
- `.settings-field__hint` — explanatory text
- `.settings-field__value` — displayed value (email, version, etc.)

**Controls:**
- `.settings-toggle` — toggle switch + label
- `.settings-range` — slider input
- `.switch` — toggle switch component
- `.btn` — button base
- `.btn--ghost` — transparent button
- `.btn--accent` — colored action button
- `.btn--danger` — warning/destructive button (future)

**Special:**
- `.settings-divider` — thin visual separator
- `.settings-about__*` — About tab specific styles
- `.settings-update__*` — Update checker styles
- `.settings-changelog__*` — Release history styles
