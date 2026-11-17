// ============================================================
// Home page copy — the 2026-11 redesign ("night to first light").
//
// The page is one sunrise. It opens in the dark with the tagline, names the
// villain (forgetting) as entries dissolve, then shows the two acts of the
// product: I. Write — everything the inner life needs, in the line you're
// writing; II. Remember — the pages, the Lamp, the Ascent, the Altar. It ends
// on the promises (what we refuse to do) and the trial, as the sun comes up.
//
// Rules this file is held to (docs/product/BRANDSCRIPT.md, PRINCIPLES.md):
//  - the reader is the hero, Dayspring is the guide
//  - light, not verdict: nothing here scores anyone's spiritual life
//  - grounded: every sample entry is fabricated, never a real journal; ESV
//    passages are word for word, because ESV is what the app sets
//  - never "journey", "unlock", "insights", "AI-powered", "track", "wellness"
//  - privacy stated plainly: never sold, never trained on. NOT end-to-end
//    encrypted, so nothing here implies it (Principle 7)
//  - the introductory period is a 14-day trial, never "free" (D-031)
// Feature facts mirror home.ts, which /features and /rituals still read.
// ============================================================

import { altar, bringHistory, lookingBack, pages, scripture, testimonial } from "./home";

export const hero = {
  lines: ["A journal built for", "spiritual growth."],
  /** Which words of the headline take the gold italic. */
  accent: ["spiritual", "growth."],
  sub: "Scripture, prayer, and the old practices of the church — right in the page you're writing. And everything you write, kept, found again, and read back to you over the years.",
};

// ---- the hero's live editor (time-based loop, not scroll) ---------------
// The same fabricated person as the Write scene. ESV word for word.
export const heroEditor = {
  date: "Tuesday, October 6",
  line: "Dad's scan is Thursday. I keep rehearsing the worst version.",
  query: "not afraid of bad news",
  scripture: {
    ref: "Psalm 112:7",
    text: "He is not afraid of bad news; his heart is firm, trusting in the LORD.",
  },
  prayer: "Steady his hands, and mine.",
  caption: "Type / and Scripture, prayer, and practice are right there in the sentence.",
};

// ---- the whole story in one screen -------------------------------------
// Screen two. A visitor who leaves after this should still be able to say
// what Dayspring is. Each card links down to where it unfolds.
export const overview = {
  kicker: "What Dayspring is",
  heading: "Write it down. Find it again. <em>See what God has been making of you.</em>",
  parts: [
    {
      n: "01",
      word: "Write",
      title: "Everything the inner life needs, in the page.",
      body: "Scripture, prayer, the things you notice, and fifteen forms from the praying church — type / and they're in the sentence you're writing.",
      href: "#write",
    },
    {
      n: "02",
      word: "Find",
      title: "Every page, found again.",
      body: "Years of entries on one screen. Look for a name, a verse, a prayer — and every page that carries it lights.",
      href: "#pages",
    },
    {
      n: "03",
      word: "See",
      title: "The shape of your life with God.",
      body: "Your week, month, season and year, read back in your own words — the verses you leaned on, the prayers you've marked answered.",
      href: "#lamp",
    },
  ],
  verse: { text: "…the Dayspring from on high hath visited us.", ref: "Luke 1:78" },
};

// ---- the villain: forgetting -------------------------------------------
// Fragments are a fabricated person's entries — the same person as the editor
// scene below (Dad's scan, Marcus, Esther). They drift, blur and are gone.
export const forgetting = {
  fragments: [
    { text: "Dad's scan is Thursday. I keep rehearsing the worst version.", date: "Oct 6" },
    { text: "Soften my heart toward Marcus.", date: "Mar 2" },
    { text: "Felt nothing at church again. Stayed anyway.", date: "Jan 14" },
    { text: "Esther asked me to pray for her mom.", date: "Jun 9" },
    { text: "Is this a season, or a slide?", date: "Feb 21" },
    { text: "Thank you for the job. I didn't think it would come.", date: "Aug 30" },
    { text: "Psalm 23 again this morning.", date: "Apr 4" },
    { text: "Patience. Still asking.", date: "Nov 11" },
    { text: "Why does it feel like You've gone quiet?", date: "Sep 17" },
    { text: "I went in defensive and left grateful.", date: "Nov 3" },
    { text: "Lamentations 3. New every morning.", date: "May 22" },
    { text: "Couldn't sleep. Wrote instead.", date: "Dec 1" },
  ],
  // The statement lights word by word; the last word dissolves.
  statement: "You've written for years and never gone back. Not because you didn't care — because there was no way in. And what we never reread, we",
  lastWord: "forget.",
  coda: "Scripture is full of stones set up against forgetting.",
  codaAfter: "Dayspring is one more — it reads your pages back to you.",
};

export const writeHead = {
  kicker: "Write",
  heading: "Everything a Christian needs for the inner life — <em>in the line you're writing.</em>",
};

// ---- I. Write: the editor scene -----------------------------------------
// One entry, written in front of you as you scroll. Each step is a real slash
// command (src/editor/SlashPalette.tsx). Older paragraphs dim as the page
// moves up: that IS focus mode and typewriter scrolling, shown not told.
export const write = {
  window: { date: "Tuesday, October 6", title: "Thursday" },
  steps: [
    {
      kicker: "The page",
      title: "Nothing between you and the words.",
      body: "A full page with no lag and nothing nagging. Focus mode keeps your line at eye level and quietly dims the ones above. Six writing faces, light or dark, at your own size.",
    },
    {
      kicker: "/scripture",
      title: "Reach for a verse, even loosely.",
      body: "Say what you're reaching for in your own words. The passage is set right in the sentence, word for word from the ESV.",
    },
    {
      kicker: "/pray",
      title: "Lay a prayer down mid-sentence.",
      body: "Nothing required but the words. It's kept — and gathers on your Altar, so one day you can see what you asked for.",
    },
    {
      kicker: "/sense",
      title: "Catch the nudge before it slips.",
      body: "A word, an impression, something you noticed. Small things, written down, are how you'll recognise a pattern later.",
    },
    {
      kicker: "/ritual",
      title: "When you don't know where to begin.",
      body: "The Examen, Lectio Divina, a lament — forms from two thousand years of the praying church, laid over the page as gentle scaffolding.",
    },
  ],
  entry: {
    line1: "Dad's scan is Thursday. I keep rehearsing the worst version.",
    scriptureQuery: "not afraid of bad news",
    scripture: {
      ref: "Psalm 112:7",
      text: "He is not afraid of bad news; his heart is firm, trusting in the LORD.",
    },
    line2: "Firm. Not calm — firm. That's a different thing to ask for.",
    prayer: "Steady his hands, and mine. Let us hear whatever comes together.",
    sense: "Psalm 112 again — the third time it's found me this month.",
    ritual: {
      name: "The Daily Examen",
      origin: "Ignatius of Loyola · 16th c.",
      prompts: [
        { q: "Where was I consoled today?", a: "Dinner with Dad. He laughed at his own joke twice." },
        { q: "Where did I resist grace?", a: "" },
      ],
    },
  },
  palette: [
    { cmd: "/scripture", hint: "Find relevant Bible passages" },
    { cmd: "/pray", hint: "Log a prayer" },
    { cmd: "/sense", hint: "Record a word or impression" },
    { cmd: "/ritual", hint: "Rituals for the inner life" },
    { cmd: "/image", hint: "Add a photo to this entry" },
  ],
};

// ---- the rituals rail ---------------------------------------------------
export const ritualsRail = {
  kicker: "Rituals",
  heading: "Forms the church has prayed for <em>two thousand years.</em>",
  lead: "Not a prompt of the day. Type /ritual, pick the one that fits the hour, and write into a structure that knows where to start — without telling you what to say.",
  more: { label: "See the whole library", href: "/rituals" },
};

export const voice = testimonial;

// ---- II. Remember: the wall ---------------------------------------------
export const wall = {
  captions: [
    {
      kicker: "Your pages",
      title: "Every entry, laid out as a page.",
      body: "Come close and you're simply reading.",
    },
    {
      kicker: "Stand back",
      title: "Years fit on one screen.",
      body: "The dense months and the long silences, suddenly visible.",
    },
    {
      kicker: "Look for",
      title: "Every page that carries a name.",
      body: "It searches as you type — on your device, over everything you've ever written.",
    },
  ],
  focusPage: {
    date: "Thursday, March 2",
    lines: [
      "Soften my heart toward Marcus.",
      "I keep rehearsing what I'll say instead of listening to what he's saying. James 1 again: quick to hear, slow to speak.",
      "Maybe the patience I keep asking for comes in exactly these rooms.",
    ],
  },
  search: { term: "Marcus", result: "14 pages · 2021 – 2026" },
  facts: pages.facts,
  years: ["2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"],
};

// ---- the Lamp -----------------------------------------------------------
export const lamp = {
  kicker: scripture.tag,
  heading: scripture.heading,
  lead: "Every passage you write lights up the whole Bible. Warmth where you've lived; quiet — never guilt — where you haven't.",
  foot: "Not a reading plan. Not a coverage score.",
  // seasons the scene steps through, ids from scriptureCanon.ts
  seasons: [
    { id: "grief", label: "The hard year", note: "Psalms, Lamentations, Job, Habakkuk — the books that held you." },
    { id: "spring", label: "This spring", note: "The Gospels, Acts, Philippians — your eyes lifting." },
    { id: "all", label: "All of it", note: "Where your heart has been leaning, across every season." },
  ],
};

// ---- the Ascent ---------------------------------------------------------
export const ascent = {
  kicker: lookingBack.tag,
  heading: "Step back, and the shape of it <em>comes into view.</em>",
  lead: "Your week, month, season and year — not four reports, the same pages seen from further back. The further you go, the less Dayspring says.",
  horizons: lookingBack.horizons,
};

// ---- the Altar ----------------------------------------------------------
// Stones are the app's own groups: people, places, the matters that recur.
export const altarScene = {
  kicker: altar.tag,
  heading: altar.heading,
  lead: "The prayers you plant while writing gather here — by the people you carry, the places you're spent, the matters He keeps tending in you. When God meets you in one, however He moves, you mark the place.",
  stones: [
    { subject: "family", span: "14 years" },
    { subject: "work", span: "11 years" },
    { subject: "presence", span: "14 years" },
    { subject: "the church", span: "10 months", lit: true },
    { subject: "esther", span: "14 years", lit: true },
    { subject: "patience", span: "15 years", lit: true, movement: "he changed me" },
  ],
  note: altar.mock.note,
  // 1 Samuel 7:12, KJV — Samuel's stone, the Ebenezer.
  verse: { text: "Hitherto hath the LORD helped us.", ref: "1 Samuel 7:12" },
};

// ---- bring your history -------------------------------------------------
export const history = {
  kicker: bringHistory.tag,
  heading: bringHistory.heading,
  lead: "Already keep a journal in Day One or Diarly? Bring it. Your original dates are kept exactly, and on your first day the Lamp and the Ascent light up from years you've already lived.",
  sources: bringHistory.mock.sources,
  count: 1240,
  countLabel: "entries brought home",
  ready: bringHistory.mock.ready,
};

// ---- the promises (refusals as credentials) -----------------------------
export const promises = {
  kicker: "Light, not verdict",
  heading: "What Dayspring will <em>never</em> do.",
  struck: ["Streaks.", "Badges.", "Scores.", "Sermons.", "Anything invented."],
  resolve: "Just your own words, read back with care.",
  terms: [
    { title: "Nothing invented", body: "Facts are counted, quotes are verbatim. Every reflection points back to something you actually wrote." },
    { title: "Never sold, never trained on", body: "Your entries are yours. We don't sell them and no model learns from them." },
    { title: "No hostages", body: "Export everything, any time, in plain markdown." },
    { title: "Their words, their theology", body: "It learns your names and your language. It never tells you what a passage means." },
  ],
};

export const pricing = {
  kicker: "One plan",
  heading: "Begin with the whole of it. <em>Stay for the mirror.</em>",
  lead: "The editor, every slash command, the rituals, the Lamp, the Ascent and the Altar. Start with a 14-day trial, then $64 a year or $7 a month.",
};

export const closing = {
  big: "Start today. Read the year later.",
};
