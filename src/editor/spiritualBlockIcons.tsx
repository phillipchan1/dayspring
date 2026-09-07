import type { ReactNode } from 'react'
import type { SlashCommandId } from './slashDetect'

/**
 * Line-art icons for the spiritual capture blocks — the same stroke idiom as the
 * format bar and entry menu (24×24, currentColor stroke, round caps), so the
 * slash palette and keyboard toolbar read as one family instead of borrowing
 * the OS emoji set. They inherit color and size from the surrounding text.
 */
export function SpiritualBlockIcon({ id }: { id: SlashCommandId }) {
  return (
    <svg
      className="spiritual-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[id]}
    </svg>
  )
}

const paths: Record<SlashCommandId, ReactNode> = {
  // Open book — the Word, pages parting from a central spine.
  scripture: (
    <>
      <path d="M12 7c-1.7-1.2-4-1.7-6.6-1.4a1 1 0 0 0-.9 1v10.2a1 1 0 0 0 1.1 1c2.4-.3 4.5.2 6.4 1.6 1.9-1.4 4-1.9 6.4-1.6a1 1 0 0 0 1.1-1V6.6a1 1 0 0 0-.9-1C16 5.3 13.7 5.8 12 7Z" />
      <path d="M12 7v11.4" />
    </>
  ),
  // Two palms pressed together — prayer, fingertips meeting at the top.
  pray: (
    <>
      <path d="M12 3.6c-.8 1.8-1.8 3.2-3 4.3-1 1-1.5 2-1.5 3.4v7.1a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-7.1c0-1.4-.5-2.4-1.5-3.4-1.2-1.1-2.2-2.5-3-4.3Z" />
      <path d="M12 3.6v15.8" />
    </>
  ),
  // Sparkle — a word or impression catching the light.
  sense: (
    <>
      <path d="M12 4l1.7 5.1a2 2 0 0 0 1.2 1.2L20 12l-5.1 1.7a2 2 0 0 0-1.2 1.2L12 20l-1.7-5.1a2 2 0 0 0-1.2-1.2L4 12l5.1-1.7a2 2 0 0 0 1.2-1.2L12 4Z" />
      <path d="M19 4.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L17 6l1.5-.5Z" />
    </>
  ),
  // Flame — devotional practice, the kindled inner life.
  ritual: (
    <path d="M12 3c2.6 3.1 4.5 5.4 4.5 8.6a4.5 4.5 0 0 1-9 0c0-1.4.5-2.7 1.4-3.7.3 1 .9 1.7 1.6 2.1 0-2.4.4-4.5 1.5-7Z" />
  ),
  // Framed photo — a kept image, horizon and sun within the border.
  image: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.4" />
      <path d="M5 17l4.2-4.2a2 2 0 0 1 2.8 0L19 19.5" />
    </>
  ),
  // A shallow bowl with something resting in it. Received, not achieved.
  gift: (
    <>
      <path d="M5 11a7 7 0 0 0 14 0" />
      <circle cx="12" cy="6.2" r="1.9" />
    </>
  ),
  // A ring left open — a reaching that travels toward something and does not
  // close on it. Sideways, never upward: a glyph that rose would be saying that
  // wanting more is better.
  desire: (
    <>
      <path d="M16.8 7.6a5.6 5.6 0 1 0 0 8.8" />
      <circle cx="19.2" cy="12" r="1.3" />
    </>
  ),
  /*
   * A benchmark: the flat rule a surveyor leaves to say "this is the level",
   * with a short tick dropping from it. Flat on purpose — Principle 1 forbids
   * vertical valence, so nothing here rises. The tick hangs rather than crosses
   * because a centred cross at this size reads as "+", which in a command
   * palette means insert.
   */
  learned: (
    <>
      <path d="M4.5 10.5h15" />
      <path d="M12 10.5v5.5" />
    </>
  ),
  // The brace people actually draw in a margin beside a paragraph they want to
  // keep.
  story: <path d="M15.5 3.5c-4 0-2.5 7.5-7 8.5 4.5 1 3 8.5 7 8.5" />,
  // A line with a gap in it. Not a cross and not an X — absence is a gap, never
  // a mark against you, and the drawing has to say that before the label does.
  absence: (
    <>
      <path d="M12 3.5v6.2" />
      <path d="M12 14.3v6.2" />
    </>
  ),
  // Smiling face — a light expression, same stroke idiom as the other blocks.
  emoji: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 14c.9 1.2 2 1.8 3.5 1.8s2.6-.6 3.5-1.8" />
      <path d="M9 9.5h.01" />
      <path d="M15 9.5h.01" />
    </>
  ),
}

/** Scan a handwritten page — camera-corner brackets framing ruled lines. */
export function ScanIcon() {
  return (
    <svg
      className="spiritual-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 8V6a2 2 0 0 1 2-2h2" />
      <path d="M16 4h2a2 2 0 0 1 2 2v2" />
      <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
      <path d="M8 20H6a2 2 0 0 1-2-2v-2" />
      <path d="M8 10h8" />
      <path d="M8 14h5" />
    </svg>
  )
}

/** Microphone for the toolbar's Voice action — same family as the blocks above. */
export function VoiceIcon() {
  return (
    <svg
      className="spiritual-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21" />
    </svg>
  )
}
