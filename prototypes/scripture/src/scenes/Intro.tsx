export function Intro() {
  return (
    <div className="paper intro">
      <div className="intro__body">
        <p className="intro__eyebrow">Beta preview · about 5 minutes · not the live app</p>
        <h1 className="intro__title">Scripture while you journal</h1>
        <p className="intro__lede">
          Dayspring already tracks verses you insert with{' '}
          <span className="intro__cmd">/scripture</span> — they show up in your scripture
          view over time. We&apos;re looking at two gaps:
        </p>
        <ul className="intro__asks">
          <li>
            <strong>Read around a verse</strong> — after something lands, sit with the rest
            of the chapter without leaving the journal. That&apos;s the main question in
            this walkthrough.
          </li>
          <li>
            <strong>Pasted verses should count</strong> — if you copy from a Bible app, it
            should land the same way as a <span className="intro__cmd">/scripture</span>{' '}
            insert. We&apos;re treating that as coming either way; you&apos;ll see a quick
            mock of it.
          </li>
        </ul>
        <p className="intro__lede">
          This is a clickable mockup with a fictional journal entry — not the live app.
          Notes at the bottom explain each screen. At the end, pick between two directions
          for reading around a verse (or tell us something else).
        </p>
        <ul className="intro__list">
          <li>Tap <strong>Next</strong> below to begin.</li>
          <li>Try the prompts — tap verse blocks, open /scripture, simulate a paste.</li>
          <li>Your pick at the end goes straight to the team. No account needed.</li>
        </ul>
      </div>
    </div>
  )
}
