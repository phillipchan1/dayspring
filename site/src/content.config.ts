import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * Help articles.
 *
 * `requires` is the load-bearing field: each entry is a feature id from the
 * app manifest (src/content/generated/*.json). It decides whether an article
 * publishes at all — see src/lib/help.ts. An id that doesn't exist anywhere
 * fails the build; an id that exists but hasn't reached `stable` keeps the
 * article unpublished until it does.
 */
export const HELP_SECTIONS = [
  "getting-started",
  "writing",
  "returning",
  "settings",
  "account",
  "privacy",
  "troubleshooting",
] as const;

export type HelpSection = (typeof HELP_SECTIONS)[number];

/** Display metadata for each section — order here is order on the hub. */
export const HELP_SECTION_META: Record<HelpSection, { title: string; blurb: string }> = {
  "getting-started": {
    title: "Getting started",
    blurb: "Install it, sign in, and write the first page.",
  },
  writing: {
    title: "Writing",
    blurb: "The editor, and everything you can put on a page.",
  },
  returning: {
    title: "Finding & returning",
    blurb: "Coming back to what you've already written.",
  },
  settings: {
    title: "Settings",
    blurb: "Making it look and feel the way you want.",
  },
  account: {
    title: "Account & billing",
    blurb: "Your trial, your subscription, your account.",
  },
  privacy: {
    title: "Your data & privacy",
    blurb: "Where your writing lives, and how to take it with you.",
  },
  troubleshooting: {
    title: "Troubleshooting",
    blurb: "When something isn't behaving.",
  },
};

const help = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/help" }),
  schema: z.object({
    title: z.string(),
    /** One line. Shown on the hub and used as the page meta description. */
    summary: z.string(),
    section: z.enum(HELP_SECTIONS),
    /** Sort order within the section. */
    order: z.number(),
    /** App manifest feature ids this article describes. */
    requires: z.array(z.string()).default([]),
    /** Platforms the article applies to; rendered as a note when not all three. */
    platforms: z.array(z.enum(["web", "macos", "ios"])).default(["web", "macos", "ios"]),
    /** Extra search terms beyond the title and body. */
    keywords: z.array(z.string()).default([]),
    updated: z.date(),
  }),
});

export const collections = { help };
