import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const headers = readFileSync(resolve(import.meta.dirname, "../public/_headers"), "utf8");

describe("public/_headers", () => {
  it("keeps HTML at max-age=0 and long-caches hashed /_astro/* assets", () => {
    expect(headers).toMatch(/\/\*\s*\n\s+Access-Control-Allow-Origin: \*/);
    expect(headers).toMatch(/Cache-Control: public, max-age=0, must-revalidate/);

    const astro = headers.split("/_astro/*")[1];
    expect(astro).toBeDefined();
    expect(astro).toMatch(/! Cache-Control/);
    expect(astro).toMatch(/Cache-Control: public, max-age=31536000, immutable/);
  });
});
