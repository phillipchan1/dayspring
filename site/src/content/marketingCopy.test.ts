import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as faq from "./faq";
import * as features from "./features";
import * as home from "./home";
import { cta, pricingTiers } from "./site";

const footerSource = readFileSync(
  new URL("../components/Footer.astro", import.meta.url),
  "utf8",
);
const startSource = readFileSync(
  new URL("../pages/start.astro", import.meta.url),
  "utf8",
);
const marketingCopy = [
  JSON.stringify(home),
  JSON.stringify(faq),
  JSON.stringify(features),
  JSON.stringify({ cta, pricingTiers }),
  footerSource,
  startSource,
].join("\n");

describe("cold marketing access copy", () => {
  it.each([
    "14-day trial",
    "free trial",
    "free to try",
    "try it for two weeks",
  ])("does not describe complimentary access as %s", (phrase) => {
    expect(marketingCopy.toLowerCase()).not.toContain(phrase);
  });

  it("states that complimentary access needs no payment method", () => {
    expect(home.pricing.lead).toContain("No payment method required");
    expect(footerSource).toContain("No payment method required");
    expect(startSource).toContain("No payment method required");
    expect(pricingTiers.every((tier) => tier.note.includes("no payment method required"))).toBe(true);
  });
});
