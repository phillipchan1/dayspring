import { ENTRY_RETURN_LABEL, type EntryReturnContext } from '@/lib/appHistory'

/**
 * Where leaving a ritual entry goes, said the way the rail says it.
 *
 * The rule is the one every back link in the app keeps: back returns you to
 * where you came from, and says so. A ritual begun on a blank page, or opened
 * from the wall, goes back to the journal page; opened from a page you were
 * reading, back to that page; from the Lamp or the Altar, back there.
 */
export function ritualBackTo(ret: EntryReturnContext | null): {
  backTo: string
  backShort: string
} {
  if (!ret || (ret.surface === 'pages' && !ret.pagesSpreadId)) {
    return { backTo: 'your journal', backShort: 'Journal' }
  }
  if (ret.surface === 'pages') return { backTo: 'the page', backShort: 'Page' }
  const label = ENTRY_RETURN_LABEL[ret.surface]
  return { backTo: `the ${label}`, backShort: label }
}

/** Begun from inside an entry that already had writing: a new page, and back to that entry. */
export const BACK_TO_ENTRY = { backTo: 'your entry', backShort: 'Entry' } as const

/** What the library's threshold says about where a ritual will begin. */
export function ritualLanding(pageHasWriting: boolean): string {
  return pageHasWriting
    ? 'Begins on a new page. This entry stays as it is.'
    : 'Begins on this page.'
}
