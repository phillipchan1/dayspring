import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as faq from "./faq";
import * as features from "./features";
import * as home from "./home";
import { cta, pricingTiers } from "./site";

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

// Read sources — not just exported objects — so a home-page rewrite cannot
// reintroduce trial chrome in a string the old JSON.stringify join missed
// (meta description, default footer sub, comments adjacent to pricing).
const surfaces: Record<string, string> = {
  "home.ts": read("./home.ts"),
  "faq.ts": read("./faq.ts"),
  "features.ts": read("./features.ts"),
  "site.ts": read("./site.ts"),
  "Footer.astro": read("../components/Footer.astro"),
  "start.astro": read("../pages/start.astro"),
};

const marketingCopy = [
  ...Object.values(surfaces),
  JSON.stringify({ cta, pricingTiers }),
].join("\n");

const FORBIDDEN = [
  "14-day trial",
  "free trial",
  "free to try",
  "try it for two weeks",
] as const;

// Collapse comment markers and whitespace so a split "14-day / trial" across
// two source lines still fails. Analytics names (StartTrial, start_trial_clicked)
// do not match these phrases and must stay.
function flatten(text: string) {
  return text.toLowerCase().replace(/\/\//g, " ").replace(/\s+/g, " ");
}

describe("cold marketing access copy", () => {
  it.each(FORBIDDEN)("never describes complimentary access as %s", (phrase) => {
    expect(flatten(marketingCopy)).not.toContain(phrase);
  });

  it.each(Object.keys(surfaces))(
    "%s has none of the forbidden trial phrases",
    (name) => {
      const flat = flatten(surfaces[name]);
      for (const phrase of FORBIDDEN) {
        expect(flat).not.toContain(phrase);
      }
    },
  );

  it("states complimentary access needs no payment method on every cold surface", () => {
    expect(home.pricing.lead).toMatch(/complimentary/i);
    expect(home.pricing.lead).toContain("No payment method required");

    expect(cta.mac.note).toMatch(/complimentary access/i);
    expect(cta.mac.note).toContain("No payment method required");

    expect(
      pricingTiers.every((tier) => /complimentary access/i.test(tier.note)),
    ).toBe(true);
    expect(
      pricingTiers.every((tier) =>
        tier.note.includes("no payment method required"),
      ),
    ).toBe(true);

    expect(surfaces["Footer.astro"]).toContain("Complimentary access");
    expect(surfaces["Footer.astro"]).toContain("No payment method required");

    expect(surfaces["start.astro"]).toContain("Complimentary access");
    expect(surfaces["start.astro"]).toContain("No payment method required");
    expect(surfaces["start.astro"]).toContain(
      "complimentary access starts today",
    );

    const hesitation = faq.faqs.find((item) =>
      /just isn't for me/i.test(item.q),
    );
    expect(hesitation?.a).toMatch(/complimentary access/i);
    expect(hesitation?.a).toMatch(/no payment method required/i);

    expect(features.everythingIntro.valueLine).toMatch(/complimentary access/i);
    expect(features.everythingIntro.valueLine).toMatch(
      /no payment method required/i,
    );
  });

  it("keeps analytics event names that are not user-facing copy", () => {
    expect(surfaces["start.astro"]).toContain('trackSite("start_trial_clicked")');
    expect(surfaces["start.astro"]).toContain("trackStartTrial()");
  });
});
