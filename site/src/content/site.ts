// ============================================================
// Site-wide copy & data. Locked language from the prototype +
// onepager. Edit text here, not in markup.
// ============================================================

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

// primary nav links (text collapses on mobile; pills stay)
export const navLinks = [
  { label: "Why we built it", href: "/why" },
  { label: "Features", href: "/features" },
  { label: "FAQ", href: "/faq" },
  { label: "Help", href: "/help" },
] as const;

// footer link rows
export const footerLinks = [
  { label: "Why we built it", href: "/why" },
  { label: "Features", href: "/features" },
  { label: "FAQ", href: "/faq" },
  { label: "Help", href: "/help" },
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
    note: "14-day free trial · about $5.33 / month",
    desc:
      "The full product — the editor, every slash command, the Lamp, the Ascent across every horizon, and the Altar. The longer you write, the more the map fills in.",
    cta: { label: "Download for macOS", href: downloads.macos.href, style: "solid" },
    featured: true,
    badge: "Most chosen",
  },
  {
    name: "Monthly",
    price: "$7",
    unit: " / month",
    note: "14-day free trial · cancel anytime",
    desc:
      "Same everything, billed month to month. A gentle way to try it before you commit to the long walk.",
    cta: { label: "Download for macOS", href: downloads.macos.href, style: "line" },
    featured: false,
  },
] as const;

// honest comparison line — no competitor named on-site
export const pricingHonest =
  "Less than the leading AI journal — and the only one that reflects with you across years.";
