import { EditorView } from '@codemirror/view'

/**
 * The editor's visual shell. Transparent background so it sits on the app's
 * writing column; spacing/caret/selection tuned for a calm, code-editor feel.
 * Concrete colors are pulled from CSS custom properties so themes stay in one
 * place (themes.css) and the editor follows whatever [data-theme] is active.
 */
export const editorTheme = EditorView.theme({
  '&': {
    color: 'var(--text)',
    backgroundColor: 'transparent',
    fontSize: 'var(--editor-font-size)',
    height: '100%',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-editor)',
    lineHeight: 'var(--editor-line-height)',
    overflow: 'auto',
    /*
     * The two axes, split between the browser and the back-swipe.
     *
     * A scroller left on `auto` hands WebKit both directions, so it is free to
     * read the opening pixels of a horizontal drag as a pan — and once it has
     * claimed the gesture, `touchmove` stops arriving altogether. The shell that
     * is supposed to be following the finger freezes wherever it got to, and the
     * only swipes that ever work are the ones fast enough to finish inside the
     * first few events. Which is exactly what "it only handles a clean swipe"
     * was.
     *
     * `pan-y` gives the browser the vertical axis — scrolling a long entry stays
     * composited, which matters more here than anywhere — and keeps the
     * horizontal one for MobileJournal's back-swipe. Lines wrap, so there is no
     * horizontal scrolling to lose. Same division `.pg-read1__slide` makes in
     * Pages.css, for the same reason.
     */
    touchAction: 'pan-y',
  },
  '.cm-content': {
    caretColor: 'var(--accent)',
    // NB: use longhands, not the `padding` shorthand — the typewriter extension
    // sets paddingTop/Bottom and a shorthand here would reset them.
    paddingLeft: '0',
    paddingRight: '0',
    // Scroll-past-end breathing room. Typewriter theme overrides this with its
    // dynamic 45% padding when active (it's registered later in the ext array).
    paddingBottom: '40vh',
    maxWidth: 'var(--editor-max-width)',
    margin: '0 auto',
  },
  '.cm-line': {
    padding: '0',
    fontFamily: 'var(--font-editor)',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--accent)',
    borderLeftWidth: '2px',
  },
  // Thematic text selection (accent-tinted, readable in every theme). We style
  // ::selection directly instead of drawSelection so selected text gets a proper
  // foreground color — not the system blue on macOS or faint accent washes.
  // !important wins over inline syntax tag colors on nested spans.
  '.cm-content ::selection, .cm-content *::selection': {
    backgroundColor: 'var(--selection-bg) !important',
    color: 'var(--selection-fg) !important',
  },
  '.cm-content::-moz-selection, .cm-content *::-moz-selection': {
    backgroundColor: 'var(--selection-bg) !important',
    color: 'var(--selection-fg) !important',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'transparent !important',
  },
  '.cm-placeholder': {
    color: 'var(--text-faint)',
    fontStyle: 'italic',
  },
  // Active line stays subtle — focus mode handles emphasis later.
  '.cm-activeLine': {
    backgroundColor: 'transparent',
  },
  '.cm-commandLine': {
    backgroundColor: 'var(--accent-soft)',
  },
  // Quiet underline on recognized scripture references — warm, passive, the
  // same gold as the Scripture surface. Never changes layout or caret behavior.
  '.cm-scriptureRef': {
    textDecoration: 'underline',
    textDecorationColor: 'color-mix(in srgb, rgb(var(--scripture-gold)) 45%, transparent)',
    textDecorationThickness: '1px',
    textUnderlineOffset: '3px',
  },
  // A marked passage. Derived from the theme's own accent rather than a fixed
  // highlighter yellow, so it belongs in all six palettes and in both light and
  // dark — and kept low enough that the prose stays the brightest thing on the
  // line. It must read as ground, not as ink.
  '.cm-mark': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 13%, transparent)',
    boxShadow: '0 1px 0 color-mix(in srgb, var(--accent) 30%, transparent)',
    borderRadius: '2px',
  },
  // Focus mode needs no rule here: `.cm-dim` is a LINE decoration carrying
  // `opacity: 0.28`, which already fades the mark along with its text. An
  // explicit override would dim it twice and lose it entirely.

  // Highlighter wash colour lives in global.css (`.cm-hl--*`) so it reads
  // `--hl-*` off [data-theme] like every other surface. Setting `--hl-hue`
  // through EditorView.theme can fail to paint: style-mod's custom-property
  // hop leaves `rgba(var(--hl-hue), …)` invalid, which is a wash that vanishes
  // in every palette. Only wrap-clone stays here — that's a CodeMirror
  // line-wrapping concern. No transition: the conceal plugin changes this
  // element's width when markers reveal, and an animating width forces
  // repeated measure passes that fight typewriter scrolling.
  '.cm-hl': {
    // lineWrapping is on: without clone, a highlight crossing a wrap gets one
    // stretched box spanning the gutter instead of one box per line fragment.
    WebkitBoxDecorationBreak: 'clone',
    boxDecorationBreak: 'clone',
  },
})
