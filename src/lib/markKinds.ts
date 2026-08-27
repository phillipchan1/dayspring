import type { SpiritualItemType } from './types'

/**
 * The eight declared kinds — the whole vocabulary of what a writer can name.
 *
 * Grouped by the three questions a spiritual director actually works from, plus
 * the one nothing else in the set can hold. The grouping is not a UI
 * convenience: it is what keeps a picker of eight from reading as a taxonomy,
 * which is the line `SURFACES.md` draws between this and a tag manager.
 *
 * **The set is closed.** No user-defined kinds, ever. That single constraint is
 * what stops this becoming folders by another name.
 *
 * Two entries carry an argument worth keeping:
 *
 *   · **Learned** is rendered "Learned" and never "Growth", and its hand is a
 *     flat notch and never an arrow. Principle 1 forbids vertical valence — a
 *     rising glyph beside someone's spiritual life is a grade.
 *   · **Absence** is where He seemed far. The tradition takes the dark night
 *     entirely seriously and never treats it as failure; without this, a dry
 *     season has nowhere to go in the product but silence. Declared only —
 *     inferring that God felt absent to someone is a verdict on their interior
 *     life. Never counted, never trended, and never shown against Gift as a
 *     proportion: a ratio here would be a scoreboard on God.
 *
 * One table, because every other file wants a different column of it: the
 * parser wants `fence`, the palette wants `command`, the margin wants `label`
 * and `gloss`, the decorations want `tone`.
 */

/** The question a kind answers. Order here is the order a picker reads in. */
export type MarkGroup = 'received' | 'brought' | 'noticed' | 'named'

export const MARK_GROUPS: { key: MarkGroup; title: string }[] = [
  { key: 'received', title: 'Received' },
  { key: 'brought', title: 'Brought' },
  { key: 'noticed', title: 'Noticed' },
  { key: 'named', title: 'Named' },
]

export interface MarkKindMeta {
  kind: SpiritualItemType
  /**
   * Cut from the vocabulary, kept for the pages that already carry it.
   *
   * A writer read the labels and did not know what they meant, and a kind you
   * have to gloss is a kind nobody will type. Retiring rather than deleting,
   * because the rows exist: an entry marked `gift` in June must still render as
   * a gift. Nothing retired is OFFERED — not in the palette, not in `look for`.
   *
   * Name the casualty rather than absorbing it: "when did I feel far from God?"
   * no longer has a declared answer, and that was the strongest screen in the
   * last pass. It runs on `desire` now.
   */
  retired?: true
  /** What the writer did. Never what we computed. */
  label: string
  /** One line in the writer's register. */
  gloss: string
  /** The ```dayspring-*``` fence suffix this kind serializes to. */
  fence: string
  /** The /command that opens it. */
  command: string
  group: MarkGroup
  /** CSS custom property carrying the kind's hue. */
  tone: string
  /**
   * Which capture the /command opens. `prose` is the generic one-field popover
   * (InlineDeclaredPopover); the other three have their own because they carry
   * something a prose field can't — a prayer type, a shipped voice, or verbatim
   * ESV text fetched over the network.
   */
  capture: 'prose' | 'prayer' | 'sense' | 'scripture'
}

/** Every kind that has ever existed, retired ones included. Storage reads this. */
export const MARK_KINDS: MarkKindMeta[] = [
  // The Examen opens with gratitude, and nothing else in this set holds joy —
  // every other kind is either effortful or interior. That is a real gap in
  // what the app would otherwise be able to hand back.
  {
    kind: 'gift',
    retired: true,
    label: 'Gift',
    gloss: 'Something you were given.',
    fence: 'dayspring-gift',
    command: 'gift',
    group: 'received',
    tone: 'var(--k-gift)',
    capture: 'prose',
  },
  {
    kind: 'scripture',
    label: 'Scripture',
    gloss: 'A verse that landed here.',
    fence: 'dayspring-scripture',
    command: 'scripture',
    group: 'received',
    tone: 'rgb(var(--scripture-gold))',
    capture: 'scripture',
  },
  {
    // `/pray`, not `/prayer` — four years of muscle memory, and renaming a
    // command to match a table is the tail wagging the dog.
    kind: 'prayer',
    label: 'Prayer',
    gloss: 'Something brought.',
    fence: 'dayspring-pray',
    command: 'pray',
    group: 'brought',
    tone: 'var(--accent)',
    capture: 'prayer',
  },
  {
    // Declared, the strongest signal in the set — "where your treasure is,
    // there your heart will be also" is the writer's own reading of themselves.
    // Inferred, the most dangerous thing in the product: a machine deciding
    // what someone wants is a characterisation of their heart.
    kind: 'desire',
    label: 'Desire',
    gloss: 'Something you want.',
    fence: 'dayspring-desire',
    command: 'desire',
    group: 'brought',
    tone: 'var(--k-desire)',
    capture: 'prose',
  },
  {
    kind: 'sense',
    label: 'Sense',
    gloss: 'Something held, not concluded.',
    fence: 'dayspring-sense',
    command: 'sense',
    group: 'noticed',
    tone: 'var(--md-emphasis)',
    capture: 'sense',
  },
  {
    kind: 'learned',
    label: 'Learned',
    gloss: 'Something you would tell yourself again.',
    fence: 'dayspring-learned',
    command: 'learned',
    group: 'noticed',
    tone: 'var(--k-learned)',
    capture: 'prose',
  },
  {
    // The least distinct of the eight — most entries are things that happened —
    // and the first one to cut if a picker of eight proves heavy. It is in
    // because it is a real reader's own word for it ("there was a breakthrough
    // here"), which is a good reason but not an unassailable one.
    kind: 'story',
    label: 'Story',
    gloss: 'A thing that happened, worth keeping.',
    fence: 'dayspring-story',
    command: 'story',
    group: 'noticed',
    tone: 'var(--k-story)',
    capture: 'prose',
  },
  {
    kind: 'absence',
    retired: true,
    label: 'Absence',
    gloss: 'Where He seemed far.',
    fence: 'dayspring-absence',
    command: 'absence',
    group: 'named',
    tone: 'var(--k-absence)',
    capture: 'prose',
  },
]

/**
 * The vocabulary as it stands: six kinds, and the set is closed.
 *
 * Scripture · Prayer · Sense · Story · Desire · Learned. This is what anything
 * user-facing offers; `MARK_KINDS` is what storage and rendering read, because
 * a page marked with a retired kind still has to draw.
 */
export const LIVE_MARK_KINDS: MarkKindMeta[] = MARK_KINDS.filter((k) => !k.retired)

export const MARK_KIND: Record<SpiritualItemType, MarkKindMeta> = Object.fromEntries(
  MARK_KINDS.map((k) => [k.kind, k]),
) as Record<SpiritualItemType, MarkKindMeta>

/** Every kind that renders as a marked line rather than as a set-apart block. */
export const MARKED_LINE_KINDS = MARK_KINDS.filter((k) => k.kind !== 'scripture')

/**
 * The /commands that open a plain prose capture — every declared kind except
 * scripture, which has its own popover because it fetches verbatim ESV text.
 */
export const DECLARED_COMMANDS = MARKED_LINE_KINDS.map((k) => k.command) as
  ('pray' | 'sense' | 'gift' | 'desire' | 'learned' | 'story' | 'absence')[]

export type DeclaredCommandId = (typeof DECLARED_COMMANDS)[number]

const COMMAND_TO_KIND = new Map<string, SpiritualItemType>(
  MARK_KINDS.map((k) => [k.command, k.kind]),
)

/** The kind a /command captures, or null when the command isn't one. */
export function kindForCommand(command: string): SpiritualItemType | null {
  return COMMAND_TO_KIND.get(command) ?? null
}
