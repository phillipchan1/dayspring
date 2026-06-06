// All first-run onboarding copy in one place. Every string here is an editable
// placeholder — tone is warm, sacred, plain-spoken. Never sermonize, never
// gamify. Edit freely; no logic depends on the wording.

export const onboardingCopy = {
  skip: 'Skip for now',

  welcome: {
    title: 'Welcome to Dayspring.',
    body: 'A journal built to show you, over time, what God has been making of you. Let’s get your history in — or start something new today.',
    primary: 'Continue',
    tour: 'See what Dayspring becomes',
  },

  fork: {
    title: 'Where are you starting from?',
    veteran: {
      label: 'I’ve been journaling for years',
      sub: 'Bring in your Day One or Diarly history and see it reflected back immediately.',
    },
    fresh: {
      label: 'I’m starting fresh',
      sub: 'Begin today. Your reflections will deepen as you write.',
    },
  },

  importUpload: {
    title: 'Bring in your journal.',
    body: 'Upload your Day One (.zip JSON export) or Diarly (.zip) export. Your entries are parsed on your device and written straight to your private journal — they never pass through anyone else.',
    dropzone: 'Drop your export here, or click to choose',
    reading: 'Reading your export…',
    chooseDifferent: 'Choose a different file',
    sourceHint: 'Day One and Diarly exports (.zip)',
  },

  importPreview: {
    importableLabel: 'entries ready to bring in',
    dateRangeLabel: 'Spanning',
    skippedLabel: 'undated, skipped',
    sampleLabel: 'A sample of what’s coming in',
    reassurance:
      'Original dates are preserved exactly. Nothing is overwritten, and re-importing never creates duplicates.',
    chooseDifferent: 'Choose a different file',
    // primary button text is composed: `Import {n} entries`
    primaryPrefix: 'Import',
  },

  importBuilding: {
    title: 'We’re reading back through your years…',
    body: 'This happens once. We’ll start with your most recent month.',
    stillWorking: 'Still gathering — almost there…',
  },

  reveal: {
    title: 'Here’s where you were, last month.',
    // Shown when the backfill hasn't produced the month in time.
    pendingTitle: 'Your first reflection is on its way.',
    pendingBody:
      'Your reflections are still being written. We’ll let you know the moment your first one is ready.',
    backgroundIndicator: 'Building your full history…',
    primary: 'Enter your journal',
  },

  fresh: {
    title: 'Let’s begin.',
    body: 'Dayspring deepens as you write. Your first weekly reflection arrives at the end of your first week; the year-in-review is the one worth waiting for.',
    exampleLabel: 'example — a future weekly reflection',
    example:
      'You wrote on five of seven days this week. The word that kept returning was “wait” — in your prayers, in your frustrations, in the verse you came back to twice. Last week you were asking God to move; this week you were learning to sit with Him while He didn’t. That’s not nothing. That’s the work.',
    primary: 'Begin writing',
    // Opening prompts shown as gentle editor placeholders (not committed text).
    // Pick one for the seeded first entry.
    prompts: [
      'What’s stirring in you today?',
      'Where did you notice God this week?',
      'What are you carrying right now?',
      'What do you want to say to Him today?',
    ],
  },
} as const

/** A gentle opening prompt to seed the first fresh-start entry. */
export function pickOpeningPrompt(): string {
  const prompts = onboardingCopy.fresh.prompts
  return prompts[Math.floor(Math.random() * prompts.length)] ?? prompts[0]
}
