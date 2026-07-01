<callout icon="🎨" color="blue_bg">
	Does the current UI reinforce the wedge, or undercut it? Audit of the shipped design language against "formation over time, held in confidence, for the reflective Christian." File references are **[DERIVED]**.
</callout>
> Headline: **the design is the strongest-aligned part of the whole product.** It already does the wedge's job better than most positioning docs could. The mismatches are small and fixable, not structural. {color="gray"}

## Where the design already reinforces the wedge (keep, protect)
- **Warm parchment + dawn palette, never clinical white / pure black** (`src/styles/themes.css`: light `#fbf6ee` paper, warm ink, terracotta/amber/rose accents). This is the single clearest anti-positioning move against both secular-clinical SaaS and cartoon-Christian apps. **Exactly right.**
- **The "dawn bloom" glass glow** (`src/styles/glass.css` → `.glass-surface__glow`) — a literal daybreak, tying every surface back to the name (Dayspring / Luke 1:78). Brand and UI are saying the same thing. **Rare and valuable.**
- **Literary typography** (Newsreader body, Fraunces display, JetBrains Mono labels) — signals "made for reading and reflection," not "productivity tool." Six writing faces (`src/lib/settings.ts`) treat the *writer's* taste as sacred. **On-wedge.**
- **Restraint everywhere** — `prefers-reduced-motion` honored across `global.css`/`glass.css`; **no streaks, badges, or mascots anywhere in the code.** This restraint *is* the brand for this audience. **Protect it fiercely.**
- **Spiritual blocks are visually first-class** (`src/editor/spiritualBlockDecoration.ts`, `spiritualBlockIcons.tsx`) — faith lives *in the page*, not in a settings toggle. The design embodies the positioning.

## Mismatches / risks against the wedge
<table header-row="true">
<tr><td>#</td><td>Mismatch</td><td>Where</td><td>Why it undercuts the wedge</td></tr>
<tr><td>1</td><td>The **paywall leads with commerce, not reverence**</td><td>`src/features/paywall/PaywallScreen.tsx` — "Begin your 14-day free trial", price tiles, "Best value" badge</td><td>First hard brand moment tilts SaaS-transactional. "Best value" is the vocabulary of the commodity apps the brand refuses. The reverence (tagline is there) should lead; the pricing should feel like stewardship, not a pricing table.</td></tr>
<tr><td>2</td><td>**Dark-accent blue in the default dark theme** (`--accent: #61afef`)</td><td>`src/styles/themes.css` (first dark block)</td><td>A cool code-editor blue fights the warm "dawn" identity. The dawn amber/rose themes are on-brand; a cool-blue default dark theme reads generic-dev, off-wedge. Verify which dark theme actually ships as default.</td></tr>
<tr><td>3</td><td>**"Trial banner" / countdown pressure**</td><td>`src/features/paywall/TrialBanner.tsx`</td><td>Countdown urgency is a conversion pattern borrowed from the very category ("unlock your best self") the brand disavows. Tone-check it toward invitation, not pressure ("your journal will be here" > "X days left").</td></tr>
<tr><td>4</td><td>**Generic error/util surfaces**</td><td>`src/components/ErrorBoundary.tsx`, `SetupNotice.tsx`</td><td>Utility screens are where brand voice usually leaks. Worth a pass so even failure states sound like Dayspring (calm, held), not a stack trace.</td></tr>
<tr><td>5</td><td>**Feedback widget / usage-share defaults**</td><td>`FeedbackWidget.tsx`, `settings.ts` (`shareUsage: true`)</td><td>For a trust-first, sacred-data audience, an opt-*out* analytics default (even anonymous) slightly contradicts the "held in confidence" promise. Consider opt-in, or make the stewardship framing explicit at the toggle.</td></tr>
</table>

## What would need to change for design to fully reinforce positioning
1. **Rebrand the paywall as a threshold, not a checkout.** Lead with the reverence line and the "your history is the whole point" idea; demote the price tiles; drop or reword "Best value" into something quieter. Keep it honest and simple (all-or-nothing is a feature) but make the *first* impression sacred.
2. **Make "dawn" the accent everywhere, including default dark.** Audit which dark theme ships by default; ensure the warm amber/rose dawn accent — not cool blue — is the identity color in the primary experience.
3. **Convert urgency to invitation** across trial/lock surfaces (`TrialBanner.tsx`, `LockedScreen.tsx` already aims "friendly, not punishing" — extend that ethos to the banner).
4. **Bring brand voice to the edges** — error, setup, and empty states as small moments of calm, not generic system copy.
5. **Re-examine analytics defaults** for consistency with the stewardship/privacy promise the brand makes its centerpiece.

**Net:** the core writing/return experience is beautifully on-wedge; the **commercial and utility chrome** is where the design occasionally slips into generic-SaaS grammar. Those are the surgical fixes that would make the design 1:1 with the positioning.
