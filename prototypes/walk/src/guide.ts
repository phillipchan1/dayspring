export type SceneId = 'intro' | 'walk' | 'record' | 'prefer'

const SCENES: SceneId[] = ['intro', 'walk', 'record', 'prefer']

export function isSceneId(v: string): v is SceneId {
  return SCENES.includes(v as SceneId)
}

export const GUIDE_STEPS: { id: SceneId; step: number; title: string; note: string }[] = [
  {
    id: 'intro',
    step: 1,
    title: 'The argument',
    note: 'One practice on the shelf is being fought by the surface it runs on. The other twelve are fine.',
  },
  {
    id: 'walk',
    step: 2,
    title: 'The walk',
    note: 'Live — bring a passage, touch a word, pray it, rest. Four movements over one passage, which is the practice.',
  },
  {
    id: 'record',
    step: 3,
    title: 'Afterwards',
    note: 'What lands in the entry, and the two decisions it makes for you.',
  },
  { id: 'prefer', step: 4, title: 'Your read', note: 'Last step.' },
]
