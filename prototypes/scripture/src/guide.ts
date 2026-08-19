export const SCENE_IDS = ['intro', 'today', 'link', 'around', 'land', 'prefer'] as const

export type SceneId = (typeof SCENE_IDS)[number]

export interface GuideStep {
  id: SceneId
  step: number
  title: string
  /** One-line action for the viewer */
  action?: string
  note: string
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'intro',
    step: 1,
    title: 'Scripture while you journal',
    note: 'We’re exploring how to read the chapter around a verse without leaving the journal. Pasted verses counting like /scripture is coming either way — you’ll see a quick mock of that too. These screens are ideas — not the live app. Tap through and send your pick at the end.',
  },
  {
    id: 'today',
    step: 2,
    title: 'How it works today',
    action: 'Tap “/scripture Colossians” to see what happens today.',
    note: 'Right now /scripture works for a topic or a specific reference. Typing a whole book only returns popular hits — not a chapter to read through. And if you paste a verse from another Bible app, it stays plain text. It won’t show up in your scripture view.',
  },
  {
    id: 'link',
    step: 3,
    title: 'Idea A — link out to read the chapter',
    action: 'Tap the verse block to open the chapter on ESV.org.',
    note: 'Tap the verse block for a quick preview, then “Open full chapter on ESV.org” if you want the full site. You leave the journal briefly — but ESV.org matches the translation Dayspring quotes.',
  },
  {
    id: 'around',
    step: 4,
    title: 'Idea B — read this chapter beside the journal',
    action: 'Tap the verse block to open James 4 here. Try “Continue on ESV.org” to go further.',
    note: 'One tap opens that chapter beside the journal — your verse highlighted, writing still visible. If you want the next chapter or cross-references, a link at the bottom opens ESV.org. In-app for immediate context; the website when you want to explore deeper.',
  },
  {
    id: 'land',
    step: 5,
    title: 'Also coming — pasted verses land on their own',
    action: 'Tap “Paste a verse from a Bible app” and watch what happens.',
    note: 'This isn’t on the ballot at the end — we’re planning to do it either way. When you paste from another Bible app, the journal would recognize it and wrap it as scripture automatically — same look as /scripture, same tracking. No extra step from you. We’d only do this when we’re confident in the match.',
  },
  {
    id: 'prefer',
    step: 6,
    title: 'Your pick',
    action: 'Choose A, B, or something else — then send.',
    note: 'Last step on the next screen. The question is only about reading around a verse. Your pick goes straight to the Dayspring team.',
  },
]

export function guideFor(id: SceneId): GuideStep {
  return GUIDE_STEPS.find((s) => s.id === id) ?? GUIDE_STEPS[0]!
}

export function isSceneId(raw: string): raw is SceneId {
  return (SCENE_IDS as readonly string[]).includes(raw)
}
