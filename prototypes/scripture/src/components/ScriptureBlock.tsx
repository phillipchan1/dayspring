interface Props {
  text: string
  reference?: string
  translation?: string
  /** When set, the block is clickable (read-around / link scenes). */
  onOpen?: () => void
  linkLabel?: string
  marked?: boolean
  /** Opens ESV.org in a new tab — for exploring beyond this chapter. */
  readMoreHref?: string
  readMoreLabel?: string
}

export function ScriptureBlock({
  text,
  reference = 'James 4:8',
  translation = 'ESV',
  onOpen,
  linkLabel,
  marked = true,
  readMoreHref,
  readMoreLabel = 'Read chapter on ESV.org →',
}: Props) {
  const body = (
    <>
      <p className="scripture-block__text">{text}</p>
      <footer className="scripture-block__ref">
        {reference} · {translation}
        {linkLabel && <span className="scripture-block__link-hint"> · {linkLabel}</span>}
      </footer>
    </>
  )

  const readMore = readMoreHref ? (
    <a
      className="scripture-block__read-more"
      href={readMoreHref}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
    >
      {readMoreLabel}
    </a>
  ) : null

  if (onOpen) {
    return (
      <div className="scripture-block-stack">
        <button type="button" className="scripture-block scripture-block--click" onClick={onOpen}>
          {body}
        </button>
        {readMore}
      </div>
    )
  }

  return (
    <div className="scripture-block-stack">
      <blockquote className="scripture-block" data-marked={marked ? 'true' : undefined}>
        {body}
      </blockquote>
      {readMore}
    </div>
  )
}
