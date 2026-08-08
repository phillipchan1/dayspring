import { NAMED_COLOR_PATTERN } from './highlightColors'

/**
 * Strip inline markdown *markers* while keeping every word.
 *
 * Pair-aware on purpose. Sidebar titles and previews used to strip markers with
 * a character class (`/[*_~`]/g`), which was survivable while the marker set was
 * punctuation nobody writes mid-sentence. It stopped being survivable the moment
 * `==` and `++` became markers: a character class would turn `2+2=4` into `224`
 * and `C++` into `C`. A marker only disappears here when it has a partner.
 *
 * Order matters — highlight is the outermost wrapper, so it peels first.
 */

const HIGHLIGHT_RE = new RegExp(`==(?:\\{(?:${NAMED_COLOR_PATTERN})\\})?(?!\\s)([^=]+?)(?<!\\s)==`, 'g')
const UNDERLINE_RE = /\+\+(?!\s)([^+]+?)(?<!\s)\+\+/g
const EMPHASIS_RE = /(\*\*\*|\*\*|\*|___|__|_)(?!\s)([\s\S]+?)(?<!\s)\1/g
const STRIKE_RE = /~~(?!\s)([\s\S]+?)(?<!\s)~~/g
const CODE_RE = /`([^`]+)`/g
// The leading `!` is part of an image, not prose — without it an image collapses
// to "!alt text" and the bang reads as punctuation the writer never typed.
const LINK_RE = /!?\[([^\]]*)\]\([^)]*\)/g

export function stripInlineMarkers(text: string): string {
  return text
    .replace(HIGHLIGHT_RE, '$1')
    .replace(UNDERLINE_RE, '$1')
    .replace(EMPHASIS_RE, '$2')
    .replace(STRIKE_RE, '$1')
    .replace(CODE_RE, '$1')
    .replace(LINK_RE, '$1') // a link collapses to its label
}

/** Line-level markers (heading hash, quote arrow, bullet, number). */
export function stripLineMarkers(text: string): string {
  return text
    .replace(/^#{1,6}\s+/, '')
    .replace(/^>\s*/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
}

/** Both passes — what a title or preview wants. */
export function stripMarkdownMarkers(text: string): string {
  return stripInlineMarkers(stripLineMarkers(text))
}
