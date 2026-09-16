import { useMemo } from 'react'
import { AnswerColumn } from '../components/AnswerColumn'
import { Masthead } from '../components/Masthead'
import { archiveFor, type Source } from '../lib/source'

/**
 * One question, everything you have ever said to it.
 *
 * This is the whole proposal in one screen, and the reason it is worth building
 * is that it is almost free: `parseRitualBlocks` already returns name, label and
 * text from raw markdown, and Pages already has the entries in memory. No
 * migration, no endpoint, no model — a parse and a group-by.
 *
 * It is also the one Dayspring surface that cannot hallucinate, because there
 * is nothing on it that the writer did not type.
 */
export function OneQuestion({
  source,
  onSource,
  focus,
  onBack,
}: {
  source: Source
  onSource: (s: Source) => void
  focus: { practice: string; label: string } | null
  onBack: () => void
}) {
  const archive = archiveFor(source)

  /**
   * The deepest movement in the archive — the strongest case the data can make.
   *
   * Ties break toward the SHORTER answers, and that is a real design finding
   * rather than a convenience. "Everything" and "What matters" are both answered
   * eighteen times, but the first is a brain dump and eighteen dumps in a column
   * is a wall; the second is one line a morning and reads as a thread. Depth
   * alone does not make a movement worth threading — brevity does too.
   */
  const deepest = useMemo(() => {
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
    const all = archive.threads.flatMap((t) => t.movements.map((m) => ({ t, m })))
    return (
      all.sort(
        (a, b) =>
          b.m.answers.length - a.m.answers.length ||
          mean(a.m.answers.map((x) => x.text.length)) -
            mean(b.m.answers.map((x) => x.text.length)),
      )[0] ?? null
    )
  }, [archive])

  const chosen = useMemo(() => {
    if (!focus) return deepest
    const t = archive.threads.find((x) => x.practice === focus.practice)
    const m = t?.movements.find((x) => x.label === focus.label)
    return t && m && m.answers.length ? { t, m } : deepest
  }, [archive, focus, deepest])

  if (!chosen) {
    return (
      <div className="shell">
        <Masthead label="Back" source={source} onSource={onSource} onBack={onBack} />
        <h1 className="title">No thread deep enough to show</h1>
        <div className="empty">
          <strong>This archive has no movement answered more than once.</strong>
          <br />A thread needs repetition, and repetition is the thing rituals do not
          currently get. Switch the source to see what the surface is for.
        </div>
      </div>
    )
  }

  const { t, m } = chosen

  return (
    <div className="shell">
      <Masthead label="Back" source={source} onSource={onSource} onBack={onBack} />

      <p className="question__label">
        {t.practice} · {m.label}
      </p>
      <h1 className="question" style={{ fontSize: 'clamp(1.5rem, 4.4vw, 2rem)' }}>
        {m.question || m.label}
      </h1>
      <p className="question__sub">Everything you have written here, newest first.</p>

      <AnswerColumn answers={m.answers} />

      <p className="caution">
        <strong>What this screen deliberately does not do.</strong> It does not tell you
        the answer keeps being the same one. It does not point out that a name appears in
        four consecutive entries. It does not congratulate you for returning. Every one of
        those is available and every one of them is a verdict — the reader does the
        noticing, and that is not a limitation of the build, it is the product.
      </p>
    </div>
  )
}
