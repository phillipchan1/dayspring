export type SceneId = 'intro' | 'landing' | 'shelf' | 'thread' | 'one' | 'inside' | 'prefer'

const SCENES: SceneId[] = ['intro', 'landing', 'shelf', 'thread', 'one', 'inside', 'prefer']

export function isSceneId(v: string): v is SceneId {
  return SCENES.includes(v as SceneId)
}

export const GUIDE_STEPS: { id: SceneId; step: number; title: string; note: string }[] = [
  {
    id: 'intro',
    step: 1,
    title: 'The argument',
    note: 'These screens are an idea, not the live app. Nothing here is built.',
  },
  {
    id: 'landing',
    step: 2,
    title: 'The landing',
    note: 'What you meet on arrival. Opens with writing, not navigation — and with a question, not a practice.',
  },
  {
    id: 'shelf',
    step: 3,
    title: 'Your practices',
    note: 'The filing cabinet, kept for when you know what you are looking for. No counts, on purpose.',
  },
  {
    id: 'thread',
    step: 4,
    title: 'One practice',
    note: 'Pick a movement along the top. Everything below it is your own writing, verbatim.',
  },
  {
    id: 'one',
    step: 5,
    title: 'One question, five months',
    note: 'The payoff screen. Nothing computed — this is a group-by over words you already wrote.',
  },
  {
    id: 'inside',
    step: 6,
    title: 'The riskier version',
    note: 'The same return, offered while you are writing. This one might be a bad idea.',
  },
  {
    id: 'prefer',
    step: 7,
    title: 'Your read',
    note: 'Last step.',
  },
]
