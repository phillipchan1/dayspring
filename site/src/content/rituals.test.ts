// /rituals is hand-written from the app's practice library, so this pins the
// two together: every practice the app's shelf shows must be on the page, and
// nothing the app has retired may be. Read as text, not imported — the site
// can't (and shouldn't) pull app modules into its build.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rituals } from "./rituals";

const DATA = fileURLToPath(
  new URL("../../../src/editor/practices/practicesData.ts", import.meta.url),
);

/** Each practice object in PRACTICES, as { name, retired }. */
function shelfFromApp(): { name: string; retired: boolean }[] {
  const src = readFileSync(DATA, "utf8");
  const body = src.slice(src.indexOf("export const PRACTICES"));
  return body
    .split(/\n  \{\n/)
    .slice(1)
    .map((chunk) => chunk.split("\n  },")[0])
    .map((chunk) => ({
      name: /\n?\s{4}name:\s*'([^']*)'/.exec(chunk)?.[1] ?? "",
      retired: /\n\s{4}retired:\s*true/.test(chunk),
    }))
    .filter((p) => p.name);
}

describe("/rituals matches the app's shelf", () => {
  const app = shelfFromApp();
  const onPage = new Set(rituals.map((r) => r.name));

  it("reads the app's library", () => {
    expect(app.length).toBeGreaterThan(10);
  });

  it("lists every live practice", () => {
    const missing = app.filter((p) => !p.retired && !onPage.has(p.name)).map((p) => p.name);
    expect(missing).toEqual([]);
  });

  it("lists no retired practice", () => {
    const stale = app.filter((p) => p.retired && onPage.has(p.name)).map((p) => p.name);
    expect(stale).toEqual([]);
  });

  it("lists nothing the app doesn't have", () => {
    const known = new Set(app.map((p) => p.name));
    expect(rituals.filter((r) => !known.has(r.name)).map((r) => r.name)).toEqual([]);
  });
});
