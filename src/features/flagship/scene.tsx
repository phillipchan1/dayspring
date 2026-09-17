/**
 * THE FLAGSHIP SCENE — the app, doing the one thing it is for, in one frame.
 *
 * Every other marketing asset we have is a detail: a listing shot is one
 * surface at phone width, an ad is a fragment under a headline. A stranger who
 * sees only a detail never assembles the whole, and scrolls. This is the frame
 * that has to work alone.
 *
 * What it shows, and why it is this and not something else:
 *
 *  · **The desktop app, whole.** Rail, header, writing column — the shape of a
 *    tool someone works in, not a panel someone glances at. `DesktopJournal` is
 *    the shipped shell; nothing here is drawn.
 *  · **Writing already on the page**, in a voice a person recognises as a
 *    person's. The page is not empty and not a feature demo.
 *  · **The `/` palette open, mid-entry.** This is the gesture the whole product
 *    turns on, and it is the only thing in the picture that no other journal
 *    does. It is also self-explaining: two columns of plain English, so a
 *    stranger reads what the app is *for* off the image itself.
 *
 * The palette is opened the way a writer opens it — the `+` in the gutter, via
 * the shipped `lineMenuExtension` mousedown path — not by faking state. If that
 * door ever breaks, this image fails to render rather than lying about it.
 */

import { useEffect, useRef } from 'react'
import { DesktopJournal } from '@/features/journal/DesktopJournal'
import { Editor } from '@/editor/Editor'
import { journalProps } from '@/features/appstore/devices'

const noop = () => {}

/**
 * The fixture ids the two block widgets key off. Fabricated, like everything
 * else here — they only have to be stable and unique within the document.
 */
const SCRIPTURE_ID = '2f6c8e14-5a7b-4d92-b3e0-8c1a9f4d7e63'

/**
 * The entry on screen.
 *
 * Written to four constraints, all of which are load-bearing:
 *
 *  1. **It has to be a person.** Sample copy that reads like sample copy
 *     ("Today I felt grateful") makes the whole picture read as a mock-up.
 *  2. **It cannot be a real entry.** Fabricated, always — the same rule the ad
 *     and listing fixtures keep. No public asset carries anyone's journal.
 *  3. **The scripture block is in it.** The palette alone shows the menu; the
 *     block shows what the menu DOES — a passage set in the page, word for
 *     word, where the sentence was. One frame then carries the whole gesture:
 *     the line, the verse it reached for, and the door that put it there.
 *  4. **It ends on an open line, with room under it.** The palette opens beside
 *     the line the writer is on, and when there is not room below it flips
 *     ABOVE and lands on top of the writing — a picture of a menu covering a
 *     page, which argues the opposite of the case. This much content keeps the
 *     caret near y=480, which is why the window is 920pt tall and not less.
 *
 *     The sentence is also one line exactly, and that is worth protecting. A
 *     word over and it wraps, stranding "it." alone on a line of its own — an
 *     orphan the eye reads as a mistake in an image this size.
 *
 * No blank line around the fence: `formatScriptureInsert` inserts a block with
 * one newline before and none after, so a blank line here stacks the editor's
 * own block margins on an empty paragraph and opens a gap the app never shows.
 * The single newline AFTER the closing fence is the caret's line, and is the
 * one thing in this document that is not what the app would have produced.
 */
const FLAGSHIP_DOC = `Tuesday

Dad's scan is Thursday. I keep rehearsing the worst version.
\`\`\`dayspring-scripture ${SCRIPTURE_ID}
And we know that all things work together for good to them that love God
Romans 8:28
\`\`\`
`

/** Mirrors GUTTER_REM in editor/lineMenu.ts — the `+` column's centre. */
const GUTTER_REM = 1.35

/**
 * Press the `+` beside the last line, from outside the editor.
 *
 * `lineMenuExtension` registers a `mousedown` handler on the content DOM and
 * finds the line **by Y**, because the `+` is a pseudo-element drawn in the
 * gutter — outside its own line's box, where `event.target` is the scroller. So
 * a synthetic event at the right coordinates is not a hack around the real
 * path; it *is* the real path, minus a hand.
 *
 * Retried on a frame loop rather than fired once after a timeout: the editor
 * mounts, CodeMirror measures, fonts land, and the line's rect is wrong until
 * all three have happened. The loop gives up rather than spinning, and a
 * capture of a scene with no palette is obvious on sight.
 */
function openPaletteOnLastLine(host: HTMLElement, onOpen: () => void): () => void {
  let frame = 0
  let tries = 0
  const tick = () => {
    tries += 1
    const content = host.querySelector<HTMLElement>('.cm-content')
    const lines = content?.querySelectorAll<HTMLElement>('.cm-line')
    const line = lines?.[lines.length - 1]
    if (content && line && line.getBoundingClientRect().height > 0) {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const rect = line.getBoundingClientRect()
      const size = parseFloat(getComputedStyle(line).fontSize) || 16
      content.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          clientX: content.getBoundingClientRect().left - GUTTER_REM * rem,
          // Half a `+` down from the top of the line — inside the small box the
          // glyph is actually drawn in, which is what `hitPlus` tests.
          clientY: rect.top + 0.1 * 0.78 * size + 0.6 * 0.78 * size,
        }),
      )
      if (document.querySelector('.slash-palette')) return onOpen()
    }
    if (tries < 240) frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(frame)
}

/**
 * `data-flagship-ready` on the documentElement is the capture script's signal
 * that the palette is up and the scene has settled. Without it the script can
 * only wait a guessed number of seconds, and a slow machine ships a picture of
 * an app with no menu open — the one thing this image exists to show.
 */
export function FlagshipScene() {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    return openPaletteOnLastLine(host, () => {
      document.documentElement.setAttribute('data-flagship-ready', '1')
    })
  }, [])

  return (
    <div ref={hostRef} style={{ height: '100%' }}>
      <DesktopJournal
        {...journalProps(
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <div style={{ flex: 1, minHeight: 0 }}>
              <Editor
                docKey="flagship"
                initialDoc={FLAGSHIP_DOC}
                onChange={noop}
                placeholder="Title"
                autofocus={false}
                titleStyling
                slashEnabled
              />
            </div>
          </div>,
        )}
        /*
         * The header's own counter, told the truth.
         *
         * `journalProps` carries the archive fixture's 52 words, which is a
         * different entry entirely — and a status line that disagrees with the
         * page under it is the kind of detail that makes a marketing image feel
         * staged without anyone being able to say why.
         */
        words={FLAGSHIP_DOC.trim().split(/\s+/).length}
      />
    </div>
  )
}
