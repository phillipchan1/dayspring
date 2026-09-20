// ============================================================
// Paid-social creative matrix — the single source of truth.
//
// Every ad image AND every line of ad text comes from this file, so
// the PNG a buyer uploads and the copy pasted beside it can never
// drift apart. `render.mjs` emits both from here.
//
// The primary test variable is `track` (see docs/product/PAID_SOCIAL.md).
// Vary ONE thing at a time; a concept that changes headline *and*
// visual *and* format teaches you nothing.
//
// Copy discipline is BRANDSCRIPT.md's, not a copywriter's instinct:
// the customer is the hero, never us; forgetting is the villain;
// banned words are banned here too (journey, unlock, AI-powered,
// insights-as-noun, optimize, track, streak, score, mindfulness).
// Claims must be things the product actually does on `stable`.
// ============================================================

/** Ad canvases, in Meta's own pixel specs. */
export const FORMATS = {
  '1x1': { w: 1080, h: 1080, label: 'Feed square / carousel card' },
  '4x5': { w: 1080, h: 1350, label: 'Feed portrait — most feed real estate' },
  '9x16': { w: 1080, h: 1920, label: 'Stories & Reels' },
};

/**
 * Stories/Reels put Meta's own chrome over the top and bottom of the
 * frame. Nothing that has to be read may enter these bands.
 */
export const SAFE_ZONE_9x16 = { top: 250, bottom: 340 };

/** The four message tracks under test. `A` vs `B` is the D-001 read. */
export const TRACKS = {
  A: {
    name: 'Craft',
    thesis: '"Obsidian for Christians" — the tool is the draw.',
    reads: 'D-001 side A',
  },
  B: {
    name: 'Remembrance',
    thesis: 'The journal reads your life back to you. The emotional job.',
    reads: 'D-001 side B',
  },
  C: {
    name: 'Practice',
    thesis: 'Contemplative forms in the page. The only interview-backed angle.',
    reads: 'Kristi Wollbrink interview',
  },
  D: {
    name: 'Refusal',
    thesis: 'What we will not build is the proof we understand the stakes.',
    reads: 'Differentiation — untested',
  },
};

/**
 * One entry per creative concept.
 *
 *   id       stable slug — it ends up in the filename and therefore in
 *            the buyer's reporting. Never rename one; retire it instead.
 *   kicker   mono eyebrow, uppercase. Optional.
 *   head     the dominant line. <em> marks the dawn-italic accent.
 *            <br> is an explicit line break — set them by hand, the
 *            headline is too big to trust to auto-wrap.
 *   sub      one supporting sentence. Optional — C2 is stronger without.
 *   visual   which proof fragment to draw (see template.mjs).
 *   themes   which grounds to render: 'ink' (dark) and/or 'dawn' (light).
 *   formats  which canvases to render.
 *   meta     the text fields Meta asks for, beside the image.
 *   source   where the claim comes from — checked before spend.
 *
 * Before adding a concept, read the policy note on `d1b-refusals-safe`:
 * second-person copy about the viewer's faith ("your walk with God", "as a
 * Christian you…") is the one thing in this category Meta reliably rejects.
 * Describe the product, not the person.
 */
export const VARIANTS = [
  // ---- Track A · Craft ------------------------------------------------
  {
    id: 'a1-editor',
    track: 'A',
    kicker: 'The editor',
    head: 'A real editor.<br><em>Built for the inner life.</em>',
    sub: 'Markdown-native, full-screen, no perceptible lag. Type / and scripture, prayer, or an ancient practice opens in the line you’re writing.',
    visual: 'editor',
    themes: ['ink', 'dawn'],
    formats: ['1x1', '4x5', '9x16'],
    meta: {
      primary:
        'Most journalling apps are a text box with a date on it.\n\nDayspring is a writing surface people who care about writing tools recognise on sight — markdown-native, full-screen focus mode, typewriter scrolling, continuous autosave, no lag.\n\nAnd when the spiritual life shows up mid-sentence, type / — scripture, a prayer, a contemplative form — and it opens right in the line. No sidebar. No leaving the page.',
      headline: 'A journal that writes like a real editor',
      description: '$7 a month · Mac and web',
      cta: 'Download',
    },
    source: 'PRINCIPLES.md §3, home.ts editor + slashCommands',
  },
  {
    id: 'a2-import',
    track: 'A',
    kicker: 'Bring your archive',
    head: 'Bring your Day One archive.<br><em>Keep writing the way you like.</em>',
    sub: 'Import from Day One, Diarly, or markdown — photos and original dates intact, parsed on your own device. Re-importing never duplicates.',
    visual: 'import',
    themes: ['ink'],
    formats: ['1x1', '4x5'],
    meta: {
      primary:
        'You don’t have to start over.\n\nImport your Day One or Diarly archive — original dates and photos intact, parsed privately on your own device — and Dayspring hands you a look back at last month, and last year, on your first day.\n\nExport everything as plain markdown any time. No hostages.',
      headline: 'Import your journal. Keep every date.',
      description: '$7 a month · Mac and web',
      cta: 'Download',
    },
    source: 'faq.ts:25, features.ts:213, BRANDSCRIPT.md §4 agreement plan',
  },

  // ---- Track B · Remembrance ------------------------------------------
  {
    id: 'b1-archive',
    track: 'B',
    kicker: 'The long view',
    head: 'You’ve written for years.<br><em>You’ve never read it back.</em>',
    sub: 'Dayspring reads your own journal back to you — across a week, a month, a year. In your own words, nothing invented.',
    visual: 'spines',
    themes: ['ink', 'dawn'],
    formats: ['1x1', '4x5', '9x16'],
    meta: {
      primary:
        'Years of writing, and you couldn’t tell anyone what’s in it.\n\nThat’s not a discipline problem. A pile of entries isn’t a story, and scrolling isn’t remembering — there was never a way in.\n\nDayspring reads your own journal back to you across weeks, months and years: the matters you carried, the prayers you forgot you prayed, the verses that kept finding you. All of it yours. None of it reachable before.',
      headline: 'The journal that reads itself back to you',
      description: '$7 a month · Mac and web',
      cta: 'Download',
    },
    source: 'BRANDSCRIPT.md §2 external problem, POSITIONING.md one-move summary',
  },
  {
    id: 'b2-remembers',
    track: 'B',
    kicker: 'Luke 1:78',
    head: 'A journal that remembers,<br><em>so you don’t have to.</em>',
    sub: 'The prayers you forgot you prayed. The answers you never connected. The verses that kept finding you.',
    visual: 'rollup',
    themes: ['ink', 'dawn'],
    formats: ['1x1', '4x5', '9x16'],
    meta: {
      primary:
        'Remembering what God has done is a spiritual discipline, not nostalgia.\n\nEvery altar and pile of stones in the Old Testament is a countermeasure against the same enemy: forgetting. Israel never stopped believing God existed — they stopped remembering what He did.\n\nDayspring is a journal built against that. Write the way you already do, and a year of your own words becomes something you can finally read.',
      headline: 'A journal that remembers for you',
      description: '$7 a month · Mac and web',
      cta: 'Download',
    },
    source: 'BRANDSCRIPT.md one-liner alternate + §2 philosophical problem',
  },

  // ---- Track C · Practice ---------------------------------------------
  {
    id: 'c1-shelf',
    track: 'C',
    kicker: 'The rituals shelf',
    head: 'Thirteen ways<br><em>into the page.</em>',
    sub: 'Contemplative forms from across the church, one keystroke away — for the days you sit down with no idea where to start.',
    visual: 'shelf',
    themes: ['ink', 'dawn'],
    formats: ['1x1', '4x5', '9x16'],
    meta: {
      primary:
        'Some days you sit down to write and have no idea where to start.\n\nDayspring keeps thirteen contemplative forms one keystroke away — the Daily Examen, Lectio Divina, Psalmic Lament, Wesley’s Questions, Luther’s Garland — drawn from Ignatian, Benedictine, Hebrew and Wesleyan practice.\n\nType /ritual and write into a structure that already knows where to begin.',
      headline: 'Thirteen ways into the page',
      description: '$7 a month · Mac and web',
      cta: 'Download',
    },
    source: 'practicesData.ts SHELF (15 defined, 2 retired)',
  },
  {
    id: 'c2-question',
    track: 'C',
    kicker: null,
    head: 'Where was I consoled today?<br><em>Where did I resist grace?</em>',
    sub: 'The Daily Examen — Ignatius of Loyola, 16th century. One of thirteen forms built into Dayspring.',
    visual: 'none',
    themes: ['ink', 'dawn'],
    formats: ['1x1', '4x5', '9x16'],
    meta: {
      primary:
        'Ignatius asked two questions at the end of every day. Four hundred years later they are still the best two questions anyone has written down.\n\nDayspring keeps the Daily Examen — and twelve other contemplative forms — one keystroke from the page you are already writing on.',
      headline: 'The Daily Examen, in your own journal',
      description: '$7 a month · Mac and web',
      cta: 'Learn more',
    },
    source: 'practicesData.ts:292 — the Examen quote, verbatim',
  },

  // ---- Track D · Refusal ----------------------------------------------
  {
    id: 'd1-refusals',
    track: 'D',
    kicker: 'What we will not build',
    head: 'No streaks. No scores.<br><em>No verdict on your walk with God.</em>',
    sub: 'Dayspring shows you light, never a grade. What we refuse to build is how you know we understand the stakes.',
    visual: 'refusals',
    themes: ['ink', 'dawn'],
    formats: ['1x1', '4x5', '9x16'],
    meta: {
      primary:
        'Devotion driven by a streak counter is devotion corrupted. The moment someone writes to protect a number, the app has made their prayer life worse.\n\nSo Dayspring has no streaks, no badges, no “you haven’t written in 5 days”, and no score for your spiritual life. It illuminates what happened. It never grades how you’re doing.\n\nThat’s a policy, not a mood — and it’s why the rest of it can be trusted.',
      headline: 'No streaks. No scores. No verdict.',
      description: '$7 a month · Mac and web',
      cta: 'Learn more',
    },
    source: 'PRINCIPLES.md §1 and §2, verbatim on the forbids',
  },
  {
    // Policy-safe twin of d1. Meta's "Personal attributes" rule forbids copy
    // that asserts or implies knowledge of a viewer's religion — second-person
    // constructions like "your walk with God" and "your spiritual life" are
    // the exact shape it catches, while describing what the PRODUCT does is
    // fine. Review is inconsistent, so run this one alongside d1: if d1 is
    // rejected the concept still has a version in the auction.
    id: 'd1b-refusals-safe',
    track: 'D',
    kicker: 'What we will not build',
    head: 'No streaks. No badges.<br><em>No score at the end of it.</em>',
    sub: 'Dayspring shows you what you wrote and when. It has no opinion about how you are doing, and it never will.',
    visual: 'refusals',
    // The artwork has to clear the same policy bar as the headline.
    visualOpts: { chips: ['Streaks', 'Badges', 'Scores', 'Guilt notifications', 'A grade of any kind'] },
    themes: ['ink', 'dawn'],
    formats: ['1x1', '4x5'],
    meta: {
      primary:
        'Devotion driven by a streak counter is devotion corrupted. The moment someone writes to protect a number, the app has made things worse.\n\nSo Dayspring has no streaks, no badges, no "you haven’t written in 5 days", and no score of any kind.\n\nIt illuminates what happened. It never grades anyone.',
      headline: 'No streaks. No badges. No score.',
      description: '$7 a month · Mac and web',
      cta: 'Learn more',
    },
    source: 'PRINCIPLES.md §1 and §2, rewritten for Meta personal-attributes policy',
  },
  {
    id: 'd2-grounded',
    track: 'D',
    kicker: 'Grounded, or silent',
    head: 'It cannot invent<br><em>a memory.</em>',
    sub: 'Every reflection traces to something you actually wrote. Facts are computed in code, quotes are verbatim, and the model only ever selects.',
    visual: 'cite',
    themes: ['ink', 'dawn'],
    formats: ['1x1', '4x5', '9x16'],
    meta: {
      primary:
        'A journal that makes something up about your past isn’t a bug. It’s a betrayal — you can’t tell it apart from your own memory.\n\nSo Dayspring is built so it structurally cannot. Counts, dates and ranges are computed in code. Quotes are word-for-word from your entries. The model’s only job is to choose which true thing to show you.\n\nIf it can’t point at the entry, it says nothing at all.',
      headline: 'It cannot make things up about your life',
      description: '$7 a month · Mac and web',
      cta: 'Learn more',
    },
    source: 'PRINCIPLES.md §4, BRANDSCRIPT.md §3 authority',
  },

  // ====================================================================
  // RECIPE FRAMES — R1-R5
  //
  // The nine concepts above vary the MESSAGE and hold the form constant:
  // a headline-led poster with a proof card under it. These five vary the
  // FORM and re-use messages already approved above, because the form is
  // the untested variable and the evidence is one-sided about it:
  //
  //   Meta x Kantar x CreativeX (2024) — a visible face with eye contact
  //   is the strongest lever measured; product integrated into the story
  //   beats product shown beside it (+46%).
  //   AppsFlyer (2025) — screen demos out-retain polished testimonials.
  //
  // READ THIS BEFORE COMPARING THEM TO A-D: a recipe frame changes form
  // AND message at once against any of the nine. That is a confound. The
  // clean reads are r3 vs r4 (same form, message is the only variable)
  // and r1 vs r3 (same message family, form is the only variable). Never
  // put r1 in an ad set against a1 and call the result a message test.
  //
  // `layout` picks the frame in template.mjs. `photo` names a file in
  // marketing/ads/photos/; until it exists the frame renders a direction
  // plate carrying `photoBrief`, which is deliberately unshippable.
  // `onImage` is the ONE line allowed on the art — never an offer.
  // ====================================================================

  {
    id: 'r1-practice-face',
    track: 'A',
    layout: 'hero-photo',
    recipe: 'R1',
    photo: 'r1-face',
    photoBrief: [
      'Half-length portrait, natural window light, early morning — warm, not golden-hour styled.',
      'Eye contact with the lens. Not smiling at the camera; settled, mid-thought.',
      '30s-40s, contemporary dress. Credible as someone who leads something and is tired.',
      'Kitchen table or desk. A real one. No church backdrop, no raised hands, no open Bible prop.',
      'Shot 4:5 with headroom at the top third — the UI window occupies the bottom 45%.',
      'Subject placed slightly left of centre so the wordmark has air.',
    ],
    onImage: { lead: 'Where the', accent: 'practice lives.' },
    bridge: 'Scripture, prayer and practice, in the line you’re writing.',
    themes: ['ink'],
    formats: ['4x5', '1x1'],
    meta: {
      primaryShort: 'Scripture, prayer and ancient practice, in the line you’re writing.',
      primary:
        'Most journalling apps are a text box with a date on it.\n\nDayspring is a real writing surface, and when the spiritual life turns up mid-sentence you type / and Scripture, Prayer, Sense or a contemplative form opens right in the line.\n\nA journal for people who take the inner life seriously.',
      headline: 'Made for the inner life',
      description: 'A journal, not a content library',
      cta: 'Learn more',
    },
    source: 'src/editor/slashCommands.ts — labels and hints verbatim',
  },

  {
    id: 'r2-notes-graveyard',
    track: 'B',
    layout: 'confession',
    recipe: 'R2',
    photo: 'r2-confession',
    photoBrief: [
      'Creator-style, held at arm\u2019s length. Slightly imperfect: soft focus edge, real room.',
      'One person, eye contact, unguarded — the face of someone admitting something small.',
      'Morning, indoors, lamp or window. Never a studio.',
      'Frame loose: the confession line sits over the lower third, so keep that band simple.',
      'No props. Specifically no stack of journals — the line says it, the picture should not.',
    ],
    onImage: { lead: 'Four journals.', accent: 'None of them finished.' },
    bridge: 'Start with the one that holds.',
    themes: ['ink'],
    formats: ['4x5', '1x1'],
    meta: {
      primaryShort: 'Four journals in a drawer, none of them finished.',
      primary:
        'Four journals in a drawer, none of them finished. The notes app has two hundred fragments and no dates that mean anything.\n\nDayspring holds the writing in one place and hands it back later, a week or a year on, in your own words.\n\nNothing invented. Nothing scored.',
      headline: 'The journals that stopped',
      description: 'One place that holds',
      cta: 'Learn more',
    },
    source: 'PERSONAS.md — habit failure is a hypothesis, not a finding',
  },

  {
    id: 'r3-slash-demo',
    track: 'A',
    layout: 'demo',
    recipe: 'R3',
    // The old line was "Type / in the sentence you are writing." — which asks a
    // cold reader to already know what / means, and spends the one line on
    // something the picture underneath is busy explaining. The headline makes
    // the category claim; the palette proves it; the bridge teaches the gesture
    // in the one place it finally has context. Phil's note, 2026-09-20.
    //
    // It briefly read "Finally, a journal for the Christian life." That line
    // moved to r6, where the thirteen forms with their centuries beside them
    // actually earn it; here the proof is the capture column, so the headline
    // names the capture column. One headline, one creative.
    onImage: { lead: 'Scripture, prayer and practice,', accent: 'in the line you’re writing.' },
    bridge: 'Type / and it opens where you are. Nothing leaves the page.',
    themes: ['ink', 'dawn'],
    formats: ['4x5', '1x1'],
    meta: {
      primaryShort: 'Scripture, prayer and thirteen contemplative forms, one keystroke from the line you’re writing.',
      primary:
        'Scripture, prayer and thirteen contemplative forms, one keystroke from the line you’re writing.\n\nMost journalling apps are a text box with a date on it. Dayspring is built for the way the Christian life actually gets written down: type / and Scripture, Prayer, Sense or a contemplative form opens right where you are. No sidebar, no second tab.\n\nEverything you mark that way stays findable years later, gathered by subject.',
      headline: 'Scripture and prayer, in the page',
      description: 'Scripture, Prayer, Sense, Ritual',
      cta: 'Learn more',
    },
    source: 'src/editor/slashCommands.ts — the live capture column',
  },

  {
    id: 'r4-harvest',
    track: 'B',
    // Was `layout: 'harvest'` over a wall of grey skeleton bars, which at feed
    // size read as a loading state, not a journal. See uiArchive.
    layout: 'demo',
    ui: 'archive',
    uiScale: 1.0,
    recipe: 'R4',
    // BRANDSCRIPT.md:159's own tested alternate, verbatim. It says "journaling"
    // — which the old line ("Ten years of writing, finally readable") never did.
    onImage: { lead: 'Ten years of journaling.', accent: 'One story you’ve never read.' },
    // Not "Dayspring reads it back…": the wordmark sits one line below, so the
    // name landed twice in a row.
    bridge: 'Read back to you, in your own words.',
    themes: ['ink', 'dawn'],
    formats: ['4x5', '1x1'],
    meta: {
      primaryShort: 'Ten years of journals nobody ever read back. Including you.',
      primary:
        'Ten years of journals nobody ever read back. Including you.\n\nDayspring gathers what you actually wrote and hands it back by season: the prayers, the passages, the thing you said twice without noticing. Every word quoted straight from your own entries, with the dates computed in code.\n\nBring a decade of journals in and read it as one thing.',
      headline: 'Your journals, finally read back',
      description: 'Your words, not ours',
      cta: 'Learn more',
    },
    source: 'PRINCIPLES.md §4 grounded-or-silent; scripts/import — Diarly, Day One',
  },

  {
    id: 'r6-shelf-open',
    track: 'C',
    layout: 'demo',
    ui: 'shelf',
    uiScale: 1.0,
    recipe: 'R6',
    // Phil, 2026-09-20: this is the frame that earns "a journal for the
    // Christian life", because the thing under it is the church's own
    // practices with their traditions and centuries printed beside them.
    // r3 carried this line for a few hours and gave it up — two creatives
    // with one headline teach nothing about either.
    onImage: { lead: 'Finally,', accent: 'a journal for the Christian life.' },
    bridge: 'Centuries of contemplative practice, right in the page you’re writing.',
    themes: ['ink', 'dawn'],
    formats: ['4x5', '1x1'],
    meta: {
      primaryShort: 'Thirteen contemplative forms, one keystroke from the page you’re writing.',
      primary:
        'Thirteen contemplative forms, one keystroke from the page you’re writing.\n\nThe Daily Examen from the Ignatians. Lectio Divina from the Benedictines. Psalmic Lament out of the Psalter. The Prayer of Recollection from Teresa of Ávila.\n\nType /ritual on a morning you sit down with no idea where to start, and write into a structure that already knows where to begin.',
      headline: 'A journal for the Christian life',
      description: 'Ignatian, Benedictine, Carmelite',
      cta: 'Learn more',
    },
    source: 'practicesData.ts SHELF — 15 defined, 2 retired; identical on stable. The\n      on-image line names a span (Benedict 6th c. → Wesley 18th c.), not a census: two\n      of the thirteen (SOAP, Threshold) sit outside it.',
  },

  {
    id: 'r7-lectio-open',
    track: 'C',
    layout: 'demo',
    ui: 'ritual',
    uiScale: 0.94,
    recipe: 'R7',
    onImage: { lead: 'Lectio Divina,', accent: 'in the page you’re writing.' },
    bridge: 'And twelve more contemplative forms.',
    themes: ['ink', 'dawn'],
    formats: ['4x5', '1x1'],
    meta: {
      primaryShort: 'Lectio Divina opens in the page and waits while you answer it.',
      primary:
        'Lectio Divina opens in the page and waits while you answer it, one movement at a time, in your own words.\n\nThe Daily Examen, Psalmic Lament, Wesley’s Questions and ten more sit beside it. Type /ritual on a morning you sit down with no idea where to start.\n\nWhat you write stays in the entry, and stays findable years later.',
      headline: 'The practice opens in the page',
      description: 'Thirteen contemplative forms',
      cta: 'Learn more',
    },
    source: 'practicesData.ts — Lectio Divina labels and questions verbatim',
  },

  {
    id: 'r7b-lectio-not-watch',
    track: 'C',
    layout: 'demo',
    ui: 'ritual',
    uiScale: 0.94,
    recipe: 'R7',
    // r7 names the form; r7b names the difference. Same art, same UI, same
    // footer — the on-image line is the only variable, so this is the one
    // clean line test in the set.
    onImage: { lead: 'A form to write into.', accent: 'Not one to watch.' },
    bridge: 'Thirteen of them, one keystroke away.',
    themes: ['ink', 'dawn'],
    formats: ['4x5', '1x1'],
    meta: {
      primaryShort: 'A contemplative form you write into, on a morning you don’t know where to start.',
      primary:
        'Lectio Divina opens in the page and waits while you answer it, one movement at a time, in your own words.\n\nThirteen forms sit on the shelf: the Daily Examen, Psalmic Lament, the Prayer of Recollection, Wesley’s Questions.\n\nWhat you write stays in the entry, and stays findable years later.',
      headline: 'Write the practice',
      description: 'Thirteen contemplative forms',
      cta: 'Learn more',
    },
    source: 'practicesData.ts — Lectio Divina labels and questions verbatim',
  },

  {
    // ---- the flagship ------------------------------------------------
    // NOT RENDERED HERE. This entry exists so the sixth creative in the test
    // arrives with its words attached, in the same sheet as the other five.
    //
    // The picture is generated by `npm run flagship` from
    // src/features/flagship/, where every pixel of the app is the REAL app
    // rendered through a dev-only preview route. Re-rendering it here in the
    // site's visual language would be a recreation of a photograph, which is
    // the one thing this set must not do.
    //
    // It is deliberately the odd one out in two ways: no platform marks and
    // no descriptor line, because the same file is also the site hero and the
    // og:image, where an Apple mark would be wrong. Giving paid its own cut
    // is a ~20-line addition to CUTS in flagship.ts plus a re-run, if the
    // mismatch bothers anyone once they are side by side in the feed.
    id: 'f1-flagship',
    track: 'A',
    recipe: 'FLAGSHIP',
    external: ['assets/flagship/paid-dawn/4x5.png', 'assets/flagship/paid-ink/4x5.png',
               'assets/flagship/paid-dawn/1x1.png', 'assets/flagship/paid-ink/1x1.png'],
    onImage: { lead: 'A journal built for', accent: 'spiritual growth.' },
    themes: [],
    formats: [],
    meta: {
      primaryShort: 'Everything the Christian life asks of a page, in one place.',
      primary:
        'Everything the Christian life asks of a page, in one place.\n\nWrite the way you would anywhere else. Then type / and set a verse in the page, log a prayer, or open a contemplative form without leaving the line you were on.\n\nA year later Dayspring reads it back to you in your own words. On Mac and iPhone.',
      headline: 'A journal built for spiritual growth',
      description: 'Mac and iPhone',
      cta: 'Learn more',
    },
    source: 'src/features/flagship/flagship.ts — the marketing site H1, verbatim',
  },

  {
    id: 'r5-table',
    track: 'C',
    layout: 'table',
    recipe: 'R5',
    photo: 'r5-table',
    photoBrief: [
      'Overhead, hands only — no face. Worn Bible, a mug, phone flat on wood, resting.',
      'Real morning light with real shadows. Not a flat-lay styled for Instagram.',
      'Phone screen readable: the Dayspring editor, one line written.',
      'Wood, linen, ceramic. Nothing gilded, nothing new. Lo-fi finish is the point.',
      'Leave the lower third quiet for the line and the footer.',
    ],
    onImage: { lead: 'Where the', accent: 'practice lives.' },
    bridge: 'Thirteen contemplative forms, one keystroke away.',
    themes: ['ink'],
    formats: ['4x5'],
    meta: {
      primaryShort: 'Thirteen contemplative forms, one keystroke from the page you’re writing.',
      primary:
        'A quiet place to write, with the practice built into the page.\n\nType /ritual and the Daily Examen, Lectio Divina or Psalmic Lament opens in the line. Thirteen forms, from Benedict to Wesley.\n\nNo streaks. No scores. Nothing that grades a practice.',
      headline: 'Where the practice lives',
      description: 'Thirteen contemplative forms',
      cta: 'Learn more',
    },
    source: 'src/editor/practices — examen, lectio, lament ship on stable',
  },
];

/**
 * The carousel. One narrative, five cards, read left to right — this
 * is the format for the argument that does not fit in a single frame.
 * Cards render at 1x1 only; Meta crops anything else.
 */
export const CAROUSEL = {
  id: 'car1-eleven-years',
  track: 'B',
  meta: {
    primary:
      'You’ve written for years. You’ve never read it back.\n\nDayspring is the first journal that gives your archive back to you — grounded entirely in your own words, and honest enough to say nothing when it has nothing true to say.',
    cta: 'Download',
  },
  cards: [
    {
      id: '1-pile',
      kicker: 'One',
      head: 'Eleven years of entries.<br><em>You’ve read none of them twice.</em>',
      visual: 'spines',
    },
    {
      id: '2-villain',
      kicker: 'Two',
      head: 'The problem was never discipline.<br><em>It was that there was no way in.</em>',
      visual: 'none',
    },
    {
      id: '3-write',
      kicker: 'Three',
      head: 'So keep writing<br><em>exactly as you do.</em>',
      sub: 'Import Day One or Diarly with your dates intact, or start today.',
      visual: 'import',
    },
    {
      id: '4-read',
      kicker: 'Four',
      head: 'And a year of your words<br><em>becomes something you can read.</em>',
      sub: 'Week, month, quarter, year — in your own language.',
      visual: 'rollup',
    },
    {
      id: '5-cta',
      kicker: 'Five',
      head: 'See what God has been<br><em>making of you.</em>',
      sub: '$7 a month. No streaks, no scores, ever.',
      visual: 'none',
    },
  ],
};
