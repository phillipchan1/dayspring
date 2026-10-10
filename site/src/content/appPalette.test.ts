// The hero's `/` palette is hand-copied from the app; this keeps its rows and
// icons in step with it. Read as text, not imported — the site build can't
// pull app modules in. If this fails, the app's palette changed: update
// appPalette.ts to match rather than loosening the test.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { paletteCapture, paletteFormat } from "./appPalette";

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const COMMANDS = read("../../../src/editor/slashCommands.ts");
const ICONS = read("../../../src/editor/spiritualBlockIcons.tsx");

function appItems() {
  const body = COMMANDS.slice(
    COMMANDS.indexOf("export const SLASH_ITEMS"),
    COMMANDS.indexOf("\n]\n", COMMANDS.indexOf("export const SLASH_ITEMS")),
  );
  return body
    .split(/\n  \{\n/)
    .slice(1)
    .map((c) => ({
      id: /selection:\s*\{[^}]*\bid:\s*'([^']+)'/.exec(c)?.[1],
      column: /\bcolumn:\s*'([^']+)'/.exec(c)?.[1],
      label: /\blabel:\s*'([^']+)'/.exec(c)?.[1],
      hint: /\bhint:\s*'([^']+)'/.exec(c)?.[1],
      badge: /\bbadge:\s*'([^']+)'/.exec(c)?.[1],
      badgeStyle: /\bbadgeStyle:\s*'([^']+)'/.exec(c)?.[1],
      touchExcluded: /\btouchExcluded:\s*true/.test(c),
    }))
    .filter((i) => i.id);
}

/** The JSX for one icon in spiritualBlockIcons.tsx's `paths` map. */
function appIcon(id: string): string {
  const start = ICONS.search(new RegExp(`\\n  ${id}:`));
  if (start < 0) return "";
  const next = ICONS.slice(start + 1).search(/\n  [a-z]+:/);
  return next < 0 ? ICONS.slice(start) : ICONS.slice(start, start + 1 + next);
}

describe("hero palette matches the app", () => {
  const items = appItems();
  const format = items.filter((i) => i.column === "format");
  const capture = items.filter((i) => i.column === "capture");

  it("reads the app's palette", () => {
    expect(format.length).toBeGreaterThanOrEqual(paletteFormat.length);
    expect(capture.length).toBeGreaterThanOrEqual(paletteCapture.length);
  });

  it("leads with Format, then Capture — the app's column order", () => {
    const cols = /SLASH_COLUMNS[^=]*=\s*\[([\s\S]*?)\]/.exec(COMMANDS)?.[1] ?? "";
    expect([...cols.matchAll(/key:\s*'([^']+)'/g)].map((m) => m[1])).toEqual([
      "format",
      "capture",
    ]);
  });

  it("shows the app's first Format rows, in order", () => {
    expect(paletteFormat.map((r) => [r.label, r.badge, r.badgeStyle])).toEqual(
      format
        .slice(0, paletteFormat.length)
        .map((i) => [i.label, i.badge, i.badgeStyle]),
    );
  });

  it("shows the app's first Capture rows, in order, with their hints", () => {
    expect(paletteCapture.map((r) => [r.id, r.label, r.hint])).toEqual(
      capture.slice(0, paletteCapture.length).map((i) => [i.id, i.label, i.hint]),
    );
  });

  it("draws each Capture row with the app's own icon", () => {
    for (const row of paletteCapture) {
      const src = appIcon(row.id);
      expect(src, `no icon for ${row.id}`).not.toBe("");
      for (const d of row.icon) expect(src, `${row.id} icon drifted`).toContain(`d="${d}"`);
    }
  });
});
