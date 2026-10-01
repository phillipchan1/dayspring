import { Prec, type Extension } from '@codemirror/state'
import { EditorView, layer, RectangleMarker } from '@codemirror/view'
import { isAppleTouchDevice, isMobileTauri } from '@/lib/platform'

/**
 * Each voice's own caret: Dawn's breathes, Sabbath's breathes slower,
 * Plainsong's is a terminal block, Vellum's a thin line of ink, Cloister's a
 * hairline, and Vigil's holds still — nothing flashes in a dark room.
 *
 * The native caret can only be recoloured (`caret-color`); its shape and blink
 * belong to the OS. So this draws one: a cursor-only layer, built the way
 * CodeMirror's own `drawSelection` builds its cursor — and ONLY the cursor.
 * Selection stays native on purpose (theme.ts styles `::selection` so selected
 * words keep a real foreground colour), so this never touches it.
 *
 * What a voice's caret looks like is CSS, keyed off `[data-theme]` in
 * themes.css ("The caret") — a theme switch restyles it without rebuilding the
 * editor. Shape: width + colour on `.cm-voiceCaret`. Blink: `--caret-period`,
 * `--caret-ease` (steps(1) is a blink, ease-in-out a breath), `--caret-low`.
 *
 * Desktop only — see `voiceCaretSupported`.
 */

const caretLayer = layer({
  above: true,
  class: 'cm-voiceCaretLayer',
  markers(view) {
    const out: RectangleMarker[] = []
    const { main } = view.state.selection
    for (const r of view.state.selection.ranges) {
      // A range selection shows the selection, as a native one does — no caret.
      if (!r.empty) continue
      const cls = r === main ? 'cm-voiceCaret cm-voiceCaret--primary' : 'cm-voiceCaret'
      out.push(...RectangleMarker.forRange(view, cls, r))
    }
    return out
  },
  update(update, dom) {
    // Restart the blink on every keystroke and caret move, so the caret is
    // solid while you write and only starts to breathe once you pause. Two
    // identical keyframe sets, alternated: changing the animation's NAME is
    // what restarts it, without forcing a style recalculation (the trick
    // drawSelection uses).
    if (update.docChanged || update.transactions.some((tr) => tr.selection)) {
      dom.dataset.beat = dom.dataset.beat === 'a' ? 'b' : 'a'
    }
    return update.docChanged || update.selectionSet
  },
  mount(dom) {
    dom.dataset.beat = 'a'
  },
})

const caretTheme = EditorView.theme({
  '.cm-voiceCaretLayer': {
    pointerEvents: 'none',
  },
  '&:not(.cm-focused) .cm-voiceCaretLayer': {
    display: 'none',
  },
  '&.cm-focused > .cm-scroller > .cm-voiceCaretLayer': {
    animationDuration: 'var(--caret-period, 1.06s)',
    animationTimingFunction: 'var(--caret-ease, steps(1, end))',
    animationIterationCount: 'infinite',
  },
  '&.cm-focused > .cm-scroller > .cm-voiceCaretLayer[data-beat="a"]': {
    animationName: 'voice-caret-a',
  },
  '&.cm-focused > .cm-scroller > .cm-voiceCaretLayer[data-beat="b"]': {
    animationName: 'voice-caret-b',
  },
  '@keyframes voice-caret-a': {
    '0%, 100%': { opacity: '1' },
    '50%': { opacity: 'var(--caret-low, 0)' },
  },
  '@keyframes voice-caret-b': {
    '0%, 100%': { opacity: '1' },
    '50%': { opacity: 'var(--caret-low, 0)' },
  },
  // The default shape; voices restyle it. Width only: RectangleMarker places
  // the caret and sizes its height to the character box.
  '.cm-voiceCaret': {
    position: 'absolute',
    width: 'var(--caret-width, 2px)',
    // Centred on the insertion point for a bar; a block starts AT it.
    marginLeft: 'var(--caret-offset, -1px)',
    borderRadius: '1px',
    background: 'var(--caret-color, var(--accent))',
  },
})

/**
 * The native caret goes transparent while a drawn one stands in for it —
 * EXCEPT inside a focused field nested in the page (a widget's own input),
 * which has no drawn caret and keeps a real one. Highest precedence: it has to
 * beat editorTheme's `caret-color: var(--accent)` regardless of order.
 */
const hideNativeCaret = Prec.highest(
  EditorView.theme({
    '.cm-content': {
      caretColor: 'transparent',
    },
    '.cm-content :focus': {
      caretColor: 'var(--accent)',
    },
  }),
)

/**
 * Whether this device should get a drawn caret at all.
 *
 * This is the one place on the writing surface that asks what the device IS
 * (see docs/WRITING_SURFACE_AUDIT.md §3 for why that is usually wrong). It is
 * right here because the question is genuinely about the platform: on iOS and
 * Android the caret is part of the system's own text machinery — the selection
 * handles, the loupe, autocorrect's anchor — and replacing it would mean
 * re-implementing that machinery, not restyling a line. Those keep theirs.
 */
export function voiceCaretSupported(
  ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent,
): boolean {
  if (isMobileTauri()) return false
  if (isAppleTouchDevice(ua)) return false
  return !/Android/i.test(ua)
}

export function voiceCaretExtension(): Extension {
  return [caretLayer, caretTheme, hideNativeCaret]
}
