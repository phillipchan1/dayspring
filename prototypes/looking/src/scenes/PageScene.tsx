import { entryById, formatDate } from '../corpus'
import { KIND_META, kindRank } from '../kinds'
import { Glyph } from '../Glyph'

/**
 * One page, opened.
 *
 * Rule 1, and nothing else on it: her words, her date, her markings. No title
 * we invented, no summary, no tag, no count. Opening a page is always a
 * deliberate second act — every other scene hands back a line, and the whole
 * entry is something you choose.
 */
export function PageScene({ id, onBack }: { id: string; onBack: () => void }) {
  const entry = entryById(id)
  if (!entry) {
    return (
      <div className="surface">
        <div className="empty">
          <h2>No such page.</h2>
        </div>
      </div>
    )
  }

  const byPara = new Map<number, typeof entry.markings>()
  for (const m of entry.markings ?? []) {
    const list = byPara.get(m.para) ?? []
    list.push(m)
    byPara.set(m.para, list)
  }

  return (
    <div className="surface">
      <button type="button" className="back" onClick={onBack}>
        ← back
      </button>
      <div className="inner">
        <div className="page">
          <time className="page__date" dateTime={entry.date}>
            {formatDate(entry.date)}
          </time>
          {entry.paragraphs.map((p, i) => {
            const marks = [...(byPara.get(i) ?? [])].sort((a, b) => kindRank(a.kind) - kindRank(b.kind))
            return (
              <div key={i}>
                <p className="page__p" data-set={marks.length > 0 ? 'true' : undefined}>
                  {p}
                </p>
                {marks.length > 0 ? (
                  <div
                    className="page__margin"
                    style={{ ['--strand-tone' as string]: `var(--k-${KIND_META[marks[0]!.kind].tone})` }}
                  >
                    {marks.map((m, j) => (
                      <span key={j} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Glyph kind={m.kind} hue={m.hue} size={14} />
                        {KIND_META[m.kind].label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
