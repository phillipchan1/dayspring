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

export const KINDS: KindMeta[] = [
  /*
   * The Examen opens with gratitude, and nothing else in this set holds joy —
   * every other kind is either effortful or interior. That is a real gap in
   * what the app would otherwise be able to hand back.
   */
  {
    kind: 'gift',
    label: 'Gift',
    family: 'declared',
    command: '/gift',
    tone: 'gift',
    gloss: 'Something you were given.',
  },
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
  /*
   * Where He seemed far.
   *
   * The tradition takes the dark night entirely seriously and never treats it
   * as failure, and without this a dry season has nowhere to go in the product
   * but silence. Declared only — inferring that God felt absent to someone is a
   * verdict on their interior life and H2 forbids it outright.
   *
   * Guardrail: never counted, never trended, and never shown against Gift or
   * Encounter as a proportion. A ratio here would be a scoreboard on God.
   */
  {
    kind: 'absence',
    label: 'Absence',
    family: 'declared',
    command: '/absence',
    tone: 'absence',
    gloss: 'Where He seemed far.',
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
