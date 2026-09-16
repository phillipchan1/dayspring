export function Intro({ onNext }: { onNext: () => void }) {
  return (
    <div className="shell">
      <p className="eyebrow">Prototype · The ritual thread</p>
      <h1 className="title">
        Rituals are the only part of Dayspring that never comes back to you.
      </h1>

      <p className="lede">
        The Ascent returns your year. The Altar returns your prayers. Pages returns your
        archive. Scripture returns the verses that keep arriving. A ritual takes what you
        write and gives nothing back — not once, not ever.
      </p>

      <p className="lede lede--dim">
        Which is strange, because a ritual is the most structured writing in the product.
        Every answer already carries a named practice, a named movement and a date, in the
        entry itself. Thirteen practices ask about sixty questions between them, and there
        is no screen anywhere that can show you your own answers to any one of them.
      </p>

      <p className="lede lede--dim">
        So this is the smallest possible version of the missing half: your answers to the
        same movement, in order, verbatim. No model, no summary, no score. A group-by over
        words you already wrote.
      </p>

      <button type="button" className="cta" onClick={onNext}>
        Start
      </button>

      <p className="caution">
        <strong>Read the toggle at the top of each screen.</strong> The default archive is
        invented — a writer over five months. The second switches to a real journal
        extracted from the live database, which holds twelve ritual blocks across 2,994
        entries. Both are true, and the gap between them is the decision. (The real one
        is local-only and greyed out unless you have run the extractor yourself.)
      </p>
    </div>
  )
}
