export type SceneId = 'intro' | 'shelf' | 'thread' | 'one' | 'inside' | 'prefer'

const SCENES: SceneId[] = ['intro', 'shelf', 'thread', 'one', 'inside', 'prefer']

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
    id: 'shelf',
    step: 2,
    title: 'Your practices',
    note: 'The door that does not exist today. Names only — no counts, on purpose.',
  },
  {
    id: 'thread',
    step: 3,
    title: 'One practice',
    note: 'Pick a movement along the top. Everything below it is your own writing, verbatim.',
  },
  {
    id: 'one',
    step: 4,
    title: 'One question, five months',
    note: 'The payoff screen. Nothing computed — this is a group-by over words you already wrote.',
  },
  {
    id: 'inside',
    step: 5,
    title: 'The riskier version',
    note: 'The same return, offered while you are writing. This one might be a bad idea.',
  },
  {
    id: 'prefer',
    step: 6,
    title: 'Your read',
    note: 'Last step.',
  },
]
