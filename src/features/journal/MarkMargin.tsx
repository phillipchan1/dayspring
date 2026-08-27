import { markGlyphClass, markGlyphHtml } from '@/editor/markGlyph'
import { MARK_KIND } from '@/lib/markKinds'
import type { MarginNote } from '@/editor/marginNotes'
import type { Proposal } from '@/lib/noticing'
import './MarkMargin.css'

/**
 * The margin, open.
 *
 * Three rules it exists to keep:
 *
 *  · **The writing does not move.** The panel is absolutely positioned, so on a
 *    window wide enough it fills empty space beside the centred writing column
 *    and below that width it overlays — but it never reflows the text. Text
 *    moving while the cursor is live is a Principle 3 violation and there is no
 *    version of this where it is acceptable.
 *  · **No kind label.** The hand is the label; hovering gives the name for
 *    anyone who wants it.
 *  · **No AI text, no count, no badge, no total.** The margin contains the
 *    writer's own sentences and nothing else.
 *
 * Nothing here takes focus. Every control cancels its own mousedown, so the
 * caret stays exactly where the writer left it and you can go on typing
 * straight through a click in the margin — clicks still land on mouseup.
 */
export function MarkMargin({
  open,
  notes,
  pencil = [],
  onClose,
  onReveal,
  onKeep,
  onNotThis,
}: {
  open: boolean
  notes: MarginNote[]
  /** What the journal noticed, not yet kept. Never counted, never in `notes`. */
  pencil?: Proposal[]
  onClose: () => void
  /** Bring a marking's line into view. Must not move the caret or take focus. */
  onReveal: (note: MarginNote) => void
  onKeep?: (proposal: Proposal) => void
  onNotThis?: (proposal: Proposal) => void
}) {
  if (!open) return null

  return (
    <aside className="mark-margin" aria-label="Markings">
      <div className="mark-margin__head">
        <span className="mark-margin__title">Markings</span>
        <button
          type="button"
          className="mark-margin__close"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClose}
          aria-label="Close the margin"
        >
          ×
        </button>
      </div>
      {notes.length === 0 && pencil.length === 0 ? (
        <p className="mark-margin__empty">Nothing set apart on this page.</p>
      ) : (
        <ol className="mark-margin__list">
          {notes.map((note) => (
            <li key={`${note.id}:${note.from}`}>
              <button
                type="button"
                className="mark-margin__note"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onReveal(note)}
                title={`${MARK_KIND[note.kind].label} — ${MARK_KIND[note.kind].gloss}`}
              >
                <span
                  className={`mark-margin__glyph ${markGlyphClass(note.kind)}`}
                  aria-hidden="true"
                  // Module constants from markGlyph.ts — nothing user-supplied
                  // reaches here. The writer's own words go through React below.
                  dangerouslySetInnerHTML={{ __html: markGlyphHtml(note.kind) }}
                />
                <span className="mark-margin__body">
                  <span className="mark-margin__text">{note.text}</span>
                  {note.reference ? (
                    <span className="mark-margin__ref">{note.reference}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {pencil.length > 0 && (
        /*
         * Pencil. Graphite and dashed, and deliberately NOT mixed into the list
         * above: a proposal that sits among kept markings is a proposal
         * pretending to be one. Nothing here is counted, and nothing here has
         * reached any other surface.
         */
        <ol className="mark-margin__list mark-margin__list--pencil">
          {pencil.map((p) => (
            <li key={p.id}>
              <div className="mark-margin__note mark-margin__note--pencil">
                <span
                  className={`mark-margin__glyph ${markGlyphClass(p.kind)}`}
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: markGlyphHtml(p.kind) }}
                />
                <span className="mark-margin__body">
                  <span className="mark-margin__text">{p.quote}</span>
                  <span className="mark-margin__actions">
                    <button
                      type="button"
                      className="mark-margin__keep"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onKeep?.(p)}
                    >
                      Keep
                    </button>
                    {/* One tap, costs nothing, says nothing back. No "why not?",
                        no confirmation, no undo bar — a dismissal that asks a
                        question is a dismissal that costs something. */}
                    <button
                      type="button"
                      className="mark-margin__not"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onNotThis?.(p)}
                    >
                      Not this
                    </button>
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}
