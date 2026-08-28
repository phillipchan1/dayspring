import { useState } from 'react'
import { unverifiedCount, type Pin } from '../fathers'
import { Dawn, Evidence, Lines, Movement, Rig, type LineItem } from '../parts'
import { read, spanById, type Reading } from '../span'

/**
 * The council — every pin the span reaches, and the sentence we may not write.
 *
 * ── What is on trial here ───────────────────────────────────────────────────
 *
 * Not whether the passages are good. Whether SETTING ONE BESIDE HER WRITING is
 * the app speaking. The claim is that it is not, and the claim rests on three
 * things that are all visible on this screen:
 *
 *   1. THE PIN IS HER WORD. Always shown, always first, always with the count
 *      of her own pages carrying it. If the pin is wrong she can see it is
 *      wrong, which is a thing no model-selected passage ever offers.
 *   2. NOTHING SITS BETWEEN THEM. `with a bridge` shows the forbidden sentence
 *      struck through — the H4 violation is a single sentence long, and it is
 *      the one every product in this category writes without noticing.
 *   3. SILENCE IS A RESULT. A word that reaches nothing gets nothing, rather
 *      than the nearest shelf.
 *
 * ── Not a séance ────────────────────────────────────────────────────────────
 *
 * Phil's own guardrail, and it is the right one: we do not pretend to be them.
 * Nobody here is given a voice, an avatar, a persona, or a second-person
 * address. There is no "Augustine says to you". There is a passage, a name, a
 * date, a book, and a translator — the apparatus of a quotation, which is
 * exactly what keeps it a quotation.
 *
 * H1 is the reason this matters more than it looks: the product may never
 * speak in the divine voice, and a fabricated saint counselling a reader in
 * the second person is the same failure at one remove.
 */
export function CouncilScene() {
  const reading = read(spanById('year-2026'))
  const [bridge, setBridge] = useState(false)
  const [open, setOpen] = useState<{ id: string; word: string } | null>(null)

  return (
    <div className="surface">
      <Dawn />

      <Rig label="between them">
        <button type="button" data-on={!bridge ? 'true' : undefined} onClick={() => setBridge(false)}>
          nothing
        </button>
        <button type="button" data-on={bridge ? 'true' : undefined} onClick={() => setBridge(true)}>
          a bridge
        </button>
      </Rig>

      <article className="sheet">
        <Movement
          title="beside them"
          gloss="Each passage is here because of a word you wrote. The word is on the page, so you can see whether it belongs."
        >
          {reading.council.map((pin) => (
            <PinBlock
              key={pin.word}
              pin={pin}
              reading={reading}
              bridge={bridge}
              onOpen={(id) => setOpen({ id, word: pin.word })}
            />
          ))}

          <Silence reading={reading} />
        </Movement>

        {/*
          Facilitator-only, and it does not appear on the artifact. A shipped
          corpus with an unverified row is a P0 — the row refuses to render.
        */}
        <p className="passage__unverified" style={{ marginBlockStart: 40 }}>
          {unverifiedCount()} of {unverifiedCount()} passages in this fixture are unchecked against a printed
          source. Not one line here would ship.
        </p>
      </article>

      {open ? <Evidence id={open.id} word={open.word} onClose={() => setOpen(null)} /> : null}
    </div>
  )
}

/**
 * One pin: her word, her lines, then the passage.
 *
 * All of her lines carrying the word, never a selection of them — a line view
 * that shows the best eight of forty has made a judgment, and the count on the
 * header has to equal the lines below it (RECALL, and D-016 behind it).
 */
function PinBlock({
  pin,
  reading,
  bridge,
  onOpen,
}: {
  pin: Pin
  reading: Reading
  bridge: boolean
  onOpen: (id: string) => void
}) {
  const passage = pin.passages[0]
  const re = new RegExp(`\\b${pin.word}\\b`, 'i')
  const items: LineItem[] = pin.entryIds.flatMap((id) => {
    const entry = reading.entries.find((e) => e.id === id)
    if (!entry) return []
    return entry.paragraphs
      .filter((p) => re.test(p))
      .map((p) => ({ entryId: id, date: entry.date, text: p, lit: pin.word }))
  })

  return (
    <div className="pin">
      <div className="pin__word">
        {pin.word}
        <span className="pin__count">
          {pin.entryIds.length} {pin.entryIds.length === 1 ? 'page' : 'pages'}
        </span>
      </div>

      <div className="pin__hers">
        <Lines items={items} onOpen={onOpen} />
      </div>

      <div className="passage">
        <p className="passage__text">{passage.text}</p>
        <div className="passage__cite">
          <b>{passage.who}</b>
          <span>{passage.when}</span>
          <span>{passage.where}</span>
          <span>{passage.edition}</span>
        </div>
      </div>

      {bridge ? <Bridge word={pin.word} /> : null}
    </div>
  )
}

/**
 * The sentence we may not write, written, struck through.
 *
 * It is worth seeing how small the violation is. One sentence, warm, helpful,
 * the kind any product manager would wave through — and it converts the whole
 * arrangement from a quotation into counsel, because it tells her what her own
 * words mean and what the passage is for.
 *
 * H4: "Dayspring is not a spiritual director, therapist, or pastor. It does
 * not tell users what to do, what to read, how to pray, or what their pattern
 * means about them."
 *
 * Note that the bridge is also the only sentence on the whole surface that
 * COULD NOT BE TRACED TO A ROW. Everything else here is either hers or a
 * cited passage. Principle 4's test — "for any sentence the app shows about
 * the user, can we name the row it came from?" — fails on exactly this line
 * and nothing else.
 */
const BRIDGES: Record<string, string> = {
  keep: 'You have been holding on through a long stretch — this may be the encouragement you need right now.',
  still: 'There is a stillness running through your year. Perhaps God is inviting you to rest in it.',
  want: 'Your longings point somewhere. Augustine knew this restlessness, and so do you.',
  remember: 'Remembering has been heavy for you this season. Let this be a comfort as you carry it.',
}

function Bridge({ word }: { word: string }) {
  return (
    <p className="bridge">
      {BRIDGES[word] ?? 'This may be speaking to where you are right now.'}
      <span className="bridge__why">
        H4 — counsel. It tells her what her own words mean and what the passage is for. It is also the only
        sentence on this page that traces to no row.
      </span>
    </p>
  )
}

/**
 * The words that reached nothing.
 *
 * Principle 4 is called "grounded, or silent" and the second half is the half
 * everybody drops. `maybe` is one of the loudest words in her year — "Maybe
 * the new thing is not a change in circumstance", "I said maybe, which was a
 * coward's answer" — and the reading has nothing to set beside it.
 *
 * Leaving it bare is the feature working. The alternative, reaching one shelf
 * over for something adjacent, is how every quotation engine ever built
 * became a fortune cookie.
 */
function Silence({ reading }: { reading: Reading }) {
  const bare = reading.unreached.slice(0, 6)
  if (!bare.length) return null
  return (
    <div className="silent">
      <div className="pin__word" style={{ opacity: 0.8 }}>
        {bare.map((w) => w.word).join(' · ')}
      </div>
      <p className="silent__note">
        Words you wrote in more than one page this year. The reading has nothing to set beside them, so nothing
        is set beside them.
      </p>
    </div>
  )
}
