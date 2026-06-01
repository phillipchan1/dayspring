import type { ReactNode } from 'react'

export type EntryMenuIconName =
  | 'copy-text'
  | 'copy-markdown'
  | 'export'
  | 'duplicate'
  | 'print'
  | 'delete'

/** 16×16 line icons — same stroke idiom as the desktop rail. */
export function EntryMenuIcon({ name }: { name: EntryMenuIconName }) {
  return (
    <svg
      className="entry-context-menu__icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

const paths: Record<EntryMenuIconName, ReactNode> = {
  'copy-text': (
    <>
      <rect x="8" y="8" width="12" height="14" rx="1.5" />
      <path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  'copy-markdown': (
    <>
      <path d="M7 6v12" />
      <path d="M17 6v12" />
      <path d="M10 9h4" />
      <path d="M9 12h6" />
      <path d="M10 15h4" />
    </>
  ),
  export: (
    <>
      <path d="M12 3v10" />
      <path d="M8 9l4-4 4 4" />
      <path d="M5 21h14" />
    </>
  ),
  duplicate: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="1.5" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  print: (
    <>
      <path d="M7 9V4h10v5" />
      <rect x="5" y="9" width="14" height="8" rx="1.5" />
      <path d="M7 17h10v3H7z" />
      <path d="M9 13h.01" />
      <path d="M15 13h.01" />
    </>
  ),
  delete: (
    <>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M7 7l1-3h8l1 3" />
      <path d="M9 7v13a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V7" />
    </>
  ),
}
