// ============================================================
// Home page copy. Two acts that mirror the app's own IA:
//   Act I — WRITE: the daily practice (editor + slash commands)
//   Act II — RETURN: the long view ("See who you're becoming"),
//            wrapping the Lamp, the Ascent, and the Altar.
// Umbrella positioning: a journal built for spiritual growth.
// Edit prose here; index.astro stays structural.
// Inline <em>…</em> marks accented (italic/gold) phrases.
// Slash command names + hints are authoritative to the app
// (src/editor/SlashPalette.tsx): /scripture /pray /sense /ritual /image.
// ============================================================

import { downloads } from "./site";

export const hero = {
  eyebrow: "A journal for the inner life",
  lines: ["A journal built for", "<em>spiritual growth.</em>"],
  sub: "Scripture, prayer, and the contemplative practices of the church — built right into the page. Write each day, and a year of your own words will show you who you're becoming.",
  verse: {
    text: "…the Dayspring from on high has visited us",
    ref: "Luke 1:78",
  },
  primary: { label: "Download for macOS", href: downloads.macos.href },
  ghost: { label: "Why we built it →", href: "/why" },
  /** Shown beneath the hero app mock — one quiet editor promise. */
  mockCaption: "Type / and the spiritual life is right there in the sentence.",
  /** Hero mock — the editor mid-sentence with the slash palette open, so a
   *  believer sees instantly this was built for them. (The Slash Showcase
   *  section below demos each command resolving inline.) */
  appMock: {
    open: {
      date: "march 14",
      status: "112 words · saved just now · synced",
      title: "Hard conversation with Marcus",
      body: [
        "I've been praying about patience for months now.",
      ],
    },
    slash: {
      typed: "/",
      activeId: "scripture",
    },
  },
};

// the wedge — one line. `today` is highlighted in rose italic.
// Owns the category: built for the inner life, not for today.
export const problem = {
  before: "Most journals are built for ",
  highlight: "today",
  after: ". Dayspring is built for the inner life — the slow work a single day is too small to hold.",
};

// ---- ACT I · THE EDITOR -------------------------------------
// Proof it isn't lame — the page has to be a joy first.
export const editor = {
  tag: "The editor",
  heading: "A page worth <em>returning to.</em>",
  lead: "If a journal isn't a joy to write in, you won't open it. So this is where the most care went — a full-screen page with nothing between you and the words.",
  highlights: [
    {
      title: "Focus mode",
      body: "Everything but your words disappears. Typewriter scrolling keeps your line at eye level; the lines above quietly dim.",
    },
    {
      title: "Light, dark, your own hand",
      body: "A surface that follows your system, and six writing faces — Serif, Literary, Typewriter, Mono, Sans, or Readable — each at your own size, line height, and measure.",
    },
    {
      title: "Nothing between thought and word",
      body: "Markdown-native, continuous autosave, no perceptible lag. You'll never lose a keystroke, and you'll never wait for one.",
    },
  ],
};

// ---- ACT I · SLASH COMMANDS (the signature moment) ----------
// Show, don't tell: the spiritual life captured in the sentence.
export const slashCommands = {
  tag: "Slash commands",
  heading: "The spiritual life, captured <em>where it happens.</em>",
  lead: "Scripture, a prayer, a fleeting impression, an ancient practice — type <em>/</em> and it opens right in the line you're writing. No sidebar, no leaving the page.",
  bridge:
    "None of it is busywork. Every verse, prayer, and practice is quietly gathered — and over time, it shows you something.",
  commands: [
    {
      id: "scripture",
      label: "/scripture",
      hint: "Find relevant Bible passages",
      blurb: "Name what you're reaching for, even loosely. Dayspring finds the passage and sets it inline, word-for-word from the ESV — and every reference lights up your Lamp.",
    },
    {
      id: "pray",
      label: "/pray",
      hint: "Log a prayer",
      blurb: "Lay it down mid-sentence. Nothing required but the words — and it's kept, to gather on your Altar over time.",
    },
    {
      id: "sense",
      label: "/sense",
      hint: "Record a word or impression",
      blurb: "A nudge, a word, a picture you don't want to lose. Catch it before it slips away.",
    },
    {
      id: "ritual",
      label: "/ritual",
      hint: "Rituals for the inner life",
      blurb: "Open a library of contemplative forms — the Examen, Lectio Divina, lament — and write into a structure that knows where to begin.",
    },
    {
      id: "image",
      label: "/image",
      hint: "Add a photo to this entry",
      blurb: "Drop a photo straight into the entry, where the moment actually lives — not off in a sidebar.",
    },
  ],
  editorLines: [
    "I went in defensive and left grateful — not sure when that shifted.",
    "I've been praying about patience for months now.",
  ],
  // the auto-cycling demo (SlashShowcase) plays these in order: the typed
  // command, then how it resolves inline.
  demo: [
    {
      label: "/scripture",
      typed: "patient with difficult people",
      result: { kind: "scripture", ref: "James 1:19", text: "…quick to hear, slow to speak, slow to anger." },
    },
    {
      label: "/pray",
      typed: "soften my heart toward Marcus",
      result: { kind: "pray", text: "Soften my heart toward Marcus." },
    },
    {
      label: "/sense",
      typed: "an answer I almost walked past",
      result: { kind: "sense", text: "Maybe this was an answer I almost walked past." },
    },
    {
      label: "/ritual",
      typed: "examen",
      result: { kind: "ritual", text: "The Daily Examen — where was I consoled today? Where did I resist grace?" },
    },
  ],
};

// Retained for the home editor section (conveniences) + the WritingGlimpse.
export const writingPage = {
  tag: "The editor",
  heading: "A page worth <em>returning to.</em>",
  lead: "Full-screen, zero lag, nothing nagging you. When you need scripture, a prayer, or somewhere to begin — type <em>/</em> and stay in the sentence.",
  bridge:
    "What you plant doesn't disappear: it maps on the Lamp and feeds the Ascent over time.",
  glimpse: {
    line: "I've been praying about patience for months now.",
    fuzzy: "patient with difficult people",
    match: { ref: "James 1:19", text: "quick to hear, slow to speak, slow to anger…" },
    canon: ["Psalm 23:2", "James 1:19", "Romans 8:28"],
  },
};

// ---- ACT I · RITUALS (/ritual) ------------------------------
export const practices = {
  tag: "Rituals",
  heading: "When you don't know where to <em>begin.</em>",
  lead: "Not a prompt of the day. Nine contemplative forms drawn from two thousand years of the praying church — opened with <em>/ritual</em> and laid over the page as gentle scaffolding that knows where to start without telling you what to say.",
  rituals: [
    {
      name: "The Daily Examen",
      era: "Ignatius · 16th c.",
      note: "Where was I consoled? Where did I resist grace?",
    },
    {
      name: "Lectio Divina",
      era: "Benedict · 6th c.",
      note: "Read. Meditate. Pray. Contemplate.",
    },
    {
      name: "Psalmic Lament",
      era: "The Psalter",
      note: "Complain honestly. Ask boldly. Trust anyway.",
    },
  ],
  foot: "Nine forms today — Examen, Lectio, SOAP, Wesley's Questions, Psalmic Lament, Prayer of Recollection, and more.",
  // retained for the /features deep dive (PracticeMock)
  filters: ["All", "Examine", "Encounter", "Listen", "Lament", "Gratitude", "Form"],
  cards: [
    {
      function: "Examine",
      name: "The Daily Examen",
      origin: "Ignatius of Loyola, 16th century",
      tradition: "Ignatian",
      quote: "Where was I consoled today? Where did I resist grace?",
    },
    {
      function: "Encounter",
      name: "Lectio Divina",
      origin: "Benedict of Nursia, 6th century",
      tradition: "Benedictine",
      quote: "Read. Meditate. Pray. Contemplate. Let the Word find you.",
    },
    {
      function: "Lament",
      name: "Psalmic Lament",
      origin: "Ancient — the Hebrew Psalter",
      tradition: "Hebrew",
      quote: "Address God. Complain honestly. Ask boldly. Trust anyway.",
    },
    {
      function: "Listen",
      name: "Ignatian Discernment",
      origin: "Ignatius of Loyola, 16th century",
      tradition: "Ignatian",
      quote: "Which choice brings deeper peace? Not comfort — peace.",
    },
  ],
  active: {
    name: "The Daily Examen",
    prompts: [
      {
        label: "Gratitude",
        question: "What am I grateful for from today — even one small thing?",
        answer: "The conversation with Marcus — it went better than I feared.",
      },
      {
        label: "Awareness",
        question: "Where did I feel most alive? Where most distant from God?",
        placeholder: "Consolation and desolation, honestly…",
      },
    ],
  },
  note: "Nine forms today — Examen, Lectio, SOAP, lament, recollection, and more.",
};

// ---- THE BRIDGE — Act I → Act II ----------------------------
// The strategic spine, placed as the turn into the long view.
export const bridge = {
  line: "A day is too small to hold a pattern. <em>A year is a mirror.</em>",
};

// ---- ACT II · BANNER ("See who you're becoming") ------------
// Frames the three RETURN features as one arc.
export const becoming = {
  tag: "The long view",
  heading: "See who you're <em>becoming.</em>",
  lead: "The growth that matters most is the hardest to feel day to day — patience arriving, prayer deepening, what you believe moving from your head to your heart. So Dayspring reads your own words back to you, and shows you, gently, how far you've been carried.",
};

// The Lamp (Scripture) — canon heatmap (killer feature)
export const scripture = {
  tag: "The Lamp",
  heading: "Where your heart has been <em>leaning.</em>",
  lead: "Every passage you write lights up the whole Bible — not a reading plan, not a coverage score. Warmth where you've lived; quiet, never guilt, where you haven't. Scrub by season, and watch the hard year look nothing like spring.",
};

// The Ascent — not four reports, but elevation over one terrain. The stable
// dimensions persist as you climb Valley → Summit and only change resolution.
// The higher you go, the less the app interprets.
export const lookingBack = {
  tag: "The Ascent",
  heading: "The same terrain, from four <em>altitudes.</em>",
  lead: "Not four reports — elevation over one landscape. Your words, the verses you reached for, the prayers you kept. Climb from Valley to Summit, and the higher you go, the less Dayspring says — it arranges, then asks, then goes quiet and hands you back your own words.",
  caption:
    "Looking back down the year — the trail lit by the ropes you climbed past.",
  glimpse: {
    altitudes: [
      { label: "Week", alt: "Valley" },
      { label: "Month", alt: "Hillside" },
      { label: "Quarter", alt: "Ridge" },
      { label: "Year", alt: "Summit" },
    ],
    activeAlt: "Summit",
    activeLabel: "Year",
    oneLine: "I went in defensive and left grateful.",
    verseRef: "James 1:19",
    hint: "In the app — climb week to year",
  },
  // the persistent "watching this season" attention row, shown above every altitude
  lenses: ["gain", "gratitude", "scripture", "work", "family"],
  horizons: [
    {
      id: "week",
      label: "Week",
      alt: "Valley",
      title: "Standing in the days.",
      line: "Close to the ground — your own words, in the order you lived them. The app only arranges.",
      dimensions: [
        {
          eyebrow: "Your words · in order",
          body: "Monday, bracing for the worst. Thursday, the hard conversation with Marcus. Friday — <em>I left grateful, and I'm not sure when that shifted.</em>",
        },
        {
          eyebrow: "What you reached for",
          ref: "James 1:19",
          body: "Quick to hear, slow to speak, slow to anger.",
          meta: "in 2 entries",
        },
      ],
      voice: "In order, nothing interpreted yet — you're close enough to feel them.",
    },
    {
      id: "month",
      label: "Month",
      alt: "Hillside",
      title: "What you kept returning to.",
      line: "Step back, and the same dimensions resolve at month scale — named only as a question.",
      dimensions: [
        {
          eyebrow: "The lines you kept",
          body: "Less about bracing. More about the people in front of you.",
        },
        { eyebrow: "The month's recurring verse", ref: "James 1:19" },
        {
          eyebrow: "What you kept asking",
          body: "That I'd listen before I defend.",
        },
        {
          eyebrow: "You started to see…",
          body: "Patience, showing up in small places — the dinner table, the long call with your brother.",
        },
      ],
      voice: "↑ The app names what seems to connect — tentatively. Each is yours to rename or wave off.",
    },
    {
      id: "quarter",
      label: "Quarter",
      alt: "Ridge",
      title: "The season, distilled.",
      line: "From the ridge the season distills — and the app holds it up and hands it back.",
      dimensions: [
        {
          eyebrow: "The phrases you circled",
          body: "less bracing · more showing up · slow to speak",
        },
        {
          eyebrow: "The season's anchor passage",
          ref: "James 1",
          meta: "returned to all spring",
        },
        {
          eyebrow: "The prayer, and first signs",
          before: "Soften my heart toward Marcus.",
          after: "I went in defensive and left grateful.",
          when: "first signs",
        },
        {
          eyebrow: "What you now hold",
          body: "Patience isn't summoned. It arrives while you're busy showing up.",
        },
      ],
      voice: "↑ The app asks; it never answers. These go back to you, and to God — not to a verdict.",
    },
    {
      id: "year",
      label: "Year",
      alt: "Summit",
      title: "Looking back down the year.",
      line: "The quietest ground — your own words and the stones you set. The app nearly disappears.",
      dimensions: [
        {
          eyebrow: "The one line of the year",
          body: "I went in defensive and left grateful.",
          emphasis: true,
        },
        { eyebrow: "The verse of the year", ref: "James 1:19" },
        {
          eyebrow: "The prayer, and the Ebenezer",
          before: "Soften my heart toward Marcus.",
          after: "I left grateful.",
          when: "March → November",
        },
      ],
      closing: "Looking back down the trail — what did He teach you this year?",
    },
  ],
};

// ---- ACT II · THE ALTAR (shipped — "a place of remembrance") ----
// The prayers and senses you plant gather here, grouped by subject. When God
// meets you in one, you mark it. NOT a coming-soon teaser anymore.
export const altar = {
  tag: "The Altar",
  heading: "A place of <em>remembrance.</em>",
  lead: "Not a prayer to-do list. The prayers and senses you plant while writing gather here — by the people you carry, the places you're spent, and the matters He keeps tending in you. And when God meets you in one, however He moves, you mark the place. A way to remember that, thus far, the Lord has helped.",
  mock: {
    subtitle: "A place of remembrance",
    intro: "Lately your prayers have circled around esther, family.",
    // grouped exactly as the app does: people / places / recurring matters.
    groups: [
      {
        title: "Names you keep bringing to God",
        note: "the people you carry",
        items: [
          { subject: "esther", span: "kept before Him · across 14 years", lit: true },
          { subject: "family", span: "kept before Him · across 14 years" },
        ],
      },
      {
        title: "Places & callings",
        note: "where your prayers are spent",
        items: [
          { subject: "work", span: "kept before Him · across 11 years" },
          { subject: "the church", span: "returned to again and again · over 10 months", lit: true },
        ],
      },
      {
        title: "What He keeps tending in you",
        note: "the matters that recur",
        items: [
          { subject: "patience", span: "kept before Him · across 15 years", lit: true, movement: "he changed me" },
          { subject: "presence", span: "kept before Him · across 14 years" },
        ],
      },
    ],
    note: "Some He answered. Some He redirected. Some you're still carrying.",
  },
};

// ---- ACT III · BRING YOUR HISTORY (cold-start killer) -------
export const bringHistory = {
  tag: "Bring your history",
  heading: "Years of journaling, <em>brought with you.</em>",
  lead: "Already keep a journal in Day One or Diarly? Import it, and Dayspring hands you a look back at last month — and last year — on your very first day. The Lamp and the Ascent both light up from your own history. Nothing starts from scratch.",
  mock: {
    sources: ["Day One", "Diarly", "Markdown"],
    imported: "1,240 entries imported",
    ready: "Your first look back is ready.",
  },
};

// ---- ACT III · PRIVACY AS STEWARDSHIP ----------------------
// Carries the single unmistakable faith line.
export const privacy = {
  tag: "Privacy as stewardship",
  heading: "Some things are meant to be written <em>before they're ever spoken aloud.</em>",
  body: "Your entries are encrypted, never sold, and never used to train AI — and never read by us. What you write here is yours alone.",
  line: "It's just between you and God.",
};

// ---- ACT III · PRICING -------------------------------------
export const pricing = {
  tag: "Pricing",
  heading: "Try it for two weeks. <em>Stay for the mirror.</em>",
  lead: "One premium plan — the editor, every slash command, the Lamp, the Ascent, and the Altar. Start with 14 days free, then $64 a year or $7 a month.",
};

// ---- Formation — retained for reference (not on the home page) ----
export const formation = {
  tag: "Formation",
  heading: "Track the things that never make it onto a <em>to-do list.</em>",
  lead: "Are you growing in patience? Is your prayer life deepening? Is what you believe finally moving from your head to your heart? These are the changes that matter most and are hardest to see day to day. Dayspring watches for them over time, gently — and shows you the movement.",
};

// the Gain — not the Gap (retained for reference)
export const gain = {
  quote:
    "Measure backward, not forward. Each horizon compares you to who you actually were — never the person you think you should already be.",
  attribution: "The Gain · not the Gap",
};
