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
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--accent-soft)',
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
})
