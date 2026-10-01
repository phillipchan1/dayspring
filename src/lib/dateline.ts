/**
 * The dateline over an entry's title: "Tuesday · October 1".
 *
 * The year appears only when it isn't this one — the way a letter is dated, and
 * the way the reader thinks of a page from last spring. Case is the voice's
 * business (`--label-case` in themes.css), so this returns plain title case.
 */
export function formatDateline(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const weekday = d.toLocaleDateString(undefined, { weekday: 'long' })
  const sameYear = d.getFullYear() === now.getFullYear()
  const date = d.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
  return `${weekday} · ${date}`
}
