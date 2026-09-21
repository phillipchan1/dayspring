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

// Phil, 2026-09-20: the introductory period is a TRIAL, not "complimentary
// access" — Dayspring isn't given away. This replaces #109's rule, which banned
// "14-day trial" and required "no payment method required" on every surface.
//
// What survives is the part App Review actually objected to under 3.1.2(c):
// calling it FREE. The iOS App Store subscriptions carry no free trial, so the
// site must never promise one. "14-day trial" is allowed; "free trial" is not.
// And no "no card / no payment method" line — Phil called it excessive.
describe("cold marketing access copy", () => {
  it.each(["free trial", "free to try", "try it for two weeks", "complimentary"])(
    "never describes the introductory period as %s",
    (phrase) => {
      expect(marketingCopy.toLowerCase()).not.toContain(phrase);
    },
  );

  it("calls it a 14-day trial where it names it", () => {
    expect(home.pricing.lead).toContain("14-day trial");
    expect(cta.mac.note).toContain("14-day trial");
    expect(pricingTiers.every((tier) => tier.note.includes("14-day trial"))).toBe(true);
  });
});
