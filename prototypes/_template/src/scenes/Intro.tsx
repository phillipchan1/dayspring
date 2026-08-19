export function Intro({ onNext }: { onNext: () => void }) {
  return (
    <div className="paper intro">
      <div className="intro__body">
        <p className="intro__eyebrow">Beta preview · not the live app</p>
        <h1 className="intro__title">__TITLE__</h1>
        <p className="intro__lede">
          Replace this intro with context for beta testers — what you&apos;re exploring, how to
          walk through, and that feedback goes to the team at the end.
        </p>
        <button type="button" className="intro__cta" onClick={onNext}>
          Begin
        </button>
      </div>
    </div>
  )
}
