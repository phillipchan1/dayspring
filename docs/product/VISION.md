# Vision

> **Status:** Living document. Last substantive revision: 2026-07-26.
> Supersedes `personal-ai-journal-requirements.md` (archived) as the product source of truth.
> That document described a single-user personal tool. Dayspring is now a multi-tenant
> subscription product with paying users. Where the two conflict, this one wins.

---

## The promise

**Dayspring shows you, over time, what God has been making of you.**

Everything else in the product is in service of that sentence. A journal you write in
is table stakes — Day One, Notion, and a paper notebook all clear that bar. What
Dayspring does that none of them do is **read your life back to you**.

---

## What Dayspring is

A journal for practicing Christians, on Mac and the web, that:

1. **Is genuinely good to write in.** Markdown-first, near-zero input latency, focus
   mode with typewriter scrolling and paragraph dimming, themeable down to the font.
   The editor is the soul of the product, not a text box bolted to an AI feature.
2. **Turns what you wrote into what you can see.** Weekly, monthly, and yearly
   synthesis — grounded in your own words, never invented. The value compounds as the
   window widens; the year-in-review is the payoff.
3. **Surfaces the shape of a life with God** through purpose-built views: the Ascent
   (elevation over time), the Covenant sky (matters carried, and the light on them),
   Scripture (the canon as it has actually intersected your life), the Concordance
   (your own vocabulary, learned).

## What Dayspring is not

These are live constraints, not history. When one changes, change it *here* and add a
row to `DECISIONS.md` — do not let it rot silently the way the founding doc did.

| Not | Why | Revisit when |
|---|---|---|
| Not a habit tracker | Streaks turn devotion into a scoreboard. See `PRINCIPLES.md` #2. | Never. This is identity, not tactics. |
| Not a devotional or reading plan | Those markets are owned (YouVersion, Lectio 365) and it is not our job to tell you what to read. | Only as a partnership, never as core. |
| Not a social or shared journal | The most private text a person owns. Entry *sharing* (one entry, deliberately) is a different thing and is planned. | Sharing ≠ social. Keep the line. |
| Not a spiritual director | The app must not counsel, diagnose, or prescribe. See `GUARDRAILS.md`. | Never. |
| Not end-to-end encrypted | Incompatible with cloud synthesis, which is the entire value. Stated plainly to users instead of hidden. | If on-device models get good enough. |
| Not a note-taking / PKM app | Obsidian and Notion win there. We are a journal — dated, personal, narrative. | Never. |

---

## Business shape

- **Model:** subscription SaaS, multi-tenant.
- **Price:** $7/month or $64/year (~$5.33/mo), 14-day free trial.
- **Platforms:** web (Vercel), macOS desktop (Tauri, alpha + stable channels), iOS
  (Capacitor, planned).
- **Stage:** beta users on the `stable` channel. Feedback so far is generic — see
  `PERSONAS.md` § *How to falsify these* for the interview script that fixes that.

Pricing implies a claim: Dayspring must be worth more than a coffee a month *every
month*, including months where the user writes four times. That is only true if the
synthesis layer keeps delivering when the writing habit dips. **Design for the dip.**

---

## The three-year picture

A user in their third year opens Dayspring in January. It shows them the year: the
matters they carried and which ones resolved, the seasons they climbed through, the
verses that kept finding them, the prayers they forgot they prayed and the answers
they never connected. Nothing in it was invented. All of it was theirs, and none of it
was reachable before.

They cry a little. They send it to their spouse. They renew without thinking about it.

That moment is the product. Everything upstream is scaffolding for it.

---

## What must be true for this to work

Stated as falsifiable bets, so we can tell if we're wrong:

1. **People will pay for retrospection, not just capture.** *Falsified if* renewal
   correlates with writing volume rather than with reflection-surface engagement.
2. **Grounded synthesis reads as sacred, not creepy.** *Falsified if* users describe
   the reflections as "AI-generated" rather than "mine."
3. **There is a reachable population of Christians with existing journal archives.**
   *Falsified if* the import path stays cold — it is currently our best wedge and our
   least-validated assumption.
4. **The craft ceiling is a moat.** A beautiful editor plus real theological care is
   hard to copy quickly and hard for a generic AI journal to fake.
5. **The dip is survivable.** *Falsified if* churn clusters in months with low entry
   counts, meaning we only pay off for the already-disciplined.

Bet 3 is the one to test first. It is also the one the current onboarding fork
(`veteran` vs `fresh`) already instruments — we just aren't reading the data yet.

---

## The open strategic question

Dayspring is currently built like **an IDE for the soul**: Tauri desktop app,
CodeMirror, markdown, keyboard shortcuts, Nord/Gruvbox-class themes. That craft is
real and it is a genuine differentiator — but it selects hard for technically
sophisticated users.

The *emotional* job the product serves — *I can't tell whether I'm actually growing,
and I forget what God has done* — is close to universal among practicing Christians.

So there are two coherent products here:

- **A — "Obsidian for Christians."** Narrow, deep, defensible, cheap to reach,
  willing to pay. Small ceiling.
- **B — "The journal that shows you God's faithfulness."** Broad emotional job,
  much larger ceiling, needs a far simpler front door and competes for attention
  with YouVersion.

The reflection surfaces you have already built — the Ascent, the Covenant sky — are
**B features**. The editor and the theming are **A features**. Today the product is A
in its surface area and B in its soul.

This does not need to be resolved today, but it must be resolved before any
significant acquisition spend, because A and B want different front doors. Carried as
the top open question in `POSITIONING.md`.

---

## Related

- `PRINCIPLES.md` — the tie-breakers that adjudicate feature arguments
- `PERSONAS.md` — who this is for, as testable hypotheses
- `BRANDSCRIPT.md` — how we say it
- `GUARDRAILS.md` — what the AI may never do
- `DECISIONS.md` — what we decided, why, and what would change our mind
