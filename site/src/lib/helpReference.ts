/**
 * Reference pages — the ones rendered from the app manifest rather than written.
 *
 * These carry no prose to maintain: they render every row the manifest has, so
 * a shortcut added in the app appears here without anyone writing a line. That
 * also means coverage is automatic — there is no such thing as an undocumented
 * shortcut or slash command.
 *
 * They live alongside the markdown articles in the same route and the same
 * gate, so a reference page whose feature hasn't reached stable is withheld
 * exactly like an article. (The highlight-colour table is the live example:
 * the five-colour highlighter is on master only.)
 */

import type { HelpSection } from "../content.config";

export type ReferenceKind =
  | "shortcuts"
  | "slash-menu"
  | "settings"
  | "practices"
  | "highlights";

export interface ReferencePage {
  slug: string;
  kind: ReferenceKind;
  title: string;
  summary: string;
  section: HelpSection;
  order: number;
  /** Manifest feature ids — same gating rules as an article's frontmatter. */
  requires: string[];
  keywords: string[];
  updated: Date;
}

const UPDATED = new Date("2026-08-10");

export const REFERENCE_PAGES: ReferencePage[] = [
  {
    slug: "keyboard-shortcuts",
    kind: "shortcuts",
    title: "Every keyboard shortcut",
    summary:
      "The complete list, for macOS and for Windows and Linux — generated from the app itself.",
    section: "settings",
    order: 90,
    requires: ["capability.editor"],
    keywords: ["shortcut", "keyboard", "hotkey", "command", "cmd", "ctrl", "keys"],
    updated: UPDATED,
  },
  {
    slug: "slash-menu",
    kind: "slash-menu",
    title: "Every slash command",
    summary: "Type / on a new line to open the menu. Here is everything in it.",
    section: "writing",
    order: 90,
    requires: ["capability.editor"],
    keywords: ["slash", "command", "menu", "palette", "insert"],
    updated: UPDATED,
  },
  {
    slug: "highlight-colours",
    kind: "highlights",
    title: "Highlight colours",
    summary: "The five highlighter colours, and what each one writes into your entry.",
    section: "writing",
    order: 91,
    // Withheld until the five-colour highlighter reaches stable.
    requires: ["highlight.amber"],
    keywords: ["highlight", "colour", "color", "marker", "amber", "rose", "sage"],
    updated: UPDATED,
  },
  {
    slug: "practices",
    kind: "practices",
    title: "The practice library",
    summary:
      "Every contemplative practice you can bring onto a page, where it comes from, and how it moves.",
    section: "writing",
    order: 92,
    requires: ["capability.practices"],
    keywords: ["practice", "ritual", "examen", "lectio", "soap", "prayer", "liturgy"],
    updated: UPDATED,
  },
  {
    slug: "settings-reference",
    kind: "settings",
    title: "Every setting and its default",
    summary: "What each setting does, and what it's set to before you change anything.",
    section: "settings",
    order: 91,
    requires: ["capability.editor"],
    keywords: ["setting", "default", "preference", "option", "configure"],
    updated: UPDATED,
  },
];

/**
 * Human descriptions for settings keys.
 *
 * The manifest supplies the key and the real default; this supplies the English.
 * A key with no description here still renders — with its key as the label — so
 * a new setting can never be silently missing from the table.
 */
export const SETTING_DESCRIPTIONS: Record<string, { label: string; note: string }> = {
  typewriter: {
    label: "Typewriter scrolling",
    note: "Keeps the line you're writing vertically centred instead of drifting to the bottom.",
  },
  dimming: {
    label: "Paragraph dimming",
    note: "Fades the paragraphs you aren't currently in, so the one you're writing stands out.",
  },
  fontSize: { label: "Font size", note: "The size of your writing, in pixels." },
  lineHeight: { label: "Line height", note: "How much air sits between lines." },
  maxWidth: {
    label: "Column width",
    note: "How wide the writing column runs, in rem. Narrower reads more like a book.",
  },
  appearance: {
    label: "Appearance",
    note: "Light, dark, or auto — auto follows whatever your device is doing.",
  },
  lightTheme: { label: "Light palette", note: "Which palette is used in light mode." },
  darkTheme: { label: "Dark palette", note: "Which palette is used in dark mode." },
  editorFont: { label: "Writing font", note: "The face your entries are set in." },
  pagesZoom: {
    label: "Pages zoom",
    note: "How close you're standing to the wall of pages. Driven by the zoom slider, not a switch.",
  },
  railLabels: {
    label: "Navigation labels",
    note: "Show text labels beside the sidebar icons. Press [ to toggle it.",
  },
  firstLineTitle: {
    label: "First line as title",
    note: "Treats the first line of an entry as its title, in the app and in exports.",
  },
  showMarkdownSyntax: {
    label: "Show markdown syntax",
    note: "Leaves the raw characters (*, **, #, ==) visible instead of hiding them until your cursor is inside.",
  },
  skipRitualPreview: {
    label: "Skip practice previews",
    note: "Go straight into writing when you pick a practice, without the introduction screen.",
  },
  shareUsage: {
    label: "Share anonymous usage",
    note: "Counts which features get used. Never your entries, never their content.",
  },
  devMode: {
    label: "Developer mode",
    note: "Desktop only, and only for beta testers — enables the developer tools shortcut.",
  },
};
