// ============================================================
// /features — editor, slash, altar, scripture, looking back.
// First Light guardrails: becoming/seasons/the arc/carried.
// ============================================================

export const featuresIntro = {
  eyebrow: "Features",
  heading: "Write. Plant scripture. <em>See the pattern.</em>",
  lead: "A journal built for spiritual growth — slash commands and contemplative rituals right in the sentence, the Lamp to show where your heart has been leaning across the whole Bible, the Ascent to climb the long view of your seasons, and the Altar to gather the prayers you keep carrying.",
};

// ---- the six voices — /features' editor preview ----------------
// Copied from the app's src/lib/voices.ts (labels, blurbs, swatches, which
// modes each voice has); voices.test.ts fails the build if they drift. Each
// voice/mode pair is a real capture of the editor from `npm run screenshots:site`.
export const voices = [
  { id: "dawn", label: "Dawn", blurb: "Sunrise on paper. The one that welcomes.", modes: ["light", "dark"], swatch: "#c2683a" },
  { id: "vellum", label: "Vellum", blurb: "Aged paper, ink that bites. The manuscript.", modes: ["light", "dark"], swatch: "#8a5324" },
  { id: "cloister", label: "Cloister", blurb: "Cool stone, north light. The institution.", modes: ["light", "dark"], swatch: "#3d6d8f" },
  { id: "sabbath", label: "Sabbath", blurb: "Sage and pine. The quiet one.", modes: ["light", "dark"], swatch: "#3f7d6a" },
  { id: "plainsong", label: "Plainsong", blurb: "One line, unadorned. The plaintext voice.", modes: ["light", "dark"], swatch: "#a06a1e" },
  { id: "vigil", label: "Vigil", blurb: "Dimmed all the way down, for dark rooms.", modes: ["dark"], swatch: "#8a7f6a" },
] as const;

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
        title: "Six voices, light and dark",
        body: "A voice is the whole page, not a colour swap — its own typeface, its own paper, its own headings. Each comes in light and dark and follows your system; Vigil is dimmed all the way down for dark rooms. Then set your own size, line height, and measure.",
      },
      {
        title: "Nothing between thought and word",
        body: "Markdown-first, with no perceptible input lag and continuous autosave. Keyboard-first throughout. You'll never lose a keystroke, and you'll never wait for one.",
      },
    ],
    // `wide` + the voice picker: a real capture of the editor in each voice,
    // which says "beautiful" better than any list of settings. The slash
    // showcase this dive used to carry is item 2 on the home page.
    wide: true,
    mock: "voices",
  },
  {
    id: "practices",
    tag: "Rituals",
    heading: "Forms that <em>carry you in.</em>",
    lead: "Not a prompt of the day — contemplative writing forms drawn from two thousand years of the praying church, opened with `/ritual`. Browse the library, read the threshold, and write into a structure that knows where to begin.",
    points: [
      {
        title: "Thirteen forms, one library",
        body: "The Daily Examen, Lectio Divina, The Round, The Morning Offering, Luther's Garland, Psalmic Lament, Ignatian Discernment, and more — each with its origin, tradition, and intention named before you begin.",
      },
      {
        title: "The Round — your own week, walked",
        body: "A weekly ritual built from what you've already written: one movement for each part of your life Dayspring has noticed — work, family, the things you're carrying — asking only, what's true here this week?",
      },
      {
        title: "Scaffolding, not script",
        body: "Each section renders a label and a guiding question in the editor — display-only. Only what you type is saved. When you're done with the form, dissolve it into plain prose with one click.",
      },
      {
        title: "Finds you, doesn't wait to be found",
        body: "Search by name, tradition, or a line that's stuck with you. Or open the library empty-handed — it opens on the morning's rituals at 6am and the evening's at 9pm, and says why.",
      },
    ],
    // The full library, by hour and by century, is its own page now.
    more: { label: "See the whole library →", href: "/rituals" },
    mock: "practices",
  },
  {
    // `wide` because the visual is a 1280px screenshot: in the half column the
    // other dives use it would be the same postage stamp the home page's
    // rituals band used to be.
    id: "pages",
    tag: "Your pages",
    heading: "Everything you've written, and a way <em>back to it.</em>",
    lead: "Press ⌘1 and there it is — not a list of dates, but every entry laid out as a page. This is where most of the finding happens, so it's where most of the finding tools live.",
    wide: true,
    points: [
      {
        title: "Zoom from a decade to a line",
        body: "Continuous, not three fixed sizes. Far out, the shape of your writing life is visible — the dense months, the silences. Close in, the near end reads like an open book. Hit Return on a page to open it two-up, with room in the margin.",
      },
      {
        title: "Filters that combine",
        body: "Only entries with scripture in them. Only prayers. Only the pages you set apart. A filter you have nothing for never appears, so you're never offered an empty one. There's a plain-English box too — it sets the filters; it doesn't decide what matches.",
      },
      {
        title: "Search on your device, instantly",
        body: "⌘K searches everything you've written as you type. No network, no spinner — it works offline. Hit Return on a question instead and it goes looking for what you meant, then hands back counts, the span of time, and the sentences you actually wrote.",
      },
      {
        title: "Anniversaries, folded in",
        body: "As you scroll, pages from this date in earlier years appear in the flow — not as a notification, the way you'd come across an old letter in a drawer.",
      },
    ],
    mock: "pages",
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
  valueLine: "All of it, one plan — <strong>$64 a year</strong>, after a 14-day trial.",
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
      "Thirteen contemplative forms",
      "From Ignatius to the Psalter",
      "The Round — a weekly walk through your own life",
      "Search, or let the hour choose",
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
    // The entries list these used to describe is gone — the wall replaced it
    // (D-018/D-019). Grounded in help/the-pages-wall.md + help/find-and-ask.md.
    group: "Finding & reading back",
    items: [
      "Every page on one wall",
      "Zoom from a decade to a line",
      "Read two-up, like a book",
      "Filter by scripture, prayer, marks",
      "Filter in plain English",
      "Instant search, on your device",
      "Ask a question, get your own words",
      "Anniversaries folded into the scroll",
      "Weather — first page, longest silence",
      "Select, copy, export, delete in bulk",
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
      "A real Mac app, kept in sync",
      "iPhone app — coming soon",
      "Encrypted in transit & at rest",
      "Never sold, never trained on",
      "Zero-retention AI reflection",
      "Yours alone — between you and God",
    ],
  },
];
