/**
 * Four kinds — and only Lectio Divina declares them.
 *
 * Every movement of every ritual renders the same way today: an eyebrow label,
 * an italic question, one textarea (`RitualComposer.tsx:395-425`). That is right
 * for almost everything on the shelf. An examen is four questions asked in
 * order; it does not want a mechanism.
 *
 * It is wrong for exactly one practice, and wrong in a way that can be pointed
 * at rather than argued about: Lectio asks the writer to TYPE THE PASSAGE OUT,
 * then needs that passage for three more movements it has already scrolled away.
 * Lectio is re-reading. The surface reads once.
 *
 * So: `kind` is an OPTIONAL field on `PracticePrompt`. Absent means today's
 * movement, unchanged, which is what the other twelve practices say and what
 * every ritual ever written in the archive says. Only Lectio's four prompts
 * declare anything. The vocabulary can grow later if another practice earns it;
 * nothing here assumes it will.
 */
export type KindId = 'write' | 'bring' | 'mark' | 'carry' | 'dwell'

export interface Kind {
  id: KindId
  name: string
  /** What the writer does. One line, in the writer's terms. */
  gesture: string
}

export const KINDS: Kind[] = [
  {
    id: 'write',
    name: 'Write',
    gesture: 'Answer the question. The default — and what the other twelve practices keep.',
  },
  {
    id: 'bring',
    name: 'Bring',
    gesture: 'Name the passage, or come back to one you have marked. Then it stays on screen.',
  },
  { id: 'mark', name: 'Mark', gesture: 'Touch the word that caught you.' },
  { id: 'carry', name: 'Carry', gesture: 'Nothing — what came before is still above you.' },
  { id: 'dwell', name: 'Dwell', gesture: 'Nothing at all, for as long as you like.' },
]

export const KIND_BY_ID = new Map(KINDS.map((k) => [k.id, k]))

/** Lectio's four movements, with the labels exactly as `practicesData.ts` has them. */
export const LECTIO: { label: string; question: string; kind: KindId }[] = [
  { label: 'Lectio — Read', question: 'What are you bringing this morning?', kind: 'bring' },
  { label: 'Meditatio — Meditate', question: 'Which word is staying with you?', kind: 'mark' },
  { label: 'Oratio — Pray', question: 'What does that word prompt you to say to God?', kind: 'carry' },
  { label: 'Contemplatio — Rest', question: '', kind: 'dwell' },
]
