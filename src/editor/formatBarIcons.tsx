import type { ReactNode } from 'react'
import type { FormatAction } from './formatSelection'

/**
 * `mark` is not a FormatAction: it writes no markdown and changes no character
 * of the entry. It rides this bar because the bar is the affordance that already
 * appears on a selection — adding it here costs the writing surface nothing,
 * which is the whole constraint (Principle 3).
 */
/** System edit-menu verbs we re-host on iOS after suppressing the native bubble. */
export type SystemAction =
  | 'cut'
  | 'copy'
  | 'paste'
  | 'lookup'
  | 'translate'
  | 'search'
  | 'share'
  | 'speak'
  | 'replace'
  | 'selectAll'

export type BarAction = FormatAction | 'mark' | SystemAction

export function FormatBarIcon({ action }: { action: BarAction }) {
  return (
    <svg
      className="format-bar__icon"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[action]}
    </svg>
  )
}

const paths: Record<BarAction, ReactNode> = {
  // A bookmark, not a highlighter pen: marking sets a passage aside, it doesn't
  // colour it. Filled so it reads as a state, not another formatting toggle.
  mark: <path d="M7 4h10v16l-5-4-5 4V4z" />,
  bold: <path d="M7 5h7a4 4 0 0 1 0 8H7V5zm0 8h8a4 4 0 0 1 0 8H7v-8z" />,
  italic: <path d="M11 5h10M7 19h10M14 5l-4 14" />,
  underline: (
    <>
      <path d="M7 4v6a5 5 0 0 0 10 0V4" />
      <path d="M6 20h12" />
    </>
  ),
  // A marker nib laid over the line it has just drawn — a highlighter, not the
  // bookmark that `mark` uses. The two must never read as the same gesture.
  highlight: (
    <>
      <path d="M13 4l7 7-7 7H7l-3-3 9-11z" />
      <path d="M4 21h16" />
    </>
  ),
  strike: (
    <>
      <path d="M5 12h14" />
      <path d="M6 6h12" />
      <path d="M6 18h12" />
    </>
  ),
  code: <path d="M8 8l-3 4 3 4M16 8l3 4-3 4" />,
  link: (
    <>
      <path d="M10 14a4 4 0 0 1 0-5.7l1.3-1.3a4 4 0 0 1 5.7 5.7L16 13" />
      <path d="M14 10a4 4 0 0 1 0 5.7l-1.3 1.3a4 4 0 0 1-5.7-5.7L8 11" />
    </>
  ),
  list: (
    <>
      <path d="M9 6h12" />
      <path d="M9 12h12" />
      <path d="M9 18h12" />
      <circle cx="5" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="5" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  quote: (
    <>
      <path d="M7 7h3v6H7c0-2 1-3 3-3" />
      <path d="M14 7h3v6h-3c0-2 1-3 3-3" />
    </>
  ),
  heading: (
    <>
      <path d="M6 6v12" />
      <path d="M12 6v12" />
      <path d="M6 12h6" />
      <path d="M16 10h6" />
      <path d="M19 6v8" />
    </>
  ),
  cut: (
    <>
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.2 16.2L20 4" />
      <path d="M14.8 11.2L8.2 16.2" />
      <path d="M12 9.5L4 4" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="11" height="13" rx="1.5" />
      <path d="M6 16V5.5A1.5 1.5 0 0 1 7.5 4H16" />
    </>
  ),
  paste: (
    <>
      <path d="M8 6h8v14H8z" />
      <path d="M10 6V4.8A1.8 1.8 0 0 1 11.8 3h.4A1.8 1.8 0 0 1 14 4.8V6" />
      <path d="M10 11h4" />
    </>
  ),
  lookup: (
    <>
      <path d="M6 4h9a2 2 0 0 1 2 2v14l-4-2-4 2V6a2 2 0 0 1 2-2" />
      <path d="M6 4a2 2 0 0 0-2 2v14l4-2" />
    </>
  ),
  translate: (
    <>
      <path d="M4 7h9" />
      <path d="M8.5 7v1.5A6 6 0 0 1 4 14" />
      <path d="M8.5 8.5A6 6 0 0 0 13 14" />
      <path d="M12 18l3-8 3 8" />
      <path d="M13.2 15.5h3.6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="6" cy="12" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
      <path d="M8 11l8-4" />
      <path d="M8 13l8 4" />
    </>
  ),
  speak: (
    <>
      <path d="M4 10v4h3l5 4V6L7 10H4z" />
      <path d="M16 9.5a4 4 0 0 1 0 5" />
      <path d="M18.5 7a7 7 0 0 1 0 10" />
    </>
  ),
  replace: (
    <>
      <path d="M7 8h10" />
      <path d="M12 8v10" />
      <path d="M4 18h16" />
    </>
  ),
  selectAll: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8" />
      <path d="M8 12h8" />
      <path d="M8 15h5" />
    </>
  ),
}

/**
 * `sep` draws the divider before an item. It used to be a hard-coded `i === 4`
 * in the bar, which silently pointed at the wrong button the moment this list
 * changed — as it did when `mark` was added at the front.
 */
export const FORMAT_BAR_ACTIONS: {
  action: BarAction
  label: string
  title: string
  sep?: true
}[] = [
  { action: 'bold', label: 'Bold', title: 'Bold (⌘B)' },
  { action: 'italic', label: 'Italic', title: 'Italic (⌘I)' },
  { action: 'underline', label: 'Underline', title: 'Underline (⌘U)' },
  { action: 'strike', label: 'Strikethrough', title: 'Strikethrough' },
  { action: 'highlight', label: 'Highlight', title: 'Highlight (⌘⇧H)' },
  { action: 'code', label: 'Code', title: 'Inline code (⌘E)' },
  { action: 'link', label: 'Link', title: 'Link (⌘K)', sep: true },
  { action: 'list', label: 'List', title: 'Bullet list' },
  { action: 'quote', label: 'Quote', title: 'Blockquote' },
  { action: 'heading', label: 'Heading', title: 'Heading' },
]

/** Prepended when the open entry is old enough to be re-read rather than written. */
export const MARK_BAR_ACTION = {
  action: 'mark' as const,
  label: 'Mark',
  title: 'Mark this passage',
}

/** First page of the iOS system menu we replace: Cut / Copy / Paste. */
export const IOS_EDIT_ACTIONS: {
  action: SystemAction
  label: string
  title: string
  sep?: true
}[] = [
  { action: 'cut', label: 'Cut', title: 'Cut' },
  { action: 'copy', label: 'Copy', title: 'Copy' },
  { action: 'paste', label: 'Paste', title: 'Paste' },
]

/** Overflow of that same menu: everything after the edit trio. */
export const IOS_MORE_ACTIONS: {
  action: SystemAction
  label: string
  title: string
}[] = [
  { action: 'lookup', label: 'Look Up', title: 'Look Up' },
  { action: 'translate', label: 'Translate', title: 'Translate' },
  { action: 'search', label: 'Search Web', title: 'Search Web' },
  { action: 'share', label: 'Share', title: 'Share' },
  { action: 'speak', label: 'Speak', title: 'Speak' },
  { action: 'replace', label: 'Replace', title: 'Replace…' },
  { action: 'selectAll', label: 'Select All', title: 'Select All' },
]
