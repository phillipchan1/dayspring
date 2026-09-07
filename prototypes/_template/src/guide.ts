export type SceneId = 'intro' | 'prefer'

const SCENES: SceneId[] = ['intro', 'prefer']

export function isSceneId(v: string): v is SceneId {
  return SCENES.includes(v as SceneId)
}

export const GUIDE_STEPS: {
  id: SceneId
  step: number
  title: string
  note: string
}[] = [
  {
    id: 'intro',
    step: 1,
    title: '__TITLE__',
    note: 'Replace this copy. These screens are ideas — not the live app.',
  },
  {
    id: 'prefer',
    step: 2,
    title: 'Your pick',
    note: 'Last step. Your pick goes to the Dayspring team.',
  },
]
