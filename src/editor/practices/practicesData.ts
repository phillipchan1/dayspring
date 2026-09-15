/**
 * The Practices Library — structured writing forms, most drawn from the Christian
 * contemplative tradition, alongside a few secular practices with an optional
 * closing prompt toward God. Each practice opens (via the `/practice` slash
 * command) into a threshold screen and then a structured set of prompts the
 * writer answers in the editor. The prompt labels/questions render as
 * display-only decorations; only what the writer types is persisted (see
 * usePracticeInsertion.ts).
 */

/**
 * The contemplative "function" a practice serves — also the filter taxonomy.
 *
 * `order` is the odd one out and deliberately so. The other six are all
 * RECEPTIVE: you notice, you receive, you look back. A morning practice is
 * usually GENERATIVE — you are putting something in order rather than reviewing
 * it — and the library had no word for that, which is part of why it read as a
 * shelf for the end of the day.
 */
export type PracticeFunction =
  | 'examine'
  | 'encounter'
  | 'listen'
  | 'lament'
  | 'gratitude'
  | 'form'
  | 'order'

/**
 * When a practice is best suited — the rhythmic filter taxonomy.
 *
 * `weekly` is not a time of day, which is the point: The Round is walked once
 * around, once a week, and belongs on no clock. Anything filtering by hour must
 * therefore treat it as out of scope rather than sorting it into an hour — see
 * `ritualSky.ts`.
 */
export type PracticeRhythm = 'morning' | 'midday' | 'evening' | 'weekly' | 'anytime'

export interface PracticePrompt {
  /** Short section name — rendered as an amber small-caps eyebrow. */
  label: string
  /** The guiding question — rendered in Newsreader italic above the writing line. */
  question: string
  /** Example phrasing shown on the empty answer line until the writer begins. */
  placeholder: string
}

/**
 * A practice whose movements are the WRITER'S OWN LIFE rather than a form from
 * the tradition.
 *
 * Everything else on the shelf ships its movements in this file. The Round's are
 * the domains on the writer's Life Map, so they are resolved once, at the moment
 * the ritual begins, and written into the entry as ordinary section tokens. The
 * document format does not change at all: the same
 * `<!-- ritual:section:Label -->` line, just with a label this table never saw.
 *
 * Which is exactly why `question` exists. Both render paths look a movement's
 * question up by `(practice name, section label)` — see `usePracticeInsertion.ts`
 * and `RitualComposer.tsx` — and a domain label matches no static prompt. They
 * fall through to this template instead.
 */
export interface PracticeDynamic {
  /** The only source today: the `domain` section of the Life Map. */
  source: 'lifemap-domains'
  /** The question asked of each resolved movement. */
  question: (label: string) => string
  placeholder: string
  /**
   * What the library says when the source is empty.
   *
   * Shown rather than hiding the card: a young journal has no domains yet, and
   * Principle 5 says tell the truth about a surface that needs history instead
   * of faking a generic four-part life.
   */
  needs: string
}

export interface Practice {
  name: string
  function: PracticeFunction
  /** When in the day this practice is best suited. Multiple values allowed. */
  rhythm: PracticeRhythm[]
  /** Who and when — e.g. "Ignatius of Loyola, 16th century". */
  origin: string
  /** Denomination / stream tag shown as a pill. */
  tradition: string
  /** 1–2 sentence orienting description shown at the threshold. */
  intention: string
  /** A short pull quote shown on the library card. */
  quote: string
  /** The heart of the practice — why it exists and how it forms you. */
  why: string
  /** How the practice moves — its rhythm and shape. */
  shape: string
  /** A few practical pointers for entering it well. */
  tips: string[]
  prompts: PracticePrompt[]
  /**
   * Off the shelf, but NOT gone. Read this before deleting a practice instead.
   *
   * An entry written months ago carries only hidden tokens — the ritual's name
   * and each movement's label. The QUESTION above every answer is looked up
   * live, at render time, through `PRACTICE_BY_NAME` (see
   * `usePracticeInsertion.ts` and `RitualComposer.tsx`). Delete a practice from
   * this array and every entry ever written with it silently loses its
   * questions: the writer's words survive, and the questions that produced them
   * do not.
   *
   * For a journal whose whole promise is showing someone what God has been
   * making of them, an old entry degrading in place is not an acceptable price
   * for tidying a menu. So retiring is a FLAG, never a deletion — the row stays
   * here forever so the archive keeps rendering, and only the library filters
   * it out so nobody meets it again.
   */
  retired?: boolean
  /** Movements come from the writer's own data. See `PracticeDynamic`. */
  dynamic?: PracticeDynamic
}

export const PRACTICES: Practice[] = [
  {
    name: 'The Morning Offering',
    function: 'order',
    rhythm: ['morning'],
    origin: 'Ignatius of Loyola, 16th century — the Suscipe',
    tradition: 'Ignatian',
    intention:
      'For the morning you sit down carrying everything at once. Put it all down first, then find what today is actually for.',
    quote: 'Empty your head onto the page. Then find the one thing that matters.',
    why:
      'Ignatius ended the Spiritual Exercises with the Suscipe — take, Lord, and receive my memory, my understanding, my whole will. This is that prayer with the working-out left in: you cannot offer a day you have not yet looked at. Getting the noise onto the page is not a productivity step; it is what makes an honest offering possible.',
    shape:
      'Four movements, front-loaded. A long first one — everything you are carrying, unordered — then three short turns that sort it: what matters, what is not yours, what you are handing over.',
    tips: [
      'Do the first movement badly on purpose. Fragments, lists, half-sentences.',
      'Read your own dump back before answering the second — the answer is usually already in it.',
      'If nothing feels offerable, offer the day as it is. That counts.',
    ],
    prompts: [
      {
        label: 'Everything',
        question:
          'Put down everything you are carrying into today. No order, no editing, nothing left out because it seems small.',
        placeholder: 'Just empty it out…',
      },
      {
        label: 'What matters',
        question:
          'Read back what you just wrote. What is the one thing today is actually for?',
        placeholder: 'Out of all of that, this…',
      },
      {
        label: 'Not yours',
        question: 'What in that list is not yours to carry? Name it, and set it down.',
        placeholder: 'I am not going to carry…',
      },
      {
        label: 'Offering',
        question: 'Take, Lord, and receive. What are you offering God for today?',
        placeholder: 'I offer you…',
      },
    ],
  },
  {
    name: 'New Every Morning',
    function: 'gratitude',
    rhythm: ['morning'],
    origin: 'The Hebrew morning blessings — Talmudic, with Lamentations 3',
    tradition: 'Hebrew',
    intention:
      'The oldest morning practice there is: thanks before anything else — before the news, before the list, before you have decided how the day is going.',
    quote: 'You are awake, and the day is given. Start there.',
    why:
      'The Birkot HaShachar bless what nobody notices — opening your eyes, standing up straight, the ground being there when your foot lands. They are said at the very start of the day, on purpose, because gratitude offered before the day is evaluated is a different act from gratitude offered after it has gone well. Lamentations says the mercies are new every morning; this is the practice of looking for the new ones.',
    shape:
      'Three short movements, and short is the point — this should take three minutes. Thanks for being here, thanks for something ordinary, and one named instance of faithfulness.',
    tips: [
      'Do it before you look at your phone, if you can.',
      'The ordinary things count most — that is the whole tradition here.',
      'One named thing beats a long list. Specific, not comprehensive.',
    ],
    prompts: [
      {
        label: 'Awake',
        question:
          'Before anything else — you are here, and today was given to you. What is the first thing you can thank God for?',
        placeholder: 'Thank you for…',
      },
      {
        label: 'The ordinary',
        question:
          'What ordinary mercy is already here this morning — something you would have walked straight past?',
        placeholder: 'The small thing already here…',
      },
      {
        label: 'Faithfulness',
        question: 'Where has God been faithful lately? Not in general — name one thing.',
        placeholder: 'You were faithful when…',
      },
    ],
  },
  {
    name: 'Luther’s Garland',
    function: 'order',
    rhythm: ['morning', 'anytime'],
    origin: 'Martin Luther, 1535 — a letter to his barber',
    tradition: 'Lutheran',
    intention:
      'A way to pray a single verse, a commandment, or one line of the Lord’s Prayer — four strands wound around it, in order.',
    quote: 'Instruction. Thanksgiving. Confession. Prayer. Wound around one short text.',
    why:
      'Luther wrote this for a barber who asked him how to pray, and it shows: it is practical, unmystical, and built for the mornings when prayer has gone cold. The order matters — you are taught before you thank, you thank before you confess, and you ask last, so that petition sits inside gratitude instead of standing in for it.',
    shape:
      'One short text — a verse, a commandment, a petition — and four strands wound around it. Luther’s own instruction: if one strand catches fire, stay there and let the others go.',
    tips: [
      'Keep the text very short. One line is plenty; Luther used one commandment.',
      'If a strand opens up, abandon the rest and stay in it. He said so himself.',
      'The order is the discipline: ask last, not first.',
    ],
    prompts: [
      {
        label: 'The text',
        question:
          'What one line are you praying today — a verse, a commandment, a petition of the Lord’s Prayer?',
        placeholder: 'Write the line here…',
      },
      {
        label: 'Instruction',
        question: 'What is this line teaching you? Take it as said to you, today.',
        placeholder: 'This is telling me…',
      },
      {
        label: 'Thanksgiving',
        question: 'What does this line give you reason to thank God for?',
        placeholder: 'Because of this, thank you for…',
      },
      {
        label: 'Confession',
        question: 'What does it show you about yourself? Say it plainly.',
        placeholder: 'It shows me…',
      },
      {
        label: 'Prayer',
        question: 'Now ask. What are you asking God for out of this?',
        placeholder: 'So I ask you…',
      },
    ],
  },
  {
    name: 'The Round',
    function: 'order',
    rhythm: ['weekly'],
    origin: 'The Benedictine Rule of Life, 6th century — adapted',
    tradition: 'Benedictine',
    intention:
      'A walk through the domains of your own life — the ones already on your Life Map — stopping at each one long enough to say what is true there this week.',
    quote: 'Your life, one domain at a time. Once around, once a week.',
    why:
      'A Rule of Life orders the whole of a life, not only its devotional corner: work, household, rest, friendship, the thing you are quietly worried about. Most weeks you only ever think about whichever domain is loudest. Going around the whole circle is how the quiet ones get heard before they become loud ones.',
    shape:
      'One movement per domain on your Life Map, in the order they first appeared in your journal. Nothing to think up — the circle is already yours. A domain you have nothing to say about this week is a real answer; leave it and move on.',
    tips: [
      'Same time each week. The point is the circuit, not the depth.',
      'Skip freely. Silence in a domain is information too.',
      'If a domain is missing or wrong, fix it in your Life Map — this walks whatever is there.',
    ],
    // Empty by design: the movements are the writer's, and this table has never
    // met them. `dynamic` below is what stands in.
    prompts: [],
    dynamic: {
      source: 'lifemap-domains',
      // The domain name is deliberately NOT repeated here. Every surface that
      // draws a movement puts the label directly above the question — the
      // threshold's list, the prompt widget in the entry, the composer's pane —
      // so naming the domain again read as "FRONTIER CHURCH / Frontier Church —
      // what is true here this week?" The label carries the name; the question
      // only has to carry the ask.
      question: () => 'What is true here this week?',
      placeholder: 'Or leave it, and move on…',
      needs: 'Needs a few domains on your Life Map.',
    },
  },
  {
    name: 'The Daily Examen',
    function: 'examine',
    rhythm: ['evening'],
    origin: 'Ignatius of Loyola, 16th century',
    tradition: 'Ignatian',
    intention:
      'A review of the day in God’s presence — not to audit yourself, but to notice where you were carried and where you resisted.',
    quote: 'Where was I consoled today? Where did I resist grace?',
    why:
      'The Examen trains a particular kind of attention: not self-improvement, but noticing where God was already at work in an ordinary day. Practiced regularly, it slowly retunes you to recognize grace in real time — and to meet your failures without despair.',
    shape:
      'Unhurried movements looking back over the day — gratitude, honest awareness of where you felt alive or distant, a gentle look at one turning-away, and a single request for tomorrow. Let the day replay rather than summarizing it.',
    tips: [
      'Pray it at the same time each day — most do it at night.',
      'Start with gratitude; it softens the harder noticing that follows.',
      'Examine, don’t accuse — you’re looking for grace, not building a case against yourself.',
    ],
    prompts: [
      {
        label: 'Gratitude',
        question: 'What am I grateful for from today — even one small thing?',
        placeholder: 'Begin here, however small…',
      },
      {
        label: 'Awareness',
        question: 'Where did I feel most alive? Where most distant from God?',
        placeholder: 'Consolation and desolation, honestly…',
      },
      {
        label: 'Examination',
        question:
          'Was there a moment I turned away — from love, from truth, from someone who needed me?',
        placeholder: 'Name it without self-punishment…',
      },
      {
        label: 'Prayer',
        question: 'What do I want to ask for tomorrow?',
        placeholder: 'One thing, simply asked…',
      },
    ],
  },
  {
    name: 'Lectio Divina',
    function: 'encounter',
    rhythm: ['morning'],
    origin: 'Benedict of Nursia, 6th century',
    tradition: 'Benedictine',
    intention:
      'Not reading Scripture to extract truth, but receiving it — letting a word or phrase find you, and sitting with what it stirs.',
    quote: 'Read. Meditate. Pray. Contemplate. Let the Word find you.',
    why:
      'Lectio assumes Scripture is less information to master than a living voice to be met. By reading slowly and letting a single word choose you, you move from studying the text to being addressed by it — the oldest Christian way of praying the Bible.',
    shape:
      'Four movements over a short passage: read (lectio), meditate on the word that caught you (meditatio), pray it back (oratio), and rest (contemplatio). You may spend the whole time on a single phrase.',
    tips: [
      'Choose a short passage — a few verses is plenty.',
      'Read it twice, slowly; the second time aloud if you can.',
      'When a word snags you, stop and stay there rather than reading on.',
    ],
    prompts: [
      {
        label: 'Lectio — Read',
        question:
          'What passage are you bringing? Read it slowly, twice. What word or phrase caught you?',
        placeholder: 'Write the passage, then the word that found you…',
      },
      {
        label: 'Meditatio — Meditate',
        question:
          'Repeat that word or phrase. Let it move around in you. What does it surface?',
        placeholder: 'Don’t analyze yet — just notice…',
      },
      {
        label: 'Oratio — Pray',
        question: 'What does this word prompt you to say to God?',
        placeholder: 'Speak it honestly, in your own words…',
      },
      {
        label: 'Contemplatio — Rest',
        question: 'What do you want to simply receive and hold from this time?',
        placeholder: 'A posture, a phrase, an image — whatever remains…',
      },
    ],
  },
  {
    name: 'Wesley’s Questions',
    function: 'form',
    rhythm: ['evening'],
    origin: 'John Wesley, 18th century',
    tradition: 'Wesleyan',
    intention:
      'The questions Wesley’s band meetings held each other to. Hard. Honest. Meant to be asked among people who want to grow in holiness.',
    quote: 'Am I consciously or unconsciously creating the impression I desire?',
    why:
      'Wesley’s bands asked these of one another to keep the inner life from drifting into self-deception. They assume growth in holiness needs honest light — ideally shared with someone you trust — and they are meant to be uncomfortable in a clarifying way.',
    shape:
      'A short, searching self-examination across honesty, purity, and confession. The questions do their work only if you resist managing your own image as you answer.',
    tips: [
      'Answer as if someone trusted will read it — these were meant to be shared.',
      'Notice the impulse to soften your answer; that impulse is part of the answer.',
      'End anything you confess with a turn toward grace, not just guilt.',
    ],
    prompts: [
      {
        label: 'Honesty',
        question:
          'Am I consciously or unconsciously creating the impression I desire to leave — or the true one?',
        placeholder: 'What impression did I cultivate today…',
      },
      {
        label: 'Purity',
        question: 'Did the pure in heart see God today? Did I?',
        placeholder: 'Where was my attention really…',
      },
      {
        label: 'Confession',
        question: 'Is there anything I need to confess — to God, or to someone else?',
        placeholder: 'Name it here first…',
      },
    ],
  },
  {
    name: 'SOAP',
    function: 'encounter',
    rhythm: ['morning'],
    origin: 'Wayne Cordeiro, contemporary',
    tradition: 'Evangelical',
    intention:
      'A structured encounter with Scripture that moves from observation to personal application — simple enough to sustain daily.',
    quote: 'Scripture. Observation. Application. Prayer.',
    why:
      'SOAP keeps daily Bible reading from staying abstract. Its discipline is the move from observation to one concrete application — turning what the text says into something you’ll actually live today, and then into prayer.',
    shape:
      'Four steps over a passage: write the Scripture, observe what it says, apply it specifically to today, and pray it back. Simple enough to keep daily for years.',
    tips: [
      'Keep the passage short so application stays focused.',
      'Make the application specific and doable today — not a general principle.',
      'Let the prayer flow directly out of your application.',
    ],
    prompts: [
      {
        label: 'Scripture',
        question: 'What passage are you reading today?',
        placeholder: 'Write the reference, or copy the text…',
      },
      {
        label: 'Observation',
        question: 'What do you observe — context, repetitions, what stands out?',
        placeholder: 'What does the text actually say…',
      },
      {
        label: 'Application',
        question: 'What does this mean for your life, concretely, today?',
        placeholder: 'One specific thing, not a general principle…',
      },
      {
        label: 'Prayer',
        question: 'Turn your application into a prayer.',
        placeholder: 'Speak it directly to God…',
      },
    ],
  },
  {
    name: 'Psalmic Lament',
    function: 'lament',
    rhythm: ['anytime'],
    origin: 'Ancient — the Hebrew Psalter',
    tradition: 'Hebrew',
    intention:
      'The psalms of lament are not a failure of faith. They are faith’s most honest posture. You are invited to complain to God, boldly.',
    quote: 'Address God. Complain honestly. Ask boldly. Trust anyway.',
    why:
      'A third of the Psalms are laments — proof that complaint, boldly addressed to God, is an act of faith rather than its failure. This form gives sorrow and anger a God-ward direction instead of bottling them or turning them inward.',
    shape:
      'The Hebrew pattern: address God, complain honestly, ask boldly, and end with a thread of trust — however thin. The closing turn is not forced cheerfulness; it’s what remains when everything else has been said.',
    tips: [
      'Don’t soften the complaint — the Psalms certainly don’t.',
      'Address God directly throughout; this is spoken to Him, not about Him.',
      'Let the closing trust be honest and small if that’s all you have.',
    ],
    prompts: [
      {
        label: 'Address',
        question:
          'Speak directly to God. Name who you believe Him to be, even when it’s hard to believe it.',
        placeholder: 'O God, you are…',
      },
      {
        label: 'Complaint',
        question: 'Say what is wrong. Don’t soften it.',
        placeholder: 'How long, O Lord…',
      },
      {
        label: 'Petition',
        question: 'What are you asking for? Ask boldly.',
        placeholder: 'I am asking you to…',
      },
      {
        label: 'Trust',
        question: 'End with something you still hold onto — however thin.',
        placeholder: 'Yet I will trust…',
      },
    ],
  },
  {
    name: 'Prayer of Recollection',
    function: 'listen',
    rhythm: ['morning', 'midday'],
    origin: 'Teresa of Ávila, 16th century',
    tradition: 'Carmelite',
    intention:
      'Teresa taught that God is already present within you — not waiting outside. This practice turns you inward to find Him there.',
    quote:
      'Turn inward. The castle of the soul has many rooms. Begin at the gate.',
    why:
      'Teresa of Ávila taught that God is already dwelling within you, not waiting at a distance. Recollection gathers your scattered attention and turns it inward to meet the One who is already there — a doorway into contemplative prayer.',
    shape:
      'Three movements inward: name the loudest inner noise, descend beneath it to what lies underneath, and notice where God is actually meeting you. The descent matters more than arriving.',
    tips: [
      'Begin with a real pause before writing anything.',
      'Don’t chase God outward — turn attention inward and downward.',
      'Meet Him where He actually is, not where you think He should be.',
    ],
    prompts: [
      {
        label: 'Stillness',
        question:
          'Before you write — pause. What noise is loudest inside you right now?',
        placeholder: 'Name the clamor first…',
      },
      {
        label: 'Descent',
        question: 'Move beneath the noise. What is underneath it?',
        placeholder: 'Beneath the anxiety is… beneath the ambition is…',
      },
      {
        label: 'Presence',
        question: 'Where do you sense God meeting you in this moment?',
        placeholder: 'Not where you think He should be — where He actually is…',
      },
    ],
  },
  {
    name: 'Emotionally Healthy Examen',
    // RETIRED 2026-09. The third examen on a shelf of eleven. Its distinctive
    // move — trace a feeling down to the belief underneath it — is real, but it
    // sat between the Daily Examen, which already opens on awareness, and
    // Wesley's Questions, which already does uncomfortable interior honesty.
    // Kept here so entries written with it still render their questions.
    retired: true,
    function: 'examine',
    rhythm: ['evening'],
    origin: 'Peter Scazzero, contemporary',
    tradition: 'Contemplative',
    intention:
      'An adaptation of the Examen that takes emotional honesty seriously — because you can’t be spiritually mature while emotionally immature.',
    quote:
      'What did I feel today? What did those feelings reveal about what I believe?',
    why:
      'Building on the Ignatian Examen, this form treats feelings as data about belief. Scazzero’s conviction is that emotional honesty is inseparable from spiritual maturity — you cannot grow past what you refuse to feel.',
    shape:
      'Three movements: name what you actually felt today, trace those feelings to what they reveal you believe, and ask where God was in it. The naming is the hardest and most important step.',
    tips: [
      'Get specific — “fine” is not a feeling.',
      'Follow a strong feeling down to the belief underneath it.',
      'Resist judging the emotion; you’re listening to it, not grading it.',
    ],
    prompts: [
      {
        label: 'Feel',
        question:
          'What did you feel today — really? Name as many emotions as you can.',
        placeholder: 'Not ‘fine’ — what actually moved in you…',
      },
      {
        label: 'Reveal',
        question:
          'What do those feelings reveal about what you actually believe right now?',
        placeholder: 'If I felt _____, I must believe that _____…',
      },
      {
        label: 'Encounter',
        question: 'Where was God in that?',
        placeholder: 'Present, absent, silent, speaking — where was He…',
      },
    ],
  },
  {
    name: 'The Examen of Consolation',
    function: 'gratitude',
    rhythm: ['midday', 'evening'],
    origin: 'Ignatius of Loyola, 16th century',
    tradition: 'Ignatian',
    intention:
      'A shorter, lighter form of the Examen focused entirely on noticing where love moved — in you and around you — today.',
    quote: 'Where did love move in me today? Name it. Receive it. Return it.',
    why:
      'A lighter, gratitude-only form of the Examen. It trains the eye to notice where love moved today — and to receive it as gift rather than achievement — which over time reshapes a hurried, scarcity-driven heart.',
    shape:
      'Three short movements: notice something good, true, or beautiful; receive it as gift; and return thanks. Brief by design — good for tired or heavy days.',
    tips: [
      'Let the small, overlooked things count.',
      'Pause on “receive” — notice what shifts when it’s gift, not earnings.',
      'Keep the return simple: thanks or wonder is enough.',
    ],
    prompts: [
      {
        label: 'Notice',
        question:
          'Where did something good, true, or beautiful catch your attention today?',
        placeholder: 'Even the small, overlooked things…',
      },
      {
        label: 'Receive',
        question:
          'Can you receive it as gift? What does it feel like to hold it that way?',
        placeholder: 'What changes when you see it as given rather than earned…',
      },
      {
        label: 'Return',
        question: 'What do you want to say back to God about it?',
        placeholder: 'A simple word of thanks, or wonder…',
      },
    ],
  },
  {
    name: 'Ignatian Discernment',
    function: 'listen',
    rhythm: ['anytime'],
    origin: 'Ignatius of Loyola, 16th century',
    tradition: 'Ignatian',
    intention:
      'For a decision you are holding. Ignatius taught that the Spirit’s movement can be felt — not just reasoned toward. You’re learning to read your own interior.',
    quote: 'Which choice brings deeper peace? Not comfort — peace.',
    why:
      'For a decision you are carrying. Ignatius taught that the Spirit’s leading can be felt in the movements of consolation and desolation — deep peace or contraction — not only reasoned toward. You are learning to read your own interior as a source of guidance.',
    shape:
      'Name the decision, imagine each path and notice what genuinely moves in you — life or contraction, peace or dread — then listen for the quietest, most persistent sense beneath the noise. Best returned to over several days.',
    tips: [
      'Seek deep peace, not mere comfort or the easier option.',
      'Imagine each path vividly before noticing your interior response.',
      'Trust the consistent quiet sense over the loudest momentary one.',
      'Carry it across days; discernment rarely resolves in one sitting.',
    ],
    prompts: [
      {
        label: 'Name the question',
        question: 'State the decision you are holding as clearly as you can.',
        placeholder: 'I am trying to discern whether to…',
      },
      {
        label: 'Consolation',
        question:
          'When you imagine choosing one path — what moves in you? Peace, dread, life, contraction?',
        placeholder: 'Not ‘what is easier’ — what brings deeper life…',
      },
      {
        label: 'Desolation',
        question: 'When you imagine the other path — same question. What moves?',
        placeholder: 'Honest inventory, not preference…',
      },
      {
        label: 'Hold',
        question: 'What is the quietest, most persistent sense beneath all the noise?',
        placeholder: 'Not the loudest voice — the most consistent one…',
      },
    ],
  },
  {
    name: 'Then vs. Now',
    // RETIRED 2026-09, for a reason specific to this product: THE APP ALREADY
    // DOES THIS, better, from real data. The Ascent, the Covenant sky and the
    // year-in-review compute then-versus-now from the actual archive —
    // grounded, with the evidence attached (Principle 4). A ritual asking the
    // writer to hand-produce a worse version of what the engine produces was
    // the one card on the shelf competing with the product.
    retired: true,
    function: 'examine',
    rhythm: ['anytime'],
    origin: 'Adapted from narrative-therapy practice, contemporary',
    tradition: 'Secular',
    intention:
      'A direct comparison of who you were to who you are — not vague sentiment, but concrete evidence that something has actually changed.',
    quote: 'What do I believe now that I didn’t a year ago? What’s the proof?',
    why:
      'Growth is usually invisible from inside it — you rarely feel yourself changing day to day. This practice forces a direct comparison across time, and asks for evidence, not just a feeling, so the change you name is one you can trust.',
    shape:
      'Three movements: name what was true then, name what’s true now, and find the concrete evidence for the gap between them. An optional fourth movement, if you want it, turns that noticing toward God.',
    tips: [
      'Pick a real point in time — a year ago, a specific season — not “in general.”',
      'Push past feelings to evidence: a moment, a choice, a reaction you didn’t have then.',
      'It’s fine if the honest answer is “not much has changed” — don’t force it.',
    ],
    prompts: [
      {
        label: 'Then',
        question:
          'What did you believe, feel, or struggle with a year ago that’s different now?',
        placeholder: 'A year ago, I…',
      },
      {
        label: 'Now',
        question: 'What’s true of you now that wasn’t then?',
        placeholder: 'Now, I…',
      },
      {
        label: 'Evidence',
        question:
          'What’s the proof — a moment, a choice, a reaction you didn’t have then?',
        placeholder: 'I noticed it when…',
      },
      {
        label: 'Presence',
        question: 'If you want to — where do you sense God in this change?',
        placeholder: 'Optional — no need to force it…',
      },
    ],
  },
  {
    name: 'Threshold',
    function: 'examine',
    rhythm: ['anytime'],
    origin: 'Adapted from rite-of-passage practice, contemporary',
    tradition: 'Secular',
    intention:
      'For a transition you’re in the middle of — a job, a move, a relationship, a season ending. Growth at a threshold often stays invisible until you name it.',
    quote: 'What am I leaving? What am I carrying forward? What am I letting go of?',
    why:
      'Transitions rarely get marked — you just find yourself on the other side of one. Naming what’s ending, what you’re bringing with you, and what you need to consciously set down turns a blurred passage into something you actually crossed.',
    shape:
      'Three movements at the threshold itself: what’s ending, what you’re carrying forward, and what you need to let go of. An optional fourth movement, if you want it, turns that threshold toward God.',
    tips: [
      'Use this while you’re still in the transition, not only after it’s resolved.',
      'Be specific about what you’re carrying — a skill, a person, a way of seeing.',
      'Letting go isn’t always sad — an old expectation or role can be a relief to set down.',
    ],
    prompts: [
      {
        label: 'Leaving',
        question: 'What season or chapter is ending? Name it plainly.',
        placeholder: 'I am leaving…',
      },
      {
        label: 'Carrying',
        question:
          'What are you taking with you into what’s next — a skill, a person, a way of seeing?',
        placeholder: 'I’m carrying…',
      },
      {
        label: 'Letting go',
        question:
          'What do you need to consciously set down — a role, an identity, an expectation?',
        placeholder: 'I’m letting go of…',
      },
      {
        label: 'Presence',
        question: 'If you want to — where do you sense God meeting you at this threshold?',
        placeholder: 'Optional…',
      },
    ],
  },
]

/**
 * The movements a practice will actually be written with.
 *
 * For everything on the shelf but The Round this is just `practice.prompts`.
 * For a dynamic practice it is one movement per source label, built here so that
 * the threshold's preview, the block written into the entry and the composer all
 * agree — resolved ONCE, at begin, and then carried in the document like any
 * other ritual.
 *
 * ORDER IS THE CALLER'S, AND MUST STAY CHRONOLOGICAL. The Life Map hands these
 * over sorted by when each domain first appeared, and `lifeMap.ts` explains at
 * length why: ranking the parts of someone's life by how often they come up is
 * "a verdict rendered in a sort" (Principle 1, D-016). Do not re-sort here, and
 * never by page count.
 *
 * NO CAP. A long Round is a long life, and truncating would silently drop
 * domains from the one ritual whose entire point is going all the way around.
 * What makes that affordable is that skipping is free: a movement left untouched
 * is dropped from the record when the writer leaves (see `RitualComposer`), so a
 * nine-domain Round walked past five of them is a four-movement entry, not a
 * permanent "you didn't finish".
 */
export function resolveMovements(
  practice: Practice,
  labels: readonly string[] = [],
): PracticePrompt[] {
  if (!practice.dynamic) return practice.prompts
  return labels.map((label) => ({
    label,
    question: practice.dynamic!.question(label),
    placeholder: practice.dynamic!.placeholder,
  }))
}

/**
 * Fast lookup by practice name — used by the editor decoration layer and the
 * composer to render a movement's question.
 *
 * ⚠️ THIS MAP INCLUDES RETIRED PRACTICES, and must. It is what every past entry
 * reads its questions out of; filtering it would strip the questions from
 * entries already written. Only browse surfaces filter — see `SHELF`.
 */
export const PRACTICE_BY_NAME: ReadonlyMap<string, Practice> = new Map(
  PRACTICES.map((p) => [p.name, p]),
)

/** What the library offers. `PRACTICES` minus anything retired. */
export const SHELF: readonly Practice[] = PRACTICES.filter((p) => !p.retired)

/** The rhythm filter, in day order, with human-facing labels. */
export const PRACTICE_RHYTHMS: { id: PracticeRhythm | 'all'; label: string }[] = [
  { id: 'all', label: 'Any hour' },
  { id: 'morning', label: 'To begin' },
  { id: 'midday', label: 'To pause' },
  { id: 'evening', label: 'To close' },
  { id: 'weekly', label: 'Week’s turn' },
  { id: 'anytime', label: 'Need-based' },
]

/**
 * The function taxonomy, with human-facing labels.
 *
 * No longer a row of chips — the library shows one axis (rhythm) and reaches
 * the rest through search. These labels still name the function on every card,
 * on the threshold and in the About sheet, and they are part of what search
 * matches against.
 */
export const PRACTICE_FUNCTIONS: { id: PracticeFunction | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'examine', label: 'Examine' },
  { id: 'encounter', label: 'Encounter' },
  { id: 'listen', label: 'Listen' },
  { id: 'lament', label: 'Lament' },
  { id: 'gratitude', label: 'Gratitude' },
  { id: 'form', label: 'Form' },
  { id: 'order', label: 'Order' },
]
