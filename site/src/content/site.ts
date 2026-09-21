// ============================================================
// Site-wide copy & data. Locked language from the prototype +
// onepager. Edit text here, not in markup.
// ============================================================

// The live web app — SignIn renders for an unauthenticated visitor, and first
// sign-in grants the 14-day trial with no card (api/profile/ensure.ts in the
// app repo). Also mirrored as APP_URL's default in api/_lib/env.ts and
// DEFAULT_API_BASE in src/lib/env.ts — verified against both before wiring,
// not invented (see dayspring#45).
//
// NOT offered anywhere on the site (Phil, 2026-09-20): people get Mac or
// iPhone, nothing else. The web app still exists for existing users, and
// `/start` still redirects to it — it's simply not a door this site shows.
export const APP_URL = "https://dayspring-eosin.vercel.app";

export const site = {
  name: "Dayspring",
  // default per-page <title> tagline & description live in each page;
  // these are the global fallbacks / brand-level strings.
  tagline: "A journal built for spiritual growth.",
  description:
    "A journal for spiritual growth — plant scripture inline, draw near through contemplative practice forms, see where your heart has been leaning across the whole Bible, and look back across week, month, quarter, and year.",
  url: "https://www.usedayspring.app",
  verse: {
    text: "…the Dayspring from on high has visited us",
    ref: "Luke 1:78",
  },
} as const;

// download pills (iOS + macOS) in the nav and CTAs.
// macOS: a stable-named asset (`Dayspring-aarch64.dmg`) is published on every
// release, so GitHub's "latest" URL always points at the newest build — a
// clean, zero-JS direct download. No API call, no rate limits.
// iOS: not shipped yet — rendered as a non-clickable "coming soon" pill.
export const releasesRepo = "phillipchan1/dayspring-releases";

export const downloads = {
  ios: { label: "iOS", comingSoon: true, soonLabel: "Soon" },
  macos: {
    label: "macOS",
    href: `https://github.com/${releasesRepo}/releases/latest/download/Dayspring-aarch64.dmg`,
  },
} as const;

// ---- the download cluster (the site's primary CTA everywhere) ----
// One object so the hero, the footer, the pricing cards and the nav can't drift
// apart. Mac and iPhone only — the browser is deliberately not offered.
export const cta = {
  mac: {
    label: "Download for Mac",
    href: downloads.macos.href,
    /** Rendered under the buttons. The trial offer, without the trial button. */
    // No hardware line: "Apple silicon, macOS 13+" wasn't true of the build.
    note: "Start with a 14-day trial.",
  },
  ios: {
    label: "iPhone",
    soon: "Coming soon",
    /** Shown on phones, where the .dmg is useless and the pill is the whole CTA. */
    phoneNote: "The iPhone app is in review. Until then, Dayspring lives on your Mac.",
  },
} as const;

// primary nav links (text collapses on mobile; pills stay)
export const navLinks = [
  { label: "Why we built it", href: "/why" },
  { label: "Features", href: "/features" },
  { label: "Rituals", href: "/rituals" },
  { label: "FAQ", href: "/faq" },
  { label: "Help", href: "/help" },
] as const;

// footer link rows
export const footerLinks = [
  { label: "Why we built it", href: "/why" },
  { label: "Features", href: "/features" },
  { label: "Rituals", href: "/rituals" },
  { label: "FAQ", href: "/faq" },
  { label: "Help", href: "/help" },
  { label: "Roadmap", href: "https://dayspring.featurebase.app/roadmap" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "A note from the maker", href: "/maker" },
  { label: "Dayspring © 2026", href: "/" },
] as const;

// ---- pricing tiers (Annual is featured / "Most chosen") ----
export const pricingTiers = [
  {
    name: "Dayspring Annual",
    price: "$64",
    unit: " / year",
    note: "14-day trial · about $5.33 / month",
    desc:
      "The full product — the editor, every slash command, the Lamp, the Ascent across every horizon, and the Altar. The longer you write, the more the map fills in.",
    cta: { label: "Download for Mac", href: downloads.macos.href, style: "solid" },
    featured: true,
    badge: "Most chosen",
  },
  {
    name: "Monthly",
    price: "$7",
    unit: " / month",
    note: "14-day trial · cancel anytime",
    desc:
      "Same everything, billed month to month. Choose it when a year at a time is more than you want.",
    cta: { label: "Download for Mac", href: downloads.macos.href, style: "line" },
    featured: false,
  },
] as const;

// honest comparison line — no competitor named on-site
export const pricingHonest =
  "Less than the leading AI journal — and the only one that reflects with you across years.";
