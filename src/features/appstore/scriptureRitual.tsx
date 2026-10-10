/**
 * Shot 04 — a scripture ritual mid-walk, as a phone shows it: the real
 * `RitualComposer` over a Lectio Divina page whose passage is chosen and whose
 * Meditatio has a phrase drawn out of it and a line written.
 *
 * Built the way `?__preview=ritual` builds its page (`buildPracticeBlock`, then
 * the passage fence in the first movement), so the document is the stored
 * format, not an imitation of it.
 */

import { useState } from 'react'
import { Editor } from '@/editor/Editor'
import { RitualComposer, type AnswerSlot } from '@/editor/practices/RitualComposer'
import { PRACTICE_BY_NAME, resolveMovements } from '@/editor/practices/practicesData'
import { parseReferenceLine, versesIn, writePassage } from '@/editor/practices/passage'
import { fixtureChapter } from '@/editor/practices/passageFixtures'
import { buildPracticeBlock } from '@/editor/practices/usePracticeInsertion'
import { RITUAL_MEDITATIO, RITUAL_PASSAGE } from './mock'

const noop = () => {}

function lectioDoc(): string {
  const lectio = PRACTICE_BY_NAME.get('Lectio Divina')!
  let block = buildPracticeBlock(lectio, '', 0, resolveMovements(lectio, [])).text
  const ref = parseReferenceLine(RITUAL_PASSAGE)!
  const fence = writePassage(
    ref,
    versesIn(ref, fixtureChapter(`${ref.book} ${ref.chapter}`)),
    '6c2e3d4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
  )
  block = block.replace(/(<!-- ritual:section:[^\n]*-->\n)/, `$1${fence}\n`)
  return block.replace(/(<!-- ritual:section:Meditatio[^\n]*-->\n)/, `$1${RITUAL_MEDITATIO}\n`)
}

/** An answer's editor, as JournalScreen supplies it: drawn quotes on. */
function answer(slot: AnswerSlot) {
  return (
    <Editor
      key={slot.key}
      ref={(handle) => slot.register(handle)}
      docKey={`listing-answer-${slot.key}`}
      initialDoc={slot.value}
      onChange={slot.onChange}
      placeholder={slot.placeholder}
      autofocus={false}
      titleStyling={false}
      drawnQuotes={slot.quotes ?? false}
    />
  )
}

export function ScriptureRitual() {
  const [doc, setDoc] = useState(lectioDoc)
  return (
    <div style={{ height: '100dvh', background: 'var(--bg)' }}>
      <RitualComposer
        blockIndex={0}
        getDoc={() => doc}
        replaceRange={(from, to, text) => setDoc((d) => d.slice(0, from) + text + d.slice(to))}
        onAbout={noop}
        onClose={noop}
        // One entry, one ritual — and open on Meditatio, the movement written in.
        entry={{ backTo: 'your journal', backShort: 'Journal', onDelete: noop, startAt: 1 }}
        renderAnswer={answer}
      />
    </div>
  )
}
