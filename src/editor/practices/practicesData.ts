/**
 * The Practices Library — contemplative writing forms drawn from the Christian
 * tradition. Each practice opens (via the `/practice` slash command) into a
 * threshold screen and then a structured set of prompts the writer answers in
 * the editor. The prompt labels/questions render as display-only decorations;
 * only what the writer types is persisted (see usePracticeInsertion.ts).
 */

/** The contemplative "function" a practice serves — also the filter taxonomy. */
export type PracticeFunction =
  | 'examine'
  | 'encounter'
  | 'listen'
  | 'lament'
  | 'gratitude'
  | 'form'

export interface PracticePrompt {
  /** Short section name — rendered as an amber small-caps eyebrow. */
  label: string
  /** The guiding question — rendered in Newsreader italic above the writing line. */
  question: string
  /** Example phrasing shown on the empty answer line until the writer begins. */
  placeholder: string
}

export interface Practice {
  name: string
  function: PracticeFunction
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
}

export const PRACTICES: Practice[] = [
  {
    name: 'The Daily Examen',
    function: 'examine',
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
    function: 'examine',
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
]

/** Fast lookup by practice name (used by the editor decoration layer). */
export const PRACTICE_BY_NAME: ReadonlyMap<string, Practice> = new Map(
  PRACTICES.map((p) => [p.name, p]),
)

/** The filter taxonomy, in display order, with human-facing labels. */
export const PRACTICE_FUNCTIONS: { id: PracticeFunction | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'examine', label: 'Examine' },
  { id: 'encounter', label: 'Encounter' },
  { id: 'listen', label: 'Listen' },
  { id: 'lament', label: 'Lament' },
  { id: 'gratitude', label: 'Gratitude' },
  { id: 'form', label: 'Form' },
]
