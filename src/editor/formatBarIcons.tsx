import type { ReactNode } from 'react'
import type { FormatAction } from './formatSelection'

export function FormatBarIcon({ action }: { action: FormatAction }) {
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

const paths: Record<FormatAction, ReactNode> = {
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
}

export const FORMAT_BAR_ACTIONS: { action: FormatAction; label: string; title: string }[] = [
  { action: 'bold', label: 'Bold', title: 'Bold (⌘B)' },
  { action: 'italic', label: 'Italic', title: 'Italic (⌘I)' },
  { action: 'underline', label: 'Underline', title: 'Underline (⌘U)' },
  { action: 'strike', label: 'Strikethrough', title: 'Strikethrough' },
  { action: 'highlight', label: 'Highlight', title: 'Highlight (⌘⇧H)' },
  { action: 'code', label: 'Code', title: 'Inline code (⌘E)' },
  { action: 'link', label: 'Link', title: 'Link (⌘K)' },
  { action: 'list', label: 'List', title: 'Bullet list' },
  { action: 'quote', label: 'Quote', title: 'Blockquote' },
  { action: 'heading', label: 'Heading', title: 'Heading' },
]
