// ============================================================
// /why — the manifesto. Locked copy from dayspring-manifesto.md.
// Contemplative, near-bare. Four figures, each earning a feature.
// Only Augustine is quoted directly; Peterson is referenced by phrase.
// ============================================================

import { downloads } from "./site";

export const why = {
  title: "Why we built Dayspring",
  subtitle: "A long obedience, written down.",

  // opening — the problem of unseen growth
  intro: [
    "There's a kind of growth you can't see by looking. Patience doesn't announce itself. A prayer life doesn't deepen on a schedule you'd notice. What you believe moves from your head to your heart so slowly that most days feel like no movement at all — and so we lose heart, measuring ourselves against who we think we should already be.",
    "We built Dayspring because the people who have written most honestly about the inner life all said the same thing: formation is slow, and it's mostly visible in hindsight.",
  ],

  // the four figures — each earns a feature (the build-note mapping)
  figures: [
    {
      name: "Augustine",
      feature: "The yearly mirror",
      // body split so the one direct quote can be styled as a quote
      body: "wrote his <em>Confessions</em> as a journal addressed to God — years of a life laid open, not to perform but to understand. He could only trace the hand of God by looking backward across the whole of it.",
      quote: "You have made us for yourself, and our heart is restless until it rests in You.",
      after: "That restlessness is the thing a single day can never resolve. A day is too small to hold a pattern. A year is a mirror.",
    },
    {
      name: "Ignatius",
      feature: "The compounding rollup",
      body: "gave the church the examen — a daily look at where you met God and where you turned from Him, gathered over time into something larger than any one evening. Dayspring is, in a sense, an examen that remembers: each day's reflection folding into the week, the week into the month, the month into the year.",
    },
    {
      name: "Brother Lawrence",
      feature: "Measuring backward",
      body: "found God not on spiritual heights but in the kitchen, the errands, the ordinary afternoon. We took that seriously. Dayspring won't ask you to measure your life against an ideal you'll never reach — the surest way to lose heart. It measures you against who you actually were, and shows you how far you've been carried.",
    },
    {
      name: "Eugene Peterson",
      feature: "The long-horizon thesis",
      // referenced by phrase, not block-quoted (per build notes)
      body: "described the whole Christian life as a long obedience in the same direction. That's the bet behind everything here. Not a streak. Not a quick win. A long walk, written down, that one day you get to read back.",
    },
  ],

  // closing
  close: [
    "Most tools are built for today — today's mood, today's verse, today's task. We wanted to build one for the long walk: a quiet, beautiful page to write on, and, a year from now, an honest look at who you've become before God.",
    "That's the whole reason.",
  ],

  cta: { label: "Download for macOS", href: downloads.macos.href },
};
