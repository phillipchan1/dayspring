// ============================================================
// /features — editor, slash, altar, scripture, looking back.
// First Light guardrails: becoming/seasons/the arc/carried.
// ============================================================

export const featuresIntro = {
  eyebrow: "Features",
  heading: "Write. Plant scripture. <em>See the pattern.</em>",
  lead: "A journal built for spiritual growth — slash commands and contemplative rituals right in the sentence, the Lamp to show where your heart has been leaning across the whole Bible, the Ascent to climb the long view of your seasons, and the Altar to gather the prayers you keep carrying.",
};

// each deep dive renders with a live app-element mock (not a screenshot)
export const deepDives = [
  {
    id: "editor",
    tag: "The editor",
    heading: "A page worth <em>returning to.</em>",
    lead: "The editor is the soul of Dayspring. If it isn't a joy to write in, nothing else matters — so this is where the most care went.",
    points: [
      {
        title: "Slash commands",
        body: "Type `/` for scripture, prayer, a sense, a ritual, or an inline photo. Inline glass panels, keyboard-native, dismissible. The spiritual life captured where it actually happens — in the middle of a sentence.",
      },
      {
        title: "Focus mode",
        body: "Everything but your words disappears. Typewriter scrolling keeps the line you're writing at eye level; the lines above quietly dim. Just you and the page.",
      },
      {
        title: "Light, dark, and your own hand",
        body: "A light or dark surface, set to follow your system. Then choose your writing face — Serif, Literary, Typewriter, Mono, Sans, or Readable — and set your own size, line height, and measure.",
      },
      {
        title: "Nothing between thought and word",
        body: "Markdown-first, with no perceptible input lag and continuous autosave. Keyboard-first throughout. You'll never lose a keystroke, and you'll never wait for one.",
      },
    ],
    mock: "slash",
  },
  {
    id: "practices",
    tag: "Rituals",
    heading: "Forms that <em>carry you in.</em>",
    lead: "Not a prompt of the day — contemplative writing forms drawn from two thousand years of the praying church, opened with `/ritual`. Browse the library, read the threshold, and write into a structure that knows where to begin.",
    points: [
      {
        title: "Nine forms, one library",
        body: "The Daily Examen, Lectio Divina, SOAP, Psalmic Lament, Wesley's Questions, Prayer of Recollection, Ignatian Discernment, and more — each with its origin, tradition, and intention named before you begin.",
      },
      {
        title: "Scaffolding, not script",
        body: "Each section renders a label and a guiding question in the editor — display-only. Only what you type is saved. When you're done with the form, dissolve it into plain prose with one click.",
      },
      {
        title: "Filter by what you need",
        body: "Examine, encounter, listen, lament, gratitude, form — browse by the contemplative function, not by denomination. The same page holds Ignatius and the Psalter.",
      },
    ],
    mock: "practices",
  },
  {
    id: "altar",
    tag: "The Altar",
    heading: "A place of <em>remembrance.</em>",
    lead: "Not a prayer to-do list. The prayers and senses you plant while writing gather here on their own — and when God meets you in one, however He moves, you mark the place.",
    points: [
      {
        title: "Gathered by what you carry",
        body: "The names you keep bringing to God, the places and callings your prayers are spent on, the matters He keeps tending in you — each one kept before Him, with how long you've held it laid plainly alongside.",
      },
      {
        title: "However He moved — not a checkbox",
        body: "No answered / unanswered toggle. You name what happened in honest words: answered, redirected, surrendered, or He changed me. And still carrying is a posture of faith, not a missed deadline.",
      },
      {
        title: "Thus far the Lord has helped",
        body: "Switch to the Over-time view and the altar becomes a testimony — where God has met you across the years, stones of remembrance to carry back into prayer, not requests to file away as closed.",
      },
    ],
    mock: "altar",
  },
  {
    id: "scripture",
    tag: "The Lamp",
    heading: "Where your heart has been <em>leaning.</em>",
    lead: "The feature we kept reaching for and never found. Not coverage — returns. The whole Bible, lit by your journal.",
    points: [
      {
        title: "Warmth where you've lived",
        body: "Every chapter you've touched, glowing by how often you came back. Quiet where you haven't. No streak. No shame.",
      },
      {
        title: "Seasons change the picture",
        body: "Scrub to the hard year — Psalms and Lamentations. Spring — John and Philippians. The map remembers what you couldn't see yet.",
      },
      {
        title: "Your words, still there",
        body: "Tap a book. Read what you wrote the night that verse found you.",
      },
    ],
    mock: "scripture",
  },
  {
    id: "looking-back",
    tag: "The Ascent",
    heading: "See who you're <em>becoming.</em>",
    lead: "The Lamp shows where your heart leaned; the Ascent shows who you're becoming — not a stack of reports, but elevation over one terrain, climbed from the Valley of the week to the Summit of the year.",
    points: [
      {
        title: "Four altitudes, one terrain",
        body: "Week, month, quarter, and year aren't four summaries. They're heights over the same landscape — the lines you wrote, the verse you reached for, the prayer you kept — each resolving at a longer range as you climb.",
      },
      {
        title: "The higher you go, the less it says",
        body: "In the Valley it only puts your words in order. On the Hillside it names a pattern — as a question. At the Summit it goes nearly silent and hands back your own marks. No verdicts, no scores, no streaks.",
      },
      {
        title: "Watching this season",
        body: "Keep a row of lenses in view — gain, gratitude, scripture, work, family — so the climb stays anchored to what you're actually paying attention to right now.",
      },
    ],
    mock: "letter",
  },
];

// ============================================================
// "Everything in Dayspring" — the exhaustive checklist. Every item is
// grounded in the shipped app (editor extensions, settings, shortcuts,
// import/export, the three Return views). Keep items short; this section
// exists to show how much is actually here.
// ============================================================
export const everythingIntro = {
  tag: "Everything in Dayspring",
  heading: "The small things, <em>all the way down.</em>",
  lead: "One premium plan, and a great deal of care. Here's the whole of it — the page, the tools in the sentence, the long view, and everything underneath.",
  valueLine: "All of it, one plan — <strong>$64 a year</strong>, with a 14-day free trial.",
};

export const everything = [
  {
    group: "The page you write on",
    items: [
      "Full-screen, distraction-free editor",
      "Focus mode",
      "Typewriter scrolling",
      "Paragraph dimming",
      "Six writing faces — Serif to Mono",
      "Your own size, line height & measure",
      "Light & dark, follows your system",
      "Continuous autosave — never lose a word",
      "No perceptible input lag",
    ],
  },
  {
    group: "Writing tools",
    items: [
      "Markdown-native",
      "Bold, italic, inline code & links",
      "Selection format bar",
      "Headings, lists & quotes",
      "Task lists with checkboxes",
      "Inline photos — drop or paste",
      "First line as title (optional)",
      "Keyboard-first throughout",
      "Shortcut guide — press ?",
    ],
  },
  {
    group: "Slash commands",
    items: [
      "/scripture — ESV, word-for-word",
      "/pray — log a prayer",
      "/sense — a word or impression",
      "/ritual — contemplative forms",
      "/image — a photo, inline",
      "Scripture references, auto-linked",
    ],
  },
  {
    group: "The Rituals library",
    items: [
      "Nine contemplative forms",
      "From Ignatius to the Psalter",
      "Filter by what you need",
      "Guiding questions, in the editor",
      "Optional previews before you begin",
      "Dissolve a form into plain prose",
    ],
  },
  {
    group: "Looking back",
    items: [
      "The Lamp — your whole canon, lit",
      "Scrub the Lamp by season",
      "Tap a book to reread that night",
      "The Ascent — week to year",
      "Weekly & monthly reflections",
      "The Altar — prayers gathered",
      "Altar's “over time” testimony",
    ],
  },
  {
    group: "Finding & organizing",
    items: [
      "List, Month & Year views",
      "Search every entry",
      "Entry previews in the list",
      "Collapsible sidebar",
    ],
  },
  {
    group: "Your history & data",
    items: [
      "Import from Day One",
      "Import from Diarly",
      "Import Markdown",
      "Your photos come too",
      "Parsed privately, on your device",
      "Export your whole journal",
      "First look-back ready on day one",
    ],
  },
  {
    group: "Trust & platform",
    items: [
      "macOS & web, kept in sync",
      "iPhone app — coming soon",
      "Encrypted in transit & at rest",
      "Never sold, never trained on",
      "Zero-retention AI reflection",
      "Yours alone — between you and God",
    ],
  },
];
