import { useState } from 'react'
import { ENTRIES, formatDate } from '../corpus'
import { leavesFor, singleLeaf } from '../page'

type Long = 'continues' | 'scrolls'

/**
 * What a page does when it runs longer than the space it has.
 *
 * ── Its own screen, because it is its own argument ──────────────────────────
 *
 * Everything else here is about looking back. This is about page layout, and
 * mixing the two would mean answering a design question with a product demo.
 *
 * ── The bug ─────────────────────────────────────────────────────────────────
 *
 * In the app today a page at reading zoom is a fixed-height box that scrolls
 * inside itself — `.pg-leaf { block-size: 100%; overflow-y: auto }`. So a long
 * day gets its own scrollbar and you scroll INSIDE a page while the wall
 * scrolls behind it. Two nested scrollers with no boundary between them is what
 * reads as wrong: on paper a page has no scrollbar, because a page that runs
 * out simply continues onto the next one.
 *
 * ── The fix, and its cost ───────────────────────────────────────────────────
 *
 * The page continues. The date prints on the FIRST leaf only, and that absence
 * is the entire continuation cue — a leaf with no date is obviously the back
 * half of the one before it. A folio number would be chrome on a page, and
 * nothing goes on a page except her words, her date and her markings.
 *
 * What it costs: the wall's uniform row height is what lets a 3,500-page
 * archive window cleanly, and a page now occupies a variable NUMBER of
 * fixed-size leaves. Cheap at reading zoom specifically, where two columns are
 * on screen and virtualization is barely earning its keep.
 *
 * The toggle is here because half this screen's job is to be beaten by the
 * thing it replaced, and a comparison you have to remember is not a comparison.
 */
export function LeavesScene({ onOpen }: { onOpen?: (id: string) => void }) {
  const [long, setLong] = useState<Long>('continues')
  const leaves = long === 'continues' ? leavesFor(ENTRIES, { rows: 17, cols: 52 }) : singleLeaf(ENTRIES)

  return (
    <div className="surface">
      <div className="dawn" aria-hidden />
      <div className="inner">
        <div className="bar-wrap">
          <div className="bar-row">
            <div className="modes" role="group" aria-label="What a long page does">
              <button
                type="button"
                data-on={long === 'continues' ? 'true' : undefined}
                onClick={() => setLong('continues')}
              >
                continues
              </button>
              <button type="button" data-on={long === 'scrolls' ? 'true' : undefined} onClick={() => setLong('scrolls')}>
                scrolls
              </button>
            </div>
          </div>
          <p className="meta">
            {long === 'continues' ? (
              <>
                <b>{leaves.length} leaves</b> · {ENTRIES.length} pages · a long day takes two, and the second
                one carries no date
              </>
            ) : (
              <>
                <b>{ENTRIES.length} pages</b> · a long day scrolls inside its own box
              </>
            )}
          </p>
        </div>

        <div className="leaves">
          {leaves.map((leaf, i) => (
            <button
              type="button"
              className="leaf"
              key={`${leaf.entry.id}-${leaf.part}-${i}`}
              data-scrolls={long === 'scrolls' ? 'true' : undefined}
              onClick={() => onOpen?.(leaf.entry.id)}
            >
              {leaf.part === 0 ? (
                <time className="leaf__date" dateTime={leaf.entry.date}>
                  {formatDate(leaf.entry.date)}
                </time>
              ) : null}
              {leaf.paras.map((p) => (
                <p className="leaf__p" key={p}>
                  {leaf.entry.paragraphs[p]}
                </p>
              ))}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
