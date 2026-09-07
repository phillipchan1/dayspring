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
    /** True while some movement is still unanswered — offers a way back in. */
    readonly unfinished: boolean,
    /** True while the caret is inside this block. */
    readonly held: boolean,
  ) {
    super()
  }
  eq(other: RitualHeaderWidget): boolean {
    return (
      other.name === this.name &&
      other.unfinished === this.unfinished &&
      other.held === this.held
    )
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
    // A ritual left part-written needs a door back into the composer, which is
    // where movements are paced now. A finished one does not: it is a record,
    // and you edit a record in place like any other text.
    if (this.unfinished) {
      root.append(action('continue', 'continue', 'Pick the ritual back up where you left it'))
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
      other.held === this.held
    )
  }
  toDOM(): HTMLElement {
    const root = document.createElement('div')
    root.className = this.first
      ? 'cm-practice-prompt cm-practice-prompt--first'
      : 'cm-practice-prompt'
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

/** Example phrasing on the live movement's empty line — gone once writing begins. */
export class RitualPlaceholderWidget extends WidgetType {
  constructor(readonly text: string) {
    super()
  }
  eq(other: RitualPlaceholderWidget): boolean {
    return other.text === this.text
  }
  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-practice-placeholder'
    span.setAttribute('aria-hidden', 'true')
    span.textContent = this.text
    return span
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
