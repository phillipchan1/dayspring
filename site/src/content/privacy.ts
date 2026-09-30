// ============================================================
// /privacy — framed as stewardship, not a feature checkbox.
// CRITICAL: every claim here must be TRUE. Per the Notion privacy
// doc, do NOT overclaim:
//   • No blanket "end-to-end encrypted" (false the moment AI reads plaintext)
//   • No blanket "even we can't see your entries"
//   • No "military-grade / bank-level" puffery
// Standard entries: protected, never sold/trained, but we hold the key
// (so we *could* technically read them — we don't and won't).
// Honesty is the trust. Tone = sanctuary, confidence, held space.
// ============================================================

import { downloads } from "./site";

export const privacyPage = {
  eyebrow: "Privacy as stewardship",
  heading: "Some things are meant to be written <em>before they're ever spoken aloud.</em>",
  lead: "Dayspring is built to hold those things in confidence. This page is the plain truth about how — written to be reassuring and true, because with the kind of writing you'll do here, honesty is the only trust worth having.",

  // the claims we can make — all true
  promises: [
    {
      title: "Your words are yours",
      body: "We never sell them, never use them to train AI, and never mine them for marketing. There is no version of this where your journal becomes someone's product.",
    },
    {
      title: "Encrypted in transit and at rest",
      body: "Your entries are protected on their way to the server and while they sit on it. That's the floor, not the headline.",
    },
    {
      title: "No one else can reach your journal",
      body: "Every entry is bound to your account at the database level. Another person cannot read your writing — not by accident, not by a bug we'd shrug at.",
    },
    {
      title: "Your reflections stay yours",
      body: "When you ask Dayspring to reflect with you, dictate, or read a handwritten page, your words pass securely to a trusted processing partner. Your writing is never used to train models. Our partner may hold what you send for up to 30 days solely to prevent abuse, then deletes it. We never sell it.",
    },
  ],

  // the honest distinction — this is the trust-builder, not fine print
  straight: {
    title: "Where we'll be completely straight with you",
    body: "For your everyday entries to be reflected on, our system has to be able to read them — so we hold the key. We never look, and we never will. But we won't tell you we <em>can't</em>, because that wouldn't be true, and you'd be right to walk away from anyone who claimed otherwise.",
  },

  line: "It's just between you and God.",

  cta: { label: "Download for macOS", href: downloads.macos.href },
};
