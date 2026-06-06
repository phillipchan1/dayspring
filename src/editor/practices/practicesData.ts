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
