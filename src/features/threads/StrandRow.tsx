import { useState } from 'react'
import type { Strand, ThreadComp, ConnectionCandidate, EncounterKind } from './data/types'
import { StrandSvg } from './StrandSvg'

const ENCOUNTER_OPTS: { kind: EncounterKind; label: string }[] = [
  { kind: 'answered', label: 'answered' },
  { kind: 'redirected', label: 'redirected' },
  { kind: 'he_met_me', label: 'he met me' },
  { kind: 'surrendered', label: 'surrendered' },
  { kind: 'he_changed_me', label: 'he changed me' },
]

interface Props {
  strand: Strand
  candidates: ConnectionCandidate[]
  onOpenEntry?: ((entryId: string) => void) | undefined
}

export function StrandRow({ strand, candidates, onOpenEntry }: Props) {
  const [decompOpen, setDecompOpen] = useState(false)
  const [openCompId, setOpenCompId] = useState<string | null>(null)
  const [dismissedCandidates, setDismissedCandidates] = useState<Set<string>>(new Set())
  const [encounter, setEncounter] = useState<EncounterKind | null>(null)

  const strandCandidates = candidates.filter(
    (c) => (c.threadA === strand.id || c.threadB === strand.id) && !dismissedCandidates.has(`${c.threadA}-${c.threadB}`),
  )

  const meta =
    strand.kind === 'rope'
      ? `${strand.breadth} threads · ${strand.span.from.slice(0, 7)}–now`
      : `${strand.comps[0]?.lens.toLowerCase()} · ${strand.comps[0]?.span ?? ''}`

  function toggleDecomp(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('.thread-comp')) return
    setDecompOpen((o) => !o)
  }

  function toggleComp(compId: string) {
    setOpenCompId((id) => (id === compId ? null : compId))
  }

  function dismissCandidate(threadA: string, threadB: string) {
    setDismissedCandidates((s) => new Set(s).add(`${threadA}-${threadB}`))
  }

  return (
    <div className="strand-row" onClick={toggleDecomp} aria-expanded={decompOpen}>
      <div className="strand-row__head">
        <div className="strand-row__title-group">
          <span className="strand-row__title">{strand.label}</span>
          <span className={`strand-row__kind${strand.kind === 'rope' ? ' strand-row__kind--rope' : ''}`}>
            {strand.kind}
          </span>
        </div>
        <span className="strand-row__meta">{meta} · dive ▾</span>
      </div>

      <StrandSvg count={strand.breadth} />

      <div className="strand-decomp" data-open={decompOpen ? 'true' : undefined}>
        <div className="strand-decomp__twist">
          {strand.kind === 'rope'
            ? `⤜ woven from ${strand.breadth} threads — tap a thread for its moments`
            : 'a single thread — tap for its moments'}
        </div>

        {strand.comps.map((comp) => (
          <CompRow
            key={comp.id}
            comp={comp}
            open={openCompId === comp.id}
            onToggle={() => toggleComp(comp.id)}
            onOpenEntry={onOpenEntry}
          />
        ))}

        {strandCandidates.map((c) => (
          <div key={`${c.threadA}-${c.threadB}`} className="thread-candidate">
            <div className="thread-candidate__body">
              <span className="thread-candidate__question">→ {c.oneLineReason}</span>
              <button
                type="button"
                className="thread-candidate__dismiss"
                onClick={(e) => { e.stopPropagation(); dismissCandidate(c.threadA, c.threadB) }}
                aria-label="Dismiss connection suggestion"
              >
                ×
              </button>
            </div>
          </div>
        ))}

        {strand.declared && (
          <EncounterNameRow selected={encounter} onSelect={setEncounter} />
        )}
      </div>
    </div>
  )
}

function CompRow({
  comp,
  open,
  onToggle,
  onOpenEntry,
}: {
  comp: ThreadComp
  open: boolean
  onToggle: () => void
  onOpenEntry?: ((entryId: string) => void) | undefined
}) {
  return (
    <div
      className="thread-comp"
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      aria-expanded={open}
    >
      <div className="thread-comp__head">
        <span className="thread-comp__lens">{comp.lens}</span>
        <span className="thread-comp__span">{comp.span}</span>
      </div>
      <div className="thread-comp__matter">{comp.matter}</div>

      <div className="thread-moments" data-open={open ? 'true' : undefined}>
        {comp.moments.map((m, i) => {
          const isMock = m.entryId.startsWith('mock-')
          return (
            <div key={i} className="thread-moment">
              <div className="thread-moment__date">{m.date}</div>
              <div className="thread-moment__prose">{m.prose}</div>
              {isMock ? (
                <span className="thread-moment__link thread-moment__link--mock">
                  open entry ↗
                </span>
              ) : (
                <button
                  type="button"
                  className="thread-moment__link"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenEntry?.(m.entryId)
                  }}
                >
                  open entry ↗
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EncounterNameRow({
  selected,
  onSelect,
}: {
  selected: EncounterKind | null
  onSelect: (k: EncounterKind) => void
}) {
  return (
    <div className="encounter-row" onClick={(e) => e.stopPropagation()}>
      <div className="encounter-row__label">Name what happened</div>
      <div className="encounter-row__options">
        {ENCOUNTER_OPTS.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            className="encounter-row__opt"
            data-selected={selected === kind ? 'true' : undefined}
            onClick={() => onSelect(kind)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
