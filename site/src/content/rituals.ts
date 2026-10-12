// ============================================================
// /rituals — the practice library as its own page.
//
// The library is the most tradition-grounded thing in Dayspring and the
// clearest answer to "what would I actually DO in here?", so it gets a page
// rather than a band. Three claims, in order: it's grounded (every form names
// where it came from), it's easy (type /ritual; the shelf knows the hour), and
// it's growing (the old forms, with a few modern ones beside them).
//
// SOURCE OF TRUTH: src/editor/practices/practicesData.ts in the app. Names,
// origins, traditions and card quotes below are copied verbatim from it — with
// ONE deliberate exception: Threshold's tradition pill reads "Secular" in the
// app and "Contemporary" here, because on a page for Christians "Secular"
// reads as a warning label rather than a provenance. Revisit if that's wrong. And
// rituals.test.ts fails the build if a live practice is missing here or a
// retired one is still listed — so the page can't quietly drift from the shelf.
// ============================================================

export type Rhythm = "morning" | "midday" | "evening" | "weekly" | "anytime";

export interface Ritual {
  name: string;
  /** Verbatim from practicesData `origin`. */
  origin: string;
  /** Verbatim from practicesData `tradition`. */
  tradition: string;
  /** Verbatim from practicesData `quote` — the library card's pull quote. */
  quote: string;
  /** The app's FIRST rhythm — decides which shelf the card sits on here. */
  rhythm: Rhythm;
  /** The era the timeline files it under. */
  era: EraId;
}

export type EraId = "ancient" | "6th" | "16th" | "18th" | "today";

export const intro = {
  eyebrow: "Rituals",
  heading: "When you don't know where to <em>begin.</em>",
  lead: "Thirteen contemplative forms from the praying church — and a few modern ones beside them. Type <em>/ritual</em>, pick the one that fits the hour, and write into a structure that knows where to start without telling you what to say.",
  shotAlt:
    "The Dayspring ritual library on the morning shelf: The Morning Offering, New Every Morning, Luther's Garland, Lectio Divina, SOAP and the Prayer of Recollection, each with its origin and tradition.",
  caption: "The shelf in the morning. It knows the hour, so the rituals to begin the day come first.",
};

// ---- grounded -------------------------------------------------
export const grounded = {
  tag: "Grounded",
  heading: "Prayed long <em>before us.</em>",
  lead: "None of these were invented for an app. Each form names where it came from — the Psalter, Benedict, Luther, Ignatius, Teresa, Wesley — and keeps the shape they gave it.",
};

export const eras: { id: EraId; label: string; when: string }[] = [
  { id: "ancient", label: "Ancient", when: "The Hebrew Psalter and the morning blessings" },
  { id: "6th", label: "6th century", when: "Benedict of Nursia" },
  { id: "16th", label: "16th century", when: "Luther, Ignatius of Loyola, Teresa of Ávila" },
  { id: "18th", label: "18th century", when: "John Wesley" },
  { id: "today", label: "Today", when: "A few modern forms, beside the old ones" },
];

// ---- easy -----------------------------------------------------
export const easy = {
  tag: "Easy to begin",
  heading: "Three steps, and you're <em>praying.</em>",
  steps: [
    {
      title: "Type /ritual",
      body: "Or open the shelf. It knows what hour it is — in the morning, the forms to begin the day come first.",
    },
    {
      title: "Read the threshold",
      body: "Every form opens with why it exists, how it moves, and a few pointers for entering it well. Nothing to learn beforehand.",
    },
    {
      title: "Write into the movements",
      body: "Each question sits above a line for your words. The questions stay out of the way — only what you write is kept.",
    },
  ],
};

// ---- the whole shelf -----------------------------------------
export const shelf = {
  tag: "The whole library",
  heading: "Something for <em>every hour.</em>",
  lead: "Most of the shelf is old on purpose. A few forms are new — SOAP and Threshold sit beside the Examen — and the library keeps growing.",
};

export const shelves: { rhythm: Rhythm; label: string; note: string }[] = [
  { rhythm: "morning", label: "To begin", note: "Ordering the day before it orders you" },
  { rhythm: "midday", label: "To pause", note: "A breath in the middle" },
  { rhythm: "evening", label: "To close", note: "Looking back over the day" },
  { rhythm: "weekly", label: "Week's turn", note: "Once around, once a week" },
  { rhythm: "anytime", label: "When you need it", note: "Grief, decisions, thresholds" },
];

export const rituals: Ritual[] = [
  {
    name: "The Morning Offering",
    origin: "Ignatius of Loyola, 16th century — the Suscipe",
    tradition: "Ignatian",
    quote: "Empty your head onto the page. Then find the one thing that matters.",
    rhythm: "morning",
    era: "16th",
  },
  {
    name: "New Every Morning",
    origin: "The Hebrew morning blessings — Talmudic, with Lamentations 3",
    tradition: "Hebrew",
    quote: "You are awake, and the day is given. Start there.",
    rhythm: "morning",
    era: "ancient",
  },
  {
    name: "Luther’s Garland",
    origin: "Martin Luther, 1535 — a letter to his barber",
    tradition: "Lutheran",
    quote: "Instruction. Thanksgiving. Confession. Prayer. Wound around one short text.",
    rhythm: "morning",
    era: "16th",
  },
  {
    name: "Lectio Divina",
    origin: "Benedict of Nursia, 6th century",
    tradition: "Benedictine",
    quote: "Read. Meditate. Pray. Contemplate. Let the Word find you.",
    rhythm: "morning",
    era: "6th",
  },
  {
    name: "SOAP",
    origin: "Wayne Cordeiro, contemporary",
    tradition: "Evangelical",
    quote: "Scripture. Observation. Application. Prayer.",
    rhythm: "morning",
    era: "today",
  },
  {
    name: "Prayer of Recollection",
    origin: "Teresa of Ávila, 16th century",
    tradition: "Carmelite",
    quote: "Turn inward. The castle of the soul has many rooms. Begin at the gate.",
    rhythm: "morning",
    era: "16th",
  },
  {
    name: "The Examen of Consolation",
    origin: "Ignatius of Loyola, 16th century",
    tradition: "Ignatian",
    quote: "Where did love move in me today? Name it. Receive it. Return it.",
    rhythm: "midday",
    era: "16th",
  },
  {
    name: "The Daily Examen",
    origin: "Ignatius of Loyola, 16th century",
    tradition: "Ignatian",
    quote: "Where was I consoled today? Where did I resist grace?",
    rhythm: "evening",
    era: "16th",
  },
  {
    name: "Wesley’s Questions",
    origin: "John Wesley, 18th century",
    tradition: "Wesleyan",
    quote: "Am I consciously or unconsciously creating the impression I desire?",
    rhythm: "evening",
    era: "18th",
  },
  {
    name: "The Round",
    origin: "The Benedictine Rule of Life, 6th century — adapted",
    tradition: "Benedictine",
    quote: "Your life, one domain at a time. Once around, once a week.",
    rhythm: "weekly",
    era: "6th",
  },
  {
    name: "Psalmic Lament",
    origin: "Ancient — the Hebrew Psalter",
    tradition: "Hebrew",
    quote: "Address God. Complain honestly. Ask boldly. Trust anyway.",
    rhythm: "anytime",
    era: "ancient",
  },
  {
    name: "Ignatian Discernment",
    origin: "Ignatius of Loyola, 16th century",
    tradition: "Ignatian",
    quote: "Which choice brings deeper peace? Not comfort — peace.",
    rhythm: "anytime",
    era: "16th",
  },
  {
    name: "Threshold",
    origin: "Adapted from rite-of-passage practice, contemporary",
    tradition: "Contemporary",
    quote: "What am I leaving? What am I carrying forward? What am I letting go of?",
    rhythm: "anytime",
    era: "today",
  },
];

// Handed to the site footer (Base footerBig/footerSub) rather than rendered as
// its own section — a second download block right above the footer's was the
// duplicate CTA. Plain text: the footer headline doesn't take markup.
export const close = {
  heading: "Begin with the one that fits the hour.",
  sub: "Thirteen forms, one /ritual away.",
};
