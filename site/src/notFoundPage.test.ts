import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(resolve(import.meta.dirname, "pages/404.astro"), "utf8");

describe("src/pages/404.astro", () => {
  it("asks the host to serve this document as a 404, not a 200 page", () => {
    expect(page).toMatch(/Astro\.response\.status = 404/);
    expect(page).toMatch(/noindex/);
  });
});
