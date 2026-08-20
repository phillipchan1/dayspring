/**
 * Loading and gating help articles.
 *
 * Every page that lists or renders help content goes through `loadHelp()`, so
 * the two build-time rules are enforced in exactly one place:
 *
 *   1. An article requiring a feature id that exists on NO channel is an
 *      authoring error — a typo, or a feature that was deleted from the app.
 *      The build fails. A help page describing something that isn't there is
 *      worse than no help page.
 *
 *   2. An article requiring a feature that exists but hasn't reached `stable`
 *      is simply not published yet. It's excluded from the pages, the hub, the
 *      sitemap and the search index, and it starts publishing itself the moment
 *      the feature merges down. Nobody has to remember to flip anything.
 */

import { getCollection, type CollectionEntry } from "astro:content";
import { HELP_SECTIONS, HELP_SECTION_META, type HelpSection } from "../content.config";
import { classifyRequirement, published, value } from "./manifest";
import { REFERENCE_PAGES, type ReferenceKind, type ReferencePage } from "./helpReference";

export type HelpEntry = CollectionEntry<"help">;

/** Resolve `{{token}}` spans in a frontmatter string (title, summary). */
export function resolveTokens(text: string, where: string): string {
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_m, token: string) => {
    try {
      return String(value(token));
    } catch (err) {
      throw new Error(`${where}: ${(err as Error).message}`);
    }
  });
}

export interface LoadedHelp {
  /** Articles that publish on this channel, sorted by section then order. */
  articles: HelpEntry[];
  /** Slugs withheld because their feature isn't on this channel yet. */
  withheld: string[];
}

let cached: LoadedHelp | null = null;

export async function loadHelp(): Promise<LoadedHelp> {
  if (cached) return cached;

  const all = await getCollection("help");
  const articles: HelpEntry[] = [];
  const withheld: string[] = [];
  const errors: string[] = [];

  for (const article of all) {
    const unknown = article.data.requires.filter((id) => classifyRequirement(id) === "unknown");
    if (unknown.length) {
      errors.push(
        `  ${article.id}.md — requires unknown feature id(s): ${unknown.join(", ")}`,
      );
      continue;
    }

    const notYet = article.data.requires.filter(
      (id) => classifyRequirement(id) === "not-yet-shipped",
    );
    if (notYet.length) {
      withheld.push(`${article.id} (waiting on ${notYet.join(", ")})`);
      continue;
    }

    // Fail on unresolvable tokens in frontmatter here; body tokens are caught
    // by the remark plugin when the article renders.
    resolveTokens(article.data.title, `${article.id}.md (title)`);
    resolveTokens(article.data.summary, `${article.id}.md (summary)`);

    articles.push(article);
  }

  if (errors.length) {
    throw new Error(
      `Help articles reference features that do not exist in the app manifest:\n` +
        errors.join("\n") +
        `\n\nEither the id is a typo, or the feature was removed from the app. ` +
        `The manifest is generated from the app repo — it is not editable here.`,
    );
  }

  const sectionRank = (s: HelpSection) => HELP_SECTIONS.indexOf(s);
  articles.sort(
    (a, b) =>
      sectionRank(a.data.section) - sectionRank(b.data.section) ||
      a.data.order - b.data.order ||
      a.data.title.localeCompare(b.data.title),
  );

  if (withheld.length) {
    console.log(
      `[help] ${withheld.length} article(s) withheld — not yet on "${published.channel}":\n` +
        withheld.map((w) => `  ${w}`).join("\n"),
    );
  }

  cached = { articles, withheld };
  return cached;
}

/**
 * One entry in the help index — a written article or a generated reference
 * page. The hub and the search filter treat them identically; only the route
 * knows the difference.
 */
export interface HelpIndexItem {
  slug: string;
  title: string;
  summary: string;
  section: HelpSection;
  order: number;
  keywords: string[];
  updated: Date;
  reference: ReferenceKind | null;
}

/** Reference pages that pass the same gate as articles. */
export function publishedReferencePages(): ReferencePage[] {
  const unknown = REFERENCE_PAGES.flatMap((p) =>
    p.requires
      .filter((id) => classifyRequirement(id) === "unknown")
      .map((id) => `  ${p.slug} — unknown feature id: ${id}`),
  );
  if (unknown.length) {
    throw new Error(
      `Reference pages reference features that do not exist in the app manifest:\n` +
        unknown.join("\n"),
    );
  }
  const publishedPages = REFERENCE_PAGES.filter((p) =>
    p.requires.every((id) => classifyRequirement(id) === "ok"),
  );

  // Say what's being held back. A reference page silently vanishing is exactly
  // the kind of thing that goes unnoticed for a release or two.
  const withheld = REFERENCE_PAGES.filter((p) => !publishedPages.includes(p));
  if (withheld.length) {
    console.log(
      `[help] ${withheld.length} reference page(s) withheld — not yet on "${published.channel}":\n` +
        withheld
          .map((p) => `  ${p.slug} (waiting on ${p.requires.join(", ")})`)
          .join("\n"),
    );
  }

  return publishedPages;
}

/** Everything published, articles and reference pages together. */
export async function helpIndex(): Promise<HelpIndexItem[]> {
  const { articles } = await loadHelp();

  const fromArticles: HelpIndexItem[] = articles.map((a) => ({
    slug: a.id,
    title: resolveTokens(a.data.title, `${a.id}.md (title)`),
    summary: resolveTokens(a.data.summary, `${a.id}.md (summary)`),
    section: a.data.section,
    order: a.data.order,
    keywords: a.data.keywords,
    updated: a.data.updated,
    reference: null,
  }));

  const fromReference: HelpIndexItem[] = publishedReferencePages().map((p) => ({
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    section: p.section,
    order: p.order,
    keywords: p.keywords,
    updated: p.updated,
    reference: p.kind,
  }));

  const sectionRank = (s: HelpSection) => HELP_SECTIONS.indexOf(s);
  return [...fromArticles, ...fromReference].sort(
    (a, b) =>
      sectionRank(a.section) - sectionRank(b.section) ||
      a.order - b.order ||
      a.title.localeCompare(b.title),
  );
}

export interface HelpGroup {
  section: HelpSection;
  title: string;
  blurb: string;
  items: HelpIndexItem[];
}

/** The published index grouped by section, empty sections dropped. */
export async function helpSections(): Promise<HelpGroup[]> {
  const index = await helpIndex();
  return HELP_SECTIONS.map((section) => ({
    section,
    ...HELP_SECTION_META[section],
    items: index.filter((a) => a.section === section),
  })).filter((g) => g.items.length > 0);
}

/** Previous/next within the same section, for foot-of-article navigation. */
export async function helpNeighbours(
  entry: HelpEntry,
): Promise<{ prev: HelpEntry | null; next: HelpEntry | null }> {
  const { articles } = await loadHelp();
  const siblings = articles.filter((a) => a.data.section === entry.data.section);
  const i = siblings.findIndex((a) => a.id === entry.id);
  return {
    prev: i > 0 ? siblings[i - 1]! : null,
    next: i >= 0 && i < siblings.length - 1 ? siblings[i + 1]! : null,
  };
}

const PLATFORM_LABELS = { web: "the web app", macos: "macOS", ios: "iPhone and iPad" } as const;

/** A human note when an article only applies to some platforms. */
export function platformNote(platforms: readonly ("web" | "macos" | "ios")[]): string | null {
  if (platforms.length === 3) return null;
  const names = platforms.map((p) => PLATFORM_LABELS[p]);
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `This applies to ${list}.`;
}
