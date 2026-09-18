import { PASSAGE, PRAYER } from '../data/sketch'

/**
 * What the walk leaves behind.
 *
 * The point of this screen is that the document format does not change. A ritual
 * is still `<!-- ritual:name -->` plus a `<!-- ritual:section -->` per movement
 * with the writer's words under it (`ritualDocument.ts`), so sync, autosave,
 * Pages, the rollups and the Ascent keep reading exactly what they already read.
 *
 * Two things are genuinely new in the record, and both are gains that fall out
 * for free rather than features anyone has to build:
 *
 *  1. Bring writes a REAL `dayspring-scripture` fence (`spiritualBlocks.ts`)
 *     instead of prose the writer retyped. So the passage renders as scripture
 *     in the entry and the Scripture surface captures the reference on save —
 *     which is how it already works for a pasted verse today.
 *  2. Mark writes one word. A movement answered in one word is not a thin
 *     answer here; it is the correct answer, and it is the one that threads.
 */
export function Record() {
  return (
    <section className="scene">
      <header className="scene__head">
        <p className="scene__eyebrow">Afterwards</p>
        <h1 className="scene__title">What it leaves in the entry</h1>
        <p className="scene__gesture">
          The document format does not change at all. Everything downstream keeps reading
          what it already reads.
        </p>
      </header>

      <div className="entry">
        <p className="entry__date">Thursday, 17 September</p>

        <div className="entry__ritual">
          <p className="entry__practice">Lectio Divina</p>

          <p className="entry__label">Lectio — Read</p>
          {/* Rendered exactly as a scripture block renders in the entry today. */}
          <blockquote className="entry__scripture">
            <p>{PASSAGE.text}</p>
            <cite>
              {PASSAGE.ref} <span className="entry__tr">{PASSAGE.translation}</span>
            </cite>
          </blockquote>

          <p className="entry__label">Meditatio — Meditate</p>
          <p className="entry__word">rest</p>

          <p className="entry__label">Oratio — Pray</p>
          <p className="entry__prose">{PRAYER}</p>

          <p className="entry__label">Contemplatio — Rest</p>
          <p className="entry__rested">rested</p>
        </div>
      </div>

      <div className="raw">
        <p className="raw__head">The markdown underneath</p>
        <pre className="raw__pre">{`<!-- ritual:name:Lectio Divina -->
<!-- ritual:section:Lectio — Read -->
\`\`\`dayspring-scripture 8f3c…
${PASSAGE.text}
${PASSAGE.ref}
\`\`\`
<!-- ritual:section:Meditatio — Meditate -->
rest
<!-- ritual:section:Oratio — Pray -->
${PRAYER}
<!-- ritual:section:Contemplatio — Rest -->`}</pre>
      </div>

      <div className="decisions">
        <p className="decisions__head">Two decisions this screen is making for you</p>

        <div className="decision">
          <p className="decision__q">What does Contemplatio store?</p>
          <p className="decision__a">
            Above it stores nothing — the section token with no words under it. That is
            already legal markdown, but <code>isRitualComplete</code> requires every
            movement filled, so an honest Contemplatio would leave a{' '}
            <strong>continue</strong> button on the entry forever. The Round has the same
            problem with a domain passed in silence, and already solves it by dropping
            untouched movements on the way out. Lectio can borrow that — or record the
            word <em>rested</em>, which is what is drawn here.
          </p>
        </div>

        <div className="decision">
          <p className="decision__q">Can a scripture fence live inside a ritual block?</p>
          <p className="decision__a">
            The document says yes — <code>ritualDocument.ts</code> replaces the block
            whole and a movement&apos;s text is just lines. What has to be checked rather
            than assumed is the <em>editor&apos;s</em> decoration layer: a{' '}
            <code>block:true</code> replace inside another block is exactly where the two
            widget bugs already in the archive came from. This is the one engineering
            unknown in the whole proposal.
          </p>
        </div>
      </div>
    </section>
  )
}
