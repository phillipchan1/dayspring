import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hero, privacy } from "./home";
import { downloads, pricingTiers, site, trialCta, webApp } from "./site";

const FORBIDDEN_APP_HOSTS = /dayspring\.app|dayspringapp\.com/i;
const here = dirname(fileURLToPath(import.meta.url));

describe("homepage acquisition door", () => {
  it("sends the primary CTA to the live web app, not a Mac download", () => {
    expect(hero.primary.label).toBe("Start the 14-day trial");
    expect(hero.primary.href).toBe(trialCta.href);
    expect(hero.primary.href).toBe(webApp.href);
    expect(hero.primary.href).toBe("https://dayspring-eosin.vercel.app");
    expect(hero.primary.href).not.toMatch(/\.dmg/);
    expect(hero.primary.href).not.toBe(downloads.macos.href);
  });

  it("does not invent dayspring.app or dayspringapp.com", () => {
    expect(webApp.href).not.toMatch(FORBIDDEN_APP_HOSTS);
    expect(site.url).toMatch(/usedayspring\.app/);
    expect(hero.primary.href).not.toMatch(FORBIDDEN_APP_HOSTS);
    expect(trialCta.href).not.toMatch(FORBIDDEN_APP_HOSTS);
  });

  it("keeps the Mac download secondary and off the phone door", () => {
    expect(hero.macos?.href).toBe(downloads.macos.href);
    expect(downloads.macos.href).toMatch(/\.dmg$/);
    expect(hero.primary.href).not.toBe(hero.macos?.href);

    const heroMarkup = readFileSync(join(here, "../components/Hero.astro"), "utf8");
    const navMarkup = readFileSync(join(here, "../components/Nav.astro"), "utf8");
    expect(heroMarkup).toMatch(/\.macos-only\s*\{\s*display:\s*none;/);
    expect(navMarkup).toMatch(/\.navlinks a\.dl-macos\s*\{\s*display:\s*none;/);
    expect(navMarkup).toMatch(/class="dl dl-soon"/);
  });

  it("points pricing CTAs at the trial, not a .dmg", () => {
    for (const tier of pricingTiers) {
      expect(tier.cta.label).toBe(trialCta.label);
      expect(tier.cta.href).toBe(webApp.href);
      expect(tier.cta.href).not.toMatch(/\.dmg/);
    }
  });

  it("states the honest privacy line that matches shipped truth", () => {
    expect(privacy.body).toMatch(/encrypted in transit and at rest/i);
    expect(privacy.body).toMatch(/we hold the key/i);
    expect(privacy.body).toMatch(/never used to train AI/i);
    expect(privacy.body).not.toMatch(/end-to-end/i);
    expect(privacy.body).not.toBe(
      "Your entries are encrypted, never sold, and never used to train AI — and never read by us. What you write here is yours alone.",
    );
    expect(privacy.line).toBe("It's just between you and God.");
  });
});
