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

  // A highlighter wash. Unlike `.cm-mark` above — which is the app setting a
  // passage aside, and so takes the theme's accent — this is the writer's own
  // pen, so the hues stay constant across palettes and only the alpha shifts
  // (see --hl-alpha in themes.css). No transition: the conceal plugin changes
  // this element's width when markers reveal, and an animating width forces
  // repeated measure passes that fight typewriter scrolling.
  '.cm-hl': {
    backgroundColor: 'rgba(var(--hl-hue), var(--hl-alpha))',
    borderRadius: '0.18em',
    padding: '0.06em 0.1em',
    margin: '0 -0.02em',
    // lineWrapping is on: without clone, a highlight crossing a wrap gets one
    // stretched box spanning the gutter instead of one box per line fragment.
    WebkitBoxDecorationBreak: 'clone',
    boxDecorationBreak: 'clone',
  },
  '.cm-hl--amber': { '--hl-hue': 'var(--hl-amber)' },
  '.cm-hl--rose': { '--hl-hue': 'var(--hl-rose)' },
  '.cm-hl--sage': { '--hl-hue': 'var(--hl-sage)' },
  '.cm-hl--sky': { '--hl-hue': 'var(--hl-sky)' },
  '.cm-hl--lilac': { '--hl-hue': 'var(--hl-lilac)' },
})
