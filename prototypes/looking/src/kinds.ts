import type { Hue, MarkingKind } from './corpus'

/**
 * The register each kind is rendered in.
 *
 * `desire` is the newest and the one most worth arguing about. Declared, it is
 * the strongest signal in the set — "where your treasure is, there your heart
 * will be also" is the writer's own reading of themselves. Inferred, it is the
 * most dangerous thing in the product: a machine deciding what someone wants is
 * a characterisation of their heart, which GUARDRAILS H2 forbids outright. So
 * it is exactly the kind where pencil-versus-ink decides whether this is legal.
 *
 * The point of this table is that a marking should be legible as *what it is*
 * before you read a word of it — a verse from a prayer from a story, by its
 * hand alone. If the labels have to do that work, the flair is decoration.
 *
 * Two constraints are encoded here rather than left to taste:
 *   · "learned" gets a flat notch and never an arrow. Principle 1 forbids
 *     vertical valence — a rising glyph beside someone's growth is a grade.
 *   · "sense" gets a bracket that opens and does not close. A sense is held,
 *     not concluded (1 Thess 5:21 is the writer's call, never the app's).
 */
export type Family = 'declared' | 'touch'

export type KindMeta = {
  kind: MarkingKind
  /** What the writer did. Never what we computed. */
  label: string
  family: Family
  /** Slash command, for the kinds that have one. */
  command?: string
  /** CSS custom-property suffix — --k-<tone> in styles.css. */
  tone: string
  /** One line for the notes page, in the writer's register. */
  gloss: string
}

/**
 * The six declared kinds.
 *
 * Gift and Absence were cut on 2026-08-26. Both came from the spiritual-direction
 * argument — the Examen opens with gratitude, and the dark night needed somewhere
 * to live — and both failed the only test that matters: a writer read the label
 * and did not know what it meant. A kind you have to gloss is a kind nobody will
 * ever type, and an unused kind is worse than a missing one because it makes the
 * palette look like homework.
 *
 * What that cost, named rather than absorbed: "when did I feel far from God?" no
 * longer has a DECLARED answer, and that was the strongest screen in this
 * prototype. The declared-versus-retrieved argument now runs on `desire`.
 */
export const KINDS: KindMeta[] = [
  {
    kind: 'scripture',
    label: 'Scripture',
    family: 'declared',
    command: '/scripture',
    tone: 'scripture',
    gloss: 'A verse that landed here.',
  },
  {
    kind: 'prayer',
    label: 'Prayer',
    family: 'declared',
    command: '/pray',
    tone: 'prayer',
    gloss: 'Something brought.',
  },
  {
    kind: 'sense',
    label: 'Sense',
    family: 'declared',
    command: '/sense',
    tone: 'sense',
    gloss: 'Something held, not concluded.',
  },
  {
    kind: 'story',
    label: 'Story',
    family: 'declared',
    command: '/story',
    tone: 'story',
    gloss: 'A thing that happened, worth keeping.',
  },
  {
    kind: 'desire',
    label: 'Desire',
    family: 'declared',
    command: '/desire',
    tone: 'desire',
    gloss: 'Something you want. Where the heart leans.',
  },
  {
    kind: 'learned',
    label: 'Learned',
    family: 'declared',
    command: '/learned',
    tone: 'learned',
    gloss: 'Something you would tell yourself again.',
  },
  { kind: 'mark', label: 'Set apart', family: 'touch', tone: 'mark', gloss: 'One gesture, no decision attached.' },
  { kind: 'highlight', label: 'Highlighted', family: 'touch', tone: 'hl', gloss: 'Colour, chosen while writing.' },
  { kind: 'underline', label: 'Underlined', family: 'touch', tone: 'ink', gloss: 'A line under your own words.' },
  { kind: 'quote', label: 'Quoted', family: 'touch', tone: 'ink', gloss: 'Set off from the rest.' },
]

export const KIND_META: Record<MarkingKind, KindMeta> = Object.fromEntries(
  KINDS.map((k) => [k.kind, k]),
) as Record<MarkingKind, KindMeta>

export const DECLARED = KINDS.filter((k) => k.family === 'declared')
export const TOUCH = KINDS.filter((k) => k.family === 'touch')

/** Order the margin reads in. Declared first, then touch — not by importance, by act. */
export const KIND_ORDER: MarkingKind[] = KINDS.map((k) => k.kind)

export function kindRank(k: MarkingKind): number {
  return KIND_ORDER.indexOf(k)
}

export const HUES: Hue[] = ['amber', 'rose', 'sage', 'sky', 'lilac']
