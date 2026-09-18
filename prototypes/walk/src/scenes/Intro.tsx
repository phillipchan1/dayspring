export function Intro({ onNext }: { onNext: () => void }) {
  return (
    <section className="intro">
      <p className="intro__eyebrow">A sketch · nothing here is built</p>
      <h1 className="intro__title">Lectio, walked</h1>

      <p className="intro__lede">
        One practice. <strong>The other twelve stay exactly as they are.</strong>
      </p>

      <p className="intro__p">
        Every movement of every ritual renders the same way — an amber label, an italic
        question, one writing field. For almost the whole shelf that is right. The Daily
        Examen is four questions asked in order; giving it a mechanism would be an
        interface enjoying itself.
      </p>

      <p className="intro__p">
        It is wrong for exactly one practice, and wrong in a way you can point at rather
        than argue about:
      </p>

      <ul className="intro__defects">
        <li>
          Lectio&apos;s first movement asks the writer to <strong>type the passage out</strong>{' '}
          — &ldquo;Write the passage, then the word that found you…&rdquo;
        </li>
        <li>
          Movements two, three and four all need that passage. The composer has already
          scrolled it off the screen.
        </li>
        <li>
          <strong>Contemplatio</strong> is the movement whose content is not writing. It
          gets a cursor, a placeholder, and then counts as unanswered.
        </li>
      </ul>

      <p className="intro__p">
        Lectio is <em>one passage read four times</em>. The surface reads it once. That is
        not a taste disagreement — it is the practice and the product contradicting each
        other, in the same file.
      </p>

      <p className="intro__p intro__p--quiet">
        The fix is one optional field — <code>kind</code> on <code>PracticePrompt</code>.
        Absent means today&apos;s movement, unchanged, which is what every other practice
        and every ritual ever written in the archive says. Only Lectio&apos;s four prompts
        declare anything.
      </p>

      <button type="button" className="intro__cta" onClick={onNext}>
        Walk it
      </button>
    </section>
  )
}
