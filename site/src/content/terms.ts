// ============================================================
// /terms — Terms of Use.
//
// Copy is the live app terms at https://dayspring-eosin.vercel.app/terms
// (public/legal/terms.html, last updated 30 July 2026). Do not invent or
// paraphrase legal language; if the app terms change, update this to match.
// ============================================================

export type TermsBullet = {
  label: string;
  body: string;
};

export type TermsSection = {
  heading: string;
  paragraphs: string[];
  bullets?: TermsBullet[];
  after?: string[];
};

export const termsPage = {
  title: "Terms of Use",
  description:
    "These terms govern your use of Dayspring, a subscription journalling application. By creating an account or using the app, you agree to them.",
  updated: "30 July 2026",
  intro:
    "These terms govern your use of Dayspring, a subscription journalling application. By creating an account or using the app, you agree to them.",
  sections: [
    {
      heading: "Your account",
      paragraphs: [
        "You need an account to use Dayspring. You are responsible for keeping access to your sign-in method secure. One account is for one person; please do not share it.",
      ],
    },
    {
      heading: "Subscriptions and billing",
      paragraphs: [
        "Dayspring is offered as an auto-renewing subscription. On the web it is $7 per month or $64 per year. In the iOS app it is $7.99 per month or $69.99 per year — App Store pricing uses its own tiers, and the price you see there is set by Apple for your storefront and currency, so it may differ again from both figures.",
      ],
      bullets: [
        {
          label: "On the web and desktop",
          body: "payment is processed by Stripe. You can update payment details or cancel at any time from the billing portal in Settings.",
        },
        {
          label: "In the iOS app",
          body: "payment is charged to your Apple Account at confirmation of purchase. The subscription renews automatically unless auto-renew is turned off at least 24 hours before the end of the current period. Your account is charged for renewal within 24 hours of the end of the period. You can manage or cancel the subscription in your Apple Account settings; deleting the app does not cancel it.",
        },
      ],
      after: [
        "A subscription purchased on one platform unlocks Dayspring on every platform. You only ever need one. Where a subscription is billed by Apple, it can only be changed or cancelled through Apple; we cannot cancel or refund it on your behalf.",
      ],
    },
    {
      heading: "Free trial",
      paragraphs: [
        "New accounts receive a 14-day trial granted in the app, with no payment method required. When the trial ends, your journal remains intact and fully exportable; new writing and the reflective features require a subscription.",
      ],
    },
    {
      heading: "Refunds",
      paragraphs: [
        "Purchases made through the App Store are subject to Apple's refund policy and must be requested from Apple. For subscriptions billed through Stripe, contact us.",
      ],
    },
    {
      heading: "Your content",
      paragraphs: [
        'Everything you write, photograph or record in Dayspring remains yours. You grant us only the limited permission needed to operate the service for you — to store your content, to transmit it to the processors listed in our <a href="/privacy">Privacy Policy</a>, and to generate the reflective features you have asked for. We claim no ownership and no right to publish it.',
      ],
    },
    {
      heading: "What Dayspring is not",
      paragraphs: [
        "Dayspring surfaces your own words back to you. It selects and quotes what you have already written; it does not evaluate your spiritual life and does not score it. It is not spiritual direction, pastoral counselling, therapy, or medical or mental-health advice, and it is not a substitute for any of those. If you are in crisis, please contact a qualified professional or an emergency service in your area.",
        "Automatically generated summaries and reflections can be imperfect. Please treat them as a prompt for your own reflection rather than as an authority.",
      ],
    },
    {
      heading: "Acceptable use",
      paragraphs: [
        "Please do not use Dayspring to break the law, to infringe someone else's rights, to upload content you have no right to, or to attempt to gain unauthorised access to the service or to other people's data.",
      ],
    },
    {
      heading: "Availability and changes",
      paragraphs: [
        "We aim to keep Dayspring available and to improve it over time. Features may change. If we discontinue the service, we will give reasonable notice and ensure you can export your journal first.",
      ],
    },
    {
      heading: "Termination",
      paragraphs: [
        "You may stop using Dayspring at any time, and you can export your journal whenever you wish. We may suspend an account that materially breaches these terms.",
      ],
    },
    {
      heading: "Disclaimers and liability",
      paragraphs: [
        'Dayspring is provided on an "as is" and "as available" basis, without warranties of any kind to the fullest extent permitted by law. To the fullest extent permitted by law, our total liability arising out of or relating to the service is limited to the amount you paid us in the twelve months before the claim arose. Nothing in these terms excludes liability that cannot lawfully be excluded, and some jurisdictions do not allow certain exclusions, in which case they may not apply to you.',
      ],
    },
    {
      heading: "Contact",
      paragraphs: [
        '<a href="mailto:hello@usedayspring.app">hello@usedayspring.app</a>',
      ],
    },
  ] satisfies TermsSection[],
  // Same closing links as the live vercel terms page.
  closing: {
    privacyLabel: "Privacy Policy",
    privacyHref: "/privacy",
    homeLabel: "Dayspring",
    homeHref: "/",
  },
} as const;
