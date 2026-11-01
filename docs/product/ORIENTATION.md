# Orientation — where you are, and where Back goes

> **Status:** Draft 1, 2026-11-01. Built on alpha; see **D-036** in
> [`DECISIONS.md`](./DECISIONS.md). Written from one reported walk and then audited
> across the rooms. Sits beside [`DESIGN_PRINCIPLES.md`](./DESIGN_PRINCIPLES.md) (how it
> *feels* in the hand); this is how it *keeps you oriented* while you move through time.

Dayspring is a journal you move through in time. People step back to last October,
open a page, close it, step on. If any of those moves loses their place, the product
has failed at its one job: *showing you where you have been*.

## What was reported

> Ascent → October (one month back) → click a photo → it opens, and it's not clear what
> my actions are → the mouse's Back does nothing → Esc brings me back, but to
> **November**, not October.

Reproduced exactly (`?__preview=screens&surface=ascent-trip`), and three separate things
were wrong, so no single fix would have helped:

| # | What happened | Why |
|---|---|---|
| 1 | Back / Esc landed on *now* | The period you stepped to (`offset`) was component state in `AscentView`. Opening an entry unmounts the Ascent, so the way back remounted it at 0. The return ticket (`EntryReturnContext`) recorded the altitude and any drill-in — not the period. |
| 2 | Nothing said where Back would go | The entry's Back control read **"‹ Ascent"** whether you came from this week or from a month ago. Away from now differed from now by one dropped word in a grey eyebrow ("Month ·" vs "This month ·"). |
| 3 | The mouse's Back was dead | Button 3/4 was handled, but most Mac mouse drivers send Back as **⌘[** — and ⌘[ was bound nowhere. (Not reproducible without the hardware; this is the one concrete gap found.) |

## The model: along, across, into

Three kinds of movement, which the old behaviour treated as one.

| Movement | What it is | Controls | History | Remembered on return |
|---|---|---|---|---|
| **Along** | Another period at the same grain | ‹ ›, ⌥← ⌥→, **This month** | *Replaces* the frame (coalesced) | Yes — `ascentOffset` |
| **Across** | Another grain, same place | Week · Month · Season · Year, ⌥↑ ⌥↓ | *Replaces* the frame | Yes — `ascentAltitude` (and resets Along to now) |
| **Into** | Open an entry, a verse, a rope | Click, Return | *Pushes* a frame | Yes — it is the thing Back undoes |

**Back undoes exactly one *Into*.** It does not retrace how you moved *around* inside the
place, and it returns you to the place as you left it.

## The rules

### O1. Back returns to the place, not the room

Same grain, same period, same spot on the page. The place is the history frame
(`AppHistoryState`), never component state: `ascentOffset` and `ascentSeat` live there
beside `ascentAltitude`, so *every* way back — Esc, ⌘[, the mouse, a swipe, the on-screen
control — lands in the same spot, and so does Forward.

**Forbids:** position kept only in a component that unmounts when something opens over
it; a return ticket that names a room and not where in it.
**Costs us:** a field per remembered thing on every history frame, and normalizing each.
**Test:** step back to a month, open anything, leave by every route. Is it the same month,
at the same scroll position, every time?

### O2. Back says where it goes

The control names the place you will land: **"Ascent · October 2026"**. The period is
left off when it *is* now — a label that always carried one would stop saying anything.
One function, `entryReturnLabel` (`lib/appHistory.ts`), and the shells, the ritual back
link and the tooltip all read it.

**Forbids:** a Back that names a room when the reader was somewhere specific in it.
**Test:** cover the page, read only the Back control. Could you say where you are headed?

### O3. Stepping through time is not a trip

‹ › never pushes history. Eight steps back and one press of Back must *leave*, not walk
you through eight months. Because a held ⌥← steps thirty times a second and WebKit throws
a SecurityError past ~100 history writes in 30 seconds, stepping **coalesces**: state moves
at once, the frame is written once the stepping pauses (`go(…, { replace, coalesce })`),
and always before anything is pushed on top of it.

**Costs us:** Back cannot undo a step through time. If people step to *find* something and
expect Back to retrace it, this is the rule to revisit (D-036's falsifier).

### O4. Away from now says so, and offers the way home

- The eyebrow says **"Last month · October 2026"** for one step back, and "Month · August
  2026" beyond — "last" is a human anchor; the bare grain word said nothing.
- **This month** (this week / season / year) appears beside the stepper only when the
  period is not now: one press home, in every room, because it lives in the one `WhenControl`.
  It stands to the *left* of ‹ so the arrow under the pointer never moves as it comes and
  goes; on a phone it sits beside the period's name, where the row's height does not change.
- No colour, no warning, no "you're in the past". Light, not verdict (P1): it states where
  you are, it does not judge it.

**Test:** step back two periods. Is it obvious you are not at now, and is home one press?

### O5. Every Back is the same Back

On-screen control · **Esc** · **⌘[** · the mouse's side button · the iOS edge swipe —
all one history pop, through the same editor save barrier. **Forward** (⌘], the mouse's
forward button) reopens what you just left. ⌘[ ⌘] are listed in the shortcut guide.

⌘[ is *not* taken while someone is typing: in the editor it is "outdent" (CodeMirror's
`indentLess`). Esc, the Back control and the side button still leave.

**Forbids:** a way out that works from the keyboard but not the pointer, or the reverse.

### O6. Arrive on what you left

Coming back to the right month on the wrong part of the page is nearly as lost as the
wrong month. So the return restores the scroll position and finds the control you pressed
— the *one* you pressed (a month can list the same entry twice) — keeps it in view, gives
it keyboard focus, and marks it with a ring that breathes out over ~1.8s (the fade is
dropped under Reduce Motion; the scroll is not). It never scrolls against a hand on the
page, and gives up for good when the reader touches it (`useSeatArrival`).

**Costs us:** a `data-entry-id` on every control that opens an entry, and a
`MutationObserver` for ~half a second on arrival.
**Test:** open the *second* of two lines for one entry, return. Does the ring land on it?

## What changed, where

| | |
|---|---|
| `lib/appHistory.ts` | `ascentOffset`, `ascentSeat` on the frame; the offset on the return ticket; `entryReturnLabel`; `keyboardHistoryAction` |
| `context/AppNavigation.tsx` | ⌘[ ⌘]; coalesced replace (flushed before any push, dropped on pop, flushed on `pagehide`; a refused write is a breadcrumb, never a crash) |
| `features/ascent/AscentView.tsx` | period from the frame; one `openEntry` wrapper that writes the seat *before* the entry pushes its frame |
| `features/ascent/useSeatArrival.ts` | the return: stand where you stood, find what you pressed |
| `components/WhenControl.tsx` | the way home |
| `lib/period.ts` | "Last month", `periodNowLabel`, `writersDay` |
| `DesktopJournal` / `MobileJournal` | the period-aware Back label |
| `appstore/screensPreview.tsx` | `surface=ascent-trip` — the walk, in the real provider, view and shell chrome |

To walk it: `npm run dev`, then
`/?__preview=screens&surface=ascent-trip` → **Month** → ‹ → scroll → open a line →
Esc · ⌘[ · the mouse's side button · ⌘].

## The other rooms, audited

| Room | Period on return | Place on the page on return | Verdict |
|---|---|---|---|
| **Ascent** | ✅ frame (was ❌) | ✅ seat (was ❌) | Fixed here |
| **Pages** | n/a (wall, shelf, volume are frames: `pagesSpreadId`, `pagesVolume`) | ✅ wall scroll restored (`PageWall` `wallPlace`) | Already the model this doc generalizes |
| **Lamp · Altar** | ✅ carried offset (module memory, session only — survives an entry round-trip, not a reload) | ❓ no scroll restore or mark found in their views (not walked) | **Follow-up:** walk them; give them a seat if so |

## Open — for Phil

1. ~~**Does the Ascent carry *in*?**~~ **Decided (Phil, 2026-11-01): no — a fresh Ascent
   opens at now.** D-035 says the period carries between rooms; the Ascent carries it
   *out* but not *in*, so Ascent (Oct) → Lamp opens on October → rail back to the Ascent
   opens on now. That stays: a climb starts every height at now, and arriving from the rail
   is a fresh arrival. Back is unaffected — it returns to the frame, which holds the period.
   If this is ever reversed, seed only the rail's fresh arrival (`toggleLookBack`) from
   `readCarriedPeriod` / `readCarriedOffset`; never a history pop.
2. **⌘[ with a caret in the entry** outdents (no-op on an unindented line). A mouse that
   sends ⌘[ is therefore dead *after* you click into the text; Esc and the side button
   (button 3) work. Fixable only by touching the editor keymap — left alone on purpose.
3. **A photo opens its page at the top**, not at the photo. Editor territory.
4. **Stale seat:** Ascent → Altar → Altar's own rail icon (`back()`) returns to the Ascent
   frame with the seat from its *last entry open*, which can be old. Rare and mild; the
   fix is to record scroll on every departure, which wants a scroll listener.
5. The Mac menu bar's **Go → Back ⌘[** (NATIVE_FEEL_AUDIT, P0) is the proper home for
   this binding; when it lands it should call the same `history.back()`.
