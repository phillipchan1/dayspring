/**
 * Lens taxonomy for Threads & Ropes derivation.
 *
 * Two axes — edit freely:
 *   Domains    = stewardship domains (external life areas)
 *   Interior   = interior threads (spiritual/emotional patterns)
 *
 * An entry may carry one domain AND/OR one interior lens.
 * Used by scripts/derive-threads.ts for Nano-based classification.
 */

export interface LensEntry {
  readonly key: string
  readonly label: string
  /** Natural-language description fed to the Nano classifier. */
  readonly desc: string
}

export const DOMAINS: readonly LensEntry[] = [
  {
    key: 'SCE',
    label: 'SCE',
    desc: 'SCE church, Epicentre ministry, church staff, church leadership, Sunday service, kids ministry, pastoral work, church elder board, church team',
  },
  {
    key: 'Trading',
    label: 'Trading',
    desc: 'options trading, stock market, trading account, playbook, drawdown, discipline, sizing, trade execution, P&L, expiry, backtesting',
  },
  {
    key: 'Frontier',
    label: 'Frontier',
    desc: 'Frontier, Dayspring, building an app, tech startup, product development, software launch, product leadership, AI',
  },
  {
    key: 'Family',
    label: 'Family',
    desc: 'Esther (wife), kids, children, parenting, marriage, family life, newborn, pregnancy, home',
  },
  {
    key: 'Health',
    label: 'Health',
    desc: 'physical health, sleep, rest, fitness, tiredness, exhaustion, wired and tired, body, exercise, walking, sickness',
  },
]

export const INTERIOR_LENSES: readonly LensEntry[] = [
  {
    key: 'Prayer/Presence',
    label: 'Prayer · Presence',
    desc: 'prayer, devotion, seeking God\'s presence, Holy Spirit, spiritual hunger, feeling dry, wanting God, asking God for something specific, nearness to God',
  },
  {
    key: 'Purity',
    label: 'Purity',
    desc: 'sexual purity, temptation, lust, pornography, repentance after failure, purity struggles, sexual sin, holiness, self-control around sexuality',
  },
  {
    key: 'Provision',
    label: 'Provision',
    desc: 'money, finances, debt, provision, trust for income, financial anxiety, abundance, scarcity, job security, paying bills, overdrafts',
  },
  {
    key: 'Relationships',
    label: 'Relationships',
    desc: 'friendships, discipleship, mentoring, community, small group, team dynamics, work relationships, conversations, conflict with people, interpersonal tension',
  },
  {
    key: 'Emotions',
    label: 'Emotions',
    desc: 'anxiety, discouragement, depression, joy, fear, stress, pressure, gratitude, feeling overwhelmed, anger, sadness, peace, encouragement, grief',
  },
  {
    key: 'Scripture',
    label: 'Scripture',
    desc: 'reading the Bible, studying scripture, specific verses, devotional reading, word of God, scriptural reflection, a passage speaking to the writer',
  },
]

export const ALL_LENSES: readonly LensEntry[] = [...DOMAINS, ...INTERIOR_LENSES]

export type DomainKey = (typeof DOMAINS)[number]['key']
export type InteriorKey = (typeof INTERIOR_LENSES)[number]['key']
export type LensKey = DomainKey | InteriorKey | null
