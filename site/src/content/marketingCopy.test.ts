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

// ─────────────────────────────────────────────────────────────────────────
// D-031 (docs/product/DECISIONS.md) — READ BEFORE CHANGING THIS TEST.
//
// The introductory period is a 14-DAY TRIAL. Phil has decided this three
// times (2026-09-20 twice, 2026-09-21), including after #116 reverted it:
// "Complimentary conveys free, which this is not." Do not reintroduce
// "complimentary" or a "no payment method required" line — the second was
// ruled excessive.
//
// What stays banned is the part App Review objected to under 3.1.2(c) when it
// rejected 1.0.767: calling it FREE. The iOS subscriptions carry no free
// trial, so the site must never promise one. "14-day trial" is required;
// "free trial" is forbidden. Phil made this call knowing the rejection history.
// ─────────────────────────────────────────────────────────────────────────
const FORBIDDEN = [
  "complimentary",
  "no payment method",
  "free trial",
  "free to try",
  "try it for two weeks",
] as const;

// Collapse comment markers and whitespace so a phrase split across two source
// lines still fails. Analytics names (StartTrial, start_trial_clicked) do not
// match these phrases and must stay.
function flatten(text: string) {
  return text.toLowerCase().replace(/\/\//g, " ").replace(/\s+/g, " ");
}

describe("cold marketing access copy (D-031: a trial, never free)", () => {
  it.each(Object.keys(surfaces))("%s has none of the forbidden phrases", (name) => {
    const flat = flatten(surfaces[name]);
    for (const phrase of FORBIDDEN) {
      expect(flat, `${name} contains "${phrase}"`).not.toContain(phrase);
    }
  });

  it("never describes the period with a forbidden phrase in rendered copy", () => {
    for (const phrase of FORBIDDEN) {
      expect(flatten(marketingCopy)).not.toContain(phrase);
    }
  });

  it("names it a 14-day trial on every surface that names it", () => {
    expect(home.pricing.lead).toContain("14-day trial");
    expect(cta.mac.note).toContain("14-day trial");
    expect(pricingTiers.every((tier) => tier.note.includes("14-day trial"))).toBe(true);
    expect(surfaces["Footer.astro"]).toContain("14-day trial");
    expect(surfaces["start.astro"]).toContain("14-day trial starts today");

    const hesitation = faq.faqs.find((item) => /just isn't for me/i.test(item.q));
    expect(hesitation?.a).toContain("14-day trial");

    expect(features.everythingIntro.valueLine).toContain("14-day trial");
  });

  it("keeps analytics event names that are not user-facing copy", () => {
    expect(surfaces["start.astro"]).toContain('trackSite("start_trial_clicked")');
    expect(surfaces["start.astro"]).toContain("trackStartTrial()");
  });
});
