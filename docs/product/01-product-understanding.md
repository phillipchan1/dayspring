<callout icon="📖" color="blue_bg">
	**Ground truth, read from the repo.** Everything in this document is **[DERIVED]** from the shipped codebase with files cited. It is the foundation the market-facing docs (02–07) build on. Where a claim is about the market rather than the code, it is tagged and moved out of this page.
</callout>
> One-line read of the code: *Dayspring is a private, single-user journaling app whose editor treats the spiritual life as a first-class writing primitive, and whose "return" surfaces turn years of entries into a long-horizon mirror of who you're becoming.* {color="gray"}

## What it actually is
A cross-platform (macOS + web, iPhone next) **personal AI journal**. `package.json` describes it verbatim as *"Personal AI Journal — single-user, private journaling app"* and the app is built on React 19 + TypeScript + Vite, wrapped natively with **Tauri** (`src-tauri/`), backed by **Supabase** (auth, Postgres, sync) with **OpenAI** for the AI layer and **Stripe** for billing.

Three things the code makes it do, in order of how much of the codebase serves them:

### 1. A focus-first editor that is the soul of the app
The single largest and most detailed area of the repo is `src/editor/` — a CodeMirror 6 writing surface, not a generic rich-text box. Concretely **[DERIVED]**:
- **Typewriter scrolling** (`src/editor/typewriter.ts`) and **paragraph dimming** (`src/editor/dimming.ts`) — the active line stays centered, everything else fades. Both default **on** (`src/lib/settings.ts` → `DEFAULTS`).
- **Six writing "faces"** (`src/lib/settings.ts` → `EDITOR_FONT_VARS`): Serif (Newsreader, default), Literary (Fraunces), Typewriter (iA Writer Duo), Mono (JetBrains Mono), Sans, Readable (Atkinson Hyperlegible). This is a code-editor's typographic sensibility applied to journaling.
- **First line becomes the title** (`src/editor/firstLineTitle.ts`, `deriveTitle.ts`), markdown throughout, autosave with a save-status badge (`src/features/journal/SaveStatusBadge.tsx`).

### 2. The spiritual life captured *in the sentence* (the signature)
This is what makes Dayspring not a generic journal. Slash commands (`src/editor/slashCommands.ts`) insert **spiritual blocks** — structured, decorated inline elements, not plain text (`src/editor/spiritualBlocks*.ts`, `spiritualBlockDecoration.ts`):
- `/scripture` — **Scripture** (ESV/word-for-word lookup; direct references bypass the AI, per commit `75597a3`)
- `/pray` — **Prayer**
- `/sense` — **Sense** (a felt/discernment note)
- `/ritual` — **Ritual**: opens a library of contemplative forms (`src/editor/practices/practicesData.ts`, `PracticeLibrary.tsx`) — Daily Examen, Lectio Divina, Psalmic Lament, Wesley's Questions, etc.
- `/image` — image insertion; there is also a **page scan** flow that photographs a handwritten entry → vision OCR → draft (`src/features/capture/PageScanCapture.tsx`, commit `2ad6fbe`).

Because these are structured blocks, they are machine-readable — which is what feeds surface #3.

### 3. "Return" surfaces — the long-horizon payoff
Three read-back surfaces turn accumulated entries into synthesis. Each is its own feature module:
- **The Lamp / Scripture heatmap** (`src/features/scripture/` — `ScriptureView.tsx`, `heat.ts`): where your writing has actually lived across the whole Bible, scrubable by season.
- **The Ascent** (`src/features/ascent/` — `AscentView.tsx`, `AltitudeBands.tsx`, `Summit.tsx`): four altitudes (Valley → Hillside → Ridge → Summit) spanning week → month → quarter → year. Design intent in code: *the higher you climb, the less it interprets*.
- **The Altar** (`src/features/altar/`): a "place of remembrance" where prayers and senses gather by person, place, and recurring matter.
- Backing this is a **compounding rollup** engine — reflections run weekly → monthly → yearly (`src/lib/insights.ts`, `api/reflections/`, `api/processing/`, `api/cron/`), building on prior summaries rather than re-reading raw entries.

## Primary user flow [DERIVED]
From `src/App.tsx` and the onboarding modules:
1. **Sign in** (Supabase auth; Google OAuth) → `SignIn.tsx`.
2. **Account init**: `ensureProfile()` grants a **14-day reverse trial** in Supabase automatically — no card in the default app-managed model (`App.tsx` lines 74–94; a card-first path exists behind the `ONBOARDING_REQUIRE_CARD` flag).
3. **Onboarding** (`src/features/onboarding/OnboardingFlow.tsx`): first-run routes into Welcome or **Import** ahead of the editor. Import supports **Day One, Diarly, Markdown** with photos + original dates, parsed on-device (`src/lib/import/`), and can surface a `MonthReveal.tsx` — the cold-start-killer "wow" moment.
4. **Write** in the journal (`src/features/journal/JournalScreen.tsx`, `DesktopJournal.tsx`, `MobileJournal.tsx`) — the daily driver.
5. **Return** via the Lamp / Ascent / Altar as history accumulates.
6. **Trial → Subscribe** (Stripe) or hit the **LockedScreen** when the trial lapses (`src/features/paywall/`).

## Monetization [DERIVED]
All-or-nothing subscription, gated at entry (`src/features/paywall/PaywallScreen.tsx`, `src/lib/subscription.ts`):
- **$64/year** (marked "Best value", ~$5.33/mo) or **$7/month**, after a **14-day free trial**. No free-forever tier.
- Paywall tagline: *"the dayspring from on high."* / *"Your journal history is the whole point — everything compounds over time."*
- Stripe Checkout + webhooks + Customer Portal (`api/stripe/`, `api/webhooks/`). iOS IAP is planned via the entitlement architecture in the 💸 Pricing doc.

## Design language as expressed in the UI [DERIVED]
Tokenized in `src/styles/themes.css` + `glass.css`:
- **Light "parchment" mode**: warm paper `#fbf6ee`, warm ink text `#4a4035`/`#2a2118`, terracotta accent `#c2683a`. Multiple dark themes with a **dawn** accent (amber→rose `#e0a64e` / `#e8743c`). Never stark white, never pure black.
- **"Glass" surfaces with a corner "dawn bloom" glow** (`glass.css` → `.glass-surface__glow`, radial dawn gradient) for chrome/settings/confirms — explicitly shared with the marketing site's LetterCard/DawnGlow.
- **Literary typography**: Newsreader body, Fraunces for display/emotional lines, JetBrains Mono for labels — the "code-editor soul."
- **Restraint**: `prefers-reduced-motion` respected everywhere; no streaks/badges/mascots anywhere in the code.

## Who it appears built for (from the code, not the market) [DERIVED]
The product is unmistakably built for a **single, practicing Christian who journals seriously**. Evidence: the entire spiritual-block system, the contemplative Rituals library, an ESV scripture engine and whole-Bible heatmap, the name (Dayspring = Luke 1:78), and the paywall tagline. The architecture is single-user first (App comment: *"One user. Keep it simple."*), though multi-tenancy groundwork exists (`docs/MULTI_TENANCY_PLAN.md`, RLS, profiles, Stripe).

## Implicit value proposition [DERIVED]
*A beautiful, private place to write your inner life before God — that quietly compounds into a yearly mirror of who you're becoming.* The two load-bearing bets encoded in the codebase are (1) **spiritual practice as a first-class editor primitive** and (2) **long-horizon compounding synthesis**. Both are expensive to build and neither is a bolt-on — which is the strongest signal of genuine product intent.
