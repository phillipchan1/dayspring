# Positioning

> **Status:** Draft 1, 2026-07-26. **Best guess.** Competitive claims are from general
> category knowledge, not a fresh audit; pricing and feature details for competitors
> should be verified before any of this reaches a marketing page. The strategic
> question at the bottom is the real content of this file.

---

## The category we're in

Not "journaling apps." Dayspring competes in **"help me see my life with God."**

That reframe matters: our real competition isn't Day One's feature set, it's the
Sunday-afternoon feeling of *I don't know if anything is happening.* Most of our
competitors for that feeling aren't software.

## Positioning statement

> For **practicing Christians who have written for years without ever reading it back**,
> Dayspring is **a journal that turns your own entries into a visible record of what God
> has been doing** — unlike **Day One and other journals, which store what you write but
> never read it back**, Dayspring **synthesizes across weeks, months, and years, grounded
> entirely in your own words.**

## The one-move summary

**Every other journal is a write surface. We're a read surface.**

The writing is table stakes — we have to be excellent at it (Principle 3) but it isn't
the wedge. The wedge is that we're the only one that gives your archive back to you.

---

## Competitive frame

| Competitor | What they win | Where they leave the door open | Our line |
|---|---|---|---|
| **Day One** | The default. Beautiful, mature, cross-platform, cheap. "On This Day." | Storage, not synthesis. "On This Day" is random recall, not a picture of a year. Secular — no spiritual vocabulary at all. | *Keep writing the way you like. We read it back.* — and we **import from them**, so it's a migration, not a rip-out. |
| **Diarly** | Clean, markdown-native, Mac-first. Closest to us on craft. | Same gap: no synthesis, no spiritual frame. | Same as Day One. Also an import source. |
| **Notion / Obsidian** | Infinitely flexible, already in the workflow. | Not journals — no dated narrative spine, and synthesis is DIY forever. High-maintenance. | *A journal, not a system to maintain.* |
| **YouVersion / Bible apps** | Enormous reach, free, daily habit already formed. | Reading in, not writing out. Their notes feature is an afterthought and never synthesizes. | We're downstream of reading — **not a competitor, a complement.** Potential channel. |
| **Lectio 365 / Pray-as-you-go** | Excellent guided daily practice. | Consumption, not your own record. Nothing accumulates that's *yours*. | *They give you the practice. We give you the record of it.* |
| **Paper journal** | Tactile, no screen, genuinely sacred. Real preference, not a fallback. | Utterly unsearchable, unsynthesizable, and one flood from gone. | The **handwriting-scan** feature is the bridge — don't fight paper, ingest it. |
| **ChatGPT as journal** | Free, conversational, already open. | No persistence you trust, no dated spine, no grounding, and it *will* make things up about your life. | Grounding as the differentiator — **we structurally cannot invent your past** (H3). |
| **Not journaling at all** | Costs nothing. **The real default and our largest competitor.** | Nothing accumulates. | This is a P2 problem, and it's the hardest one. |

**Where we lose today, honestly:** single-developer trust profile for the most
sensitive data a person owns, and a value proposition that takes months to prove.
*(iOS shipped — Tauri 2, App Store name "Dayspring Journal" — so Day One's
in-your-pocket-at-11pm moat is no longer uncontested. Updated 2026-08-11.)*

---

## Why now

1. **Grounded synthesis just became possible.** Faithful multi-year retrospection over
   personal text is a 2024+ capability. Day One's architecture predates it.
2. **The archives now exist.** A decade of app-based journaling means a real population
   of people holding thousands of unread entries. That population didn't exist in 2015.
3. **AI skepticism is an opportunity, not just a headwind.** As generic AI wrappers
   proliferate, *"it cannot make things up about your life"* becomes a sharper claim
   every month — especially with this audience.

## The moat

Weakest to strongest:

1. **Craft ceiling** — the editor is genuinely hard to match. Real, but copyable with money.
2. **Theological care** — the guardrails are the product. A generic AI journal shipping a
   "Christian mode" will violate H1/H2 within a week and this audience will feel it instantly.
3. **Accumulated personal history** — the strongest. A user with three years of Dayspring
   history and a Concordance tuned to their vocabulary has switching costs that grow
   monthly. *Our own importer proves migration is possible — so this moat only holds if
   the synthesis, not the storage, is what they'd lose.*

---

## Pricing

$7/month · $64/year (~$5.33/mo) · 14-day trial.

**Read:** correctly placed — above Day One (~$3/mo), below therapy-adjacent apps,
comfortably inside "one coffee." Not the constraint on growth; **conversion is.**

Two live tensions:

- **The trial can't demonstrate the value.** 14 days shows the editor, not the payoff.
  For imports it's survivable (backfill produces something immediately). For fresh
  starts it is close to impossible — see `PERSONAS.md` P2. **The trial is currently
  selling the wrong thing.**
- **Annual is underweighted.** A product whose value compounds should push annual much
  harder — it aligns price with when value actually arrives, and it buys the user past
  the dip. The current ~24% discount is a reasonable start; the *framing* is the gap.

---

## Channel — best guesses, all unvalidated

Ranked by fit with the Archivist persona:

1. **The "read your archive" lead magnet** *(not built — highest conviction)*. Upload a
   Day One export, get one real reflection free, no account. Demonstrates grounding in
   the only way that works: on their own life. Directly tests `VISION.md` Bet 3.
2. **Where the archivists already are** — Day One/Obsidian/PKM communities with a
   Christian subset; r/Journaling; Christian creators who journal publicly.
3. **Pastors and spiritual directors** as referrers, not users. They talk to exactly the
   P2 population all week. Requires the guardrails to be genuinely trustworthy first.
4. **Content on the philosophical problem** — "remembering as a spiritual discipline"
   is a subject people care about independent of software. This is the durable one and
   the slowest.

**Probably wrong:** paid social (targeting sincere Christians on this is both hard and
distasteful), app-store search (no iOS app), churches as an institutional channel
(long cycles, committee buying, wrong shape for $7/mo).

---

## The unresolved question

**Dayspring's surface area is built for one person and its soul is built for another.**

- **Built like A — "Obsidian for Christians."** Tauri desktop, CodeMirror, markdown,
  keyboard shortcuts, Nord/Gruvbox-class themes, no iOS app. Selects hard for technical users.
- **Speaks like B — "the journal that shows you God's faithfulness."** All of the copy,
  and the best surfaces (Ascent, Altar, Lamp), serve a near-universal emotional job.

**Current bet:** *acquire A, deliver B.* Reach people with archives and technical
comfort, then move them with something universal. An archivist seeing eleven years read
back is having a B experience.

If that bet holds, "only tech-savvy Christians are interested" is a **reachability
constraint, not a market ceiling** — and the fix is finding non-technical paths to
people with archives, not simplifying the product.

**What would settle it:** interview Q4 and Q11 from `PERSONAS.md`. If beta users
describe Dayspring in *craft* terms ("great markdown editor"), we're an A product and
should lean in — narrow, premium, deep. If they describe it in *remembrance* terms
("it showed me what I'd been praying about all year"), we're a B product and the
desktop-first, markdown-first surface is actively costing us reach.

**Do not spend on acquisition until this is settled.** A and B want different front
doors, and building the wrong one is the most expensive available mistake.

→ Tracked as **D-001** in `DECISIONS.md`.
