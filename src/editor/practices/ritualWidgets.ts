import { WidgetType } from '@codemirror/view'

/**
 * The block widgets a ritual is drawn with.
 *
 * All of them are `contenteditable="false"` replacements for hidden token
 * lines, so the entry's persisted markdown carries none of this text — only
 * what the writer types is ever saved.
 *
 * Rank matters more here than anywhere else in the editor, because a ritual
 * puts the app's voice and the writer's voice on the same page. Loudest to
 * quietest: the writer's answer, then the live question, then the section
 * label, then the block's masthead. The accent marks exactly one thing.
 */

/** A ritual's masthead — its name, and the quiet actions that act on the block. */
export class RitualHeaderWidget extends WidgetType {
  constructor(
    readonly name: string,
    /** True while the block is still opening a movement at a time. */
    readonly paced: boolean,
    /** True while the caret is inside this block. */
    readonly held: boolean,
  ) {
    super()
  }
  eq(other: RitualHeaderWidget): boolean {
    return other.name === this.name && other.paced === this.paced && other.held === this.held
  }
  toDOM(): HTMLElement {
    const root = document.createElement('div')
    root.className = 'cm-practice-header'
    root.dataset.practice = this.name
    if (this.held) root.dataset.held = 'true'
    root.setAttribute('contenteditable', 'false')

    const name = document.createElement('span')
    name.className = 'cm-practice-header__name'
    name.textContent = this.name
    root.append(name)

    const action = (cls: string, label: string, title: string) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `cm-practice-action cm-practice-action--${cls}`
      button.textContent = label
      button.title = title
      return button
    }

    root.append(
      action('about', 'about', 'Why this ritual, how it moves, and a few tips'),
    )
    // Only worth offering while something is still closed. It is the release
    // valve that keeps pacing from being withholding: anyone who wants the
    // whole shape at once can have it in a single click.
    if (this.paced) {
      root.append(action('showall', 'show all', 'Open every movement at once'))
    }
    root.append(
      action('freewrite', 'free write', 'Remove the prompts and keep only your words'),
    )
    return root
  }
  ignoreEvent(): boolean {
    return false
  }
}

/** A movement's label and question, above the line it asks the writer to fill. */
export class RitualPromptWidget extends WidgetType {
  constructor(
    readonly label: string,
    readonly question: string,
    /** True for the movement directly under the masthead — it needs less air
     *  above it, since the header's own rule already opens the block. */
    readonly first: boolean,
    /** `live` is the movement being written; `passed` is one already behind you. */
    readonly tone: 'live' | 'passed',
    /** True while the caret is inside this block. */
    readonly held: boolean,
  ) {
    super()
  }
  eq(other: RitualPromptWidget): boolean {
    return (
      other.label === this.label &&
      other.question === this.question &&
      other.first === this.first &&
      other.tone === this.tone &&
      other.held === this.held
    )
  }
  toDOM(): HTMLElement {
    const root = document.createElement('div')
    root.className = this.first
      ? 'cm-practice-prompt cm-practice-prompt--first'
      : 'cm-practice-prompt'
    root.dataset.tone = this.tone
    if (this.held) root.dataset.held = 'true'
    root.setAttribute('contenteditable', 'false')
    root.setAttribute('aria-hidden', 'true')

    const label = document.createElement('span')
    label.className = 'cm-practice-prompt__label'
    label.textContent = this.label

    if (this.question) {
      const question = document.createElement('p')
      question.className = 'cm-practice-prompt__question'
      question.textContent = this.question
      root.append(label, question)
    } else {
      root.append(label)
    }
    return root
  }
  ignoreEvent(): boolean {
    return false
  }
}

/**
 * The threshold between one movement and the next.
 *
 * A dot for each movement still closed, and the name of the one waiting. The
 * name is deliberately given and the question deliberately withheld: knowing
 * that *Awareness* comes next orients you, where reading its question would
 * start you composing an answer to it while you are still in Gratitude —
 * which is the scanning-ahead this pacing exists to prevent.
 *
 * There is no count and no bar. The dots say what remains without ever
 * measuring the person against it.
 */
export class RitualAdvanceWidget extends WidgetType {
  constructor(
    readonly nextLabel: string,
    readonly remaining: number,
    readonly held: boolean,
  ) {
    super()
  }
  eq(other: RitualAdvanceWidget): boolean {
    return (
      other.nextLabel === this.nextLabel &&
      other.remaining === this.remaining &&
      other.held === this.held
    )
  }
  toDOM(): HTMLElement {
    const root = document.createElement('div')
    root.className = 'cm-ritual-advance'
    if (this.held) root.dataset.held = 'true'
    root.setAttribute('contenteditable', 'false')

    const dots = document.createElement('span')
    dots.className = 'cm-ritual-advance__dots'
    dots.setAttribute('aria-hidden', 'true')
    for (let i = 0; i < this.remaining; i++) {
      const dot = document.createElement('span')
      dot.className = 'cm-ritual-dot'
      dots.append(dot)
    }

    const next = document.createElement('button')
    next.type = 'button'
    next.className = 'cm-ritual-advance__next'
    next.textContent = `Next: ${this.nextLabel}`
    next.title = 'Open the next movement'

    root.append(dots, next)
    return root
  }
  ignoreEvent(): boolean {
    return false
  }
}

/**
 * A movement not yet opened. It still occupies a token line, so it still needs
 * a widget — but one with no height, so the block below it closes up.
 *
 * `height: 0` and not `display: none`, for the same reason every hidden thing
 * in this editor is: CodeMirror cannot measure a `display: none` element, so
 * its height map keeps a stale estimate and its coordinate→position mapping
 * drifts out of step with the DOM. A zero-height box measures as zero, honestly.
 */
export class RitualClosedWidget extends WidgetType {
  eq(): boolean {
    return true
  }
  toDOM(): HTMLElement {
    const root = document.createElement('div')
    root.className = 'cm-ritual-closed'
    root.setAttribute('contenteditable', 'false')
    root.setAttribute('aria-hidden', 'true')
    return root
  }
  ignoreEvent(): boolean {
    return false
  }
}

/**
 * The dismissal. A ritual that has been prayed all the way through closes with
 * a rule and its own provenance — the way a printed office ends, and the beat
 * the practice was missing on the way out.
 *
 * It states where the practice came from. It says nothing about how the writer
 * did, because that is not ours to say.
 */
export class RitualColophonWidget extends WidgetType {
  constructor(
    readonly name: string,
    readonly origin: string,
    readonly held: boolean,
  ) {
    super()
  }
  eq(other: RitualColophonWidget): boolean {
    return other.name === this.name && other.origin === this.origin && other.held === this.held
  }
  toDOM(): HTMLElement {
    const root = document.createElement('div')
    root.className = 'cm-ritual-colophon'
    if (this.held) root.dataset.held = 'true'
    root.setAttribute('contenteditable', 'false')
    root.setAttribute('aria-hidden', 'true')

    const text = document.createElement('span')
    text.className = 'cm-ritual-colophon__text'
    text.textContent = this.origin ? `${this.name} · ${this.origin}` : this.name
    root.append(text)
    return root
  }
  ignoreEvent(): boolean {
    return false
  }
}
