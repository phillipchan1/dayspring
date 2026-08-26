import { describe, expect, it } from "vitest";
import { footerLinks } from "./site";
import { termsPage } from "./terms";

function flattenTerms(): string {
  return [
    termsPage.title,
    termsPage.intro,
    ...termsPage.sections.flatMap((section) => [
      section.heading,
      ...section.paragraphs,
      ...(section.bullets ?? []).flatMap((b) => [b.label, b.body]),
      ...(section.after ?? []),
    ]),
  ].join("\n");
}

describe("terms of use", () => {
  const text = flattenTerms();

  it("is linked from the site footer", () => {
    expect(footerLinks.some((link) => link.href === "/terms")).toBe(true);
  });

  it("keeps the live vercel subscription and cancel language", () => {
    expect(text).toContain("auto-renewing subscription");
    expect(text).toContain("$7 per month or $64 per year");
    expect(text).toContain("$7.99 per month or $69.99 per year");
    expect(text).toContain("Stripe");
    expect(text).toContain("cancel at any time from the billing portal in Settings");
    expect(text).toContain("Apple Account");
    expect(text).toContain(
      "renews automatically unless auto-renew is turned off at least 24 hours",
    );
    expect(text).toContain("manage or cancel the subscription in your Apple Account settings");
    expect(text).toContain("14-day trial");
    expect(text).toContain("billed by Apple, it can only be changed or cancelled through Apple");
  });
});
