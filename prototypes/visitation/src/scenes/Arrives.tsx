import { useState } from 'react'
import { KIND_META } from '../kinds'
import { Dawn, Evidence, Head, Lines, Movement, type LineItem } from '../parts'
import { daysSince, read, spanById, THIN_FLOOR, type Chamber, type Reading } from '../span'

/**
 * The artifact, whole, top to bottom. The main event.
 *
 * ── The arc, and why it ends where it ends ──────────────────────────────────
 *
 *   what you set apart  →  the words you kept saying  →  what was said
 *   beside them  →  what you asked  →  write
 *
 * The last movement is the point of the other four. Phil's own framing was
 * "not to be an oracle but to funnel and fuel prayer" — and the structural way
 * to guarantee that is to make the TERMINAL ACT OF THE PAGE BE HER WRITING,
 * not her reading a conclusion. A report that ends in a summary has told her
 * what her season was. A report that ends in a blank page has handed her back
 * her own material and got out of the way.
 *
 * The questions sit immediately before it on purpose: they are the only
 * movement that is already addressed to somebody.
 *
 * ── What is deliberately not here ───────────────────────────────────────────
 *
 * No summary paragraph. No "this season you…". No theme, no title, no arc, no
 * throughline. Every one of those is the app writing a sentence about her,
 * which H1 and H2 forbid and which D-016 already settled: the writer supplies
 * the signal.
 *
 * Nothing compares this span to the last one. Not entry counts, not marking
 * counts, not words. A delta at the top of a recurring page is a streak
 * counter wearing vestments, and Principle 2 does not care what it is wearing.
 */
export function Arrives({ spanId = 'summer-2026' }: { spanId?: string }) {
  const reading = read(spanById(spanId))
  const [open, setOpen] = useState<{ id: string; word?: string } | null>(null)
  const [word, setWord] = useState<string | null>(null)

  return (
    <div className="surface">
      <Dawn />
      <article className="sheet">
        <Head reading={reading} />

        {reading.thin ? (
          <ThinBody reading={reading} onOpen={(id) => setOpen({ id })} />
        ) : (
          <>
            <Heart reading={reading} onOpen={(id) => setOpen({ id })} />
            <Words reading={reading} chosen={word} onChoose={setWord} />
            <Beside reading={reading} chosen={word} onOpen={(id, w) => setOpen({ id, word: w })} />
            <Asked reading={reading} onOpen={(id) => setOpen({ id })} />
            <Onward reading={reading} />
          </>
        )}
      </article>

      {open ? <Evidence id={open.id} word={open.word} onClose={() => setOpen(null)} /> : null}
    </div>
  )
}

/**
 * The heart — six chambers, one per declared kind.
 *
 * Everything in it is an act she named with her own hand while writing. There
 * is no sentiment in here, no tone, nothing derived: `/pray`, `/desire`,
 * `/sense`, `/story`, `/learned`, `/scripture`. That is the whole legal
 * content of "the things in your heart", and it is a stronger thing than the
 * inferred version would have been, because she cannot dispute it.
 *
 * Same size for every chamber; the count is printed; brightness is recency.
 * See styles.css § .chamber for why each of those is load-bearing.
 */
export function Heart({ reading, onOpen }: { reading: Reading; onOpen: (id: string) => void }) {
  return (
    <Movement
      title="what you set apart"
      /*
       * The second sentence is not decoration. An unexplained visual encoding
       * is exactly what a reader fills in with a verdict — a pale panel beside
       * a bright one reads as "less" until something says otherwise. Saying
       * what the light means costs one clause and removes the only reading of
       * this grid that Principle 1 forbids.
       */
      gloss="Every line here is one you marked while you were writing. Nothing was chosen for you. How lit a panel is means how lately — nothing more."
    >
      <div className="heart">
        {reading.chambers.map((c) => (
          <ChamberCell key={c.kind} chamber={c} reading={reading} onOpen={onOpen} />
        ))}
      </div>
    </Movement>
  )
}

/**
 * One chamber.
 *
 * The quote shown is THE MOST RECENT of that kind in the span. Recency is
 * arithmetic; "the best one" would be selection, and selection is significance,
 * and significance is a verdict (D-016). It also means the chamber and its
 * warmth agree: the line you see is the line the brightness is about.
 */
function ChamberCell({
  chamber,
  reading,
  onOpen,
}: {
  chamber: Chamber
  reading: Reading
  onOpen: (id: string) => void
}) {
  const meta = KIND_META[chamber.kind]
  const latest = chamber.markings[chamber.markings.length - 1]
  const since = daysSince(reading.span, chamber.kind)

  /*
   * Recency → light. 0.16 at today, floor 0.03 at a season out.
   * A floor rather than zero, because an unlit chamber would read as a hole,
   * and a hole reads as a failing.
   */
  const warmth = since === null ? 0.02 : Math.max(0.03, 0.16 - (since / 90) * 0.13)

  return (
    <button
      type="button"
      className="chamber"
      style={
        {
          '--tone': `var(--k-${meta.tone})`,
          '--warmth': warmth,
        } as React.CSSProperties
      }
      onClick={() => latest && onOpen(latest.entryId)}
      disabled={!latest}
    >
      <span className="chamber__label">
        <span className="chamber__dot" />
        {meta.label}
        <span className="chamber__count">
          {chamber.markings.length === 0 ? '—' : chamber.markings.length}
        </span>
      </span>
      {latest ? (
        <p className="chamber__quote">{latest.quote}</p>
      ) : (
        /* Nothing, said as nothing. Never "you didn't…". H2: absence is not ours to interpret. */
        <span className="chamber__empty">Nothing this season.</span>
      )}
    </button>
  )
}

/**
 * The words she kept saying.
 *
 * GUARDRAILS' own sanctioned form — *"'Angry' appears in 7 entries this
 * month"* — and the only legal cousin of the sentiment reading Phil described.
 * The floor is on screen; the order is first appearance; no number sits beside
 * any word; nothing is sorted into good and bad.
 *
 * Choosing one lights it inside her own sentences below. The word is the
 * explanation, which is the answer D-020 left open: *why did this come back?*
 */
export function Words({
  reading,
  chosen,
  onChoose,
}: {
  reading: Reading
  chosen: string | null
  onChoose: (w: string | null) => void
}) {
  return (
    <Movement title="the words you kept saying">
      <div className="words">
        {reading.words.map((w) => (
          <button
            key={w.word}
            type="button"
            className="word"
            data-on={chosen === w.word ? 'true' : undefined}
            onClick={() => onChoose(chosen === w.word ? null : w.word)}
          >
            {w.word}
          </button>
        ))}
      </div>
      <p className="floor">Words you wrote in more than one of these pages, in the order you first wrote them.</p>
    </Movement>
  )
}

/**
 * The council.
 *
 * Her word, her lines carrying it, and then a passage — with nothing between
 * them. No bridge sentence, no application, no "this may speak to your
 * season." See fathers.ts for the doctrine and the three-hop join.
 *
 * Only the first pin renders on the artifact. A council of eight is a reading
 * list, and a reading list is an assignment (H4). One voice, sometimes two.
 */
export function Beside({
  reading,
  chosen,
  onOpen,
}: {
  reading: Reading
  chosen: string | null
  onOpen: (id: string, word: string) => void
}) {
  const pins = chosen ? reading.council.filter((p) => p.word === chosen) : reading.council.slice(0, 1)
  if (!pins.length) {
    /*
     * The chosen word reached nothing, and the page says so rather than
     * reaching one shelf over. Principle 4 is called "grounded, OR SILENT".
     */
    return (
      <Movement title="beside them">
        <p className="silent__note">Nothing in the reading answers to “{chosen}”.</p>
      </Movement>
    )
  }

  return (
    <Movement title="beside them">
      {pins.map((pin) => {
        const passage = pin.passages[0]
        const items: LineItem[] = pin.entryIds.map((id) => {
          const entry = reading.entries.find((e) => e.id === id)
          const para = entry?.paragraphs.find((p) => new RegExp(`\\b${pin.word}\\b`, 'i').test(p))
          return { entryId: id, date: entry?.date ?? '', text: para ?? '', lit: pin.word }
        })

        return (
          <div className="pin" key={pin.word}>
            <div className="pin__word">
              {pin.word}
              <span className="pin__count">
                {pin.entryIds.length} {pin.entryIds.length === 1 ? 'page' : 'pages'}
              </span>
            </div>

            <div className="pin__hers">
              <Lines items={items} onOpen={(id) => onOpen(id, pin.word)} />
            </div>

            {/* Nothing between them. Not one word of ours. */}
            <div className="passage">
              <p className="passage__text">{passage.text}</p>
              <div className="passage__cite">
                <b>{passage.who}</b>
                <span>{passage.when}</span>
                <span>{passage.where}</span>
                <span>{passage.edition}</span>
              </div>
            </div>
          </div>
        )
      })}
    </Movement>
  )
}

/**
 * What she asked.
 *
 * Every line in the span ending in a question mark. All of them, date order,
 * never grouped by whether they are still being asked and never a word on
 * screen suggesting any was answered — a reader supplies that, and it is
 * theirs to supply (H2, and RECALL flags this arrangement as the one to argue
 * about on a call).
 *
 * This is also the movement that most directly does the job Phil named: it is
 * the only one already addressed to somebody.
 */
export function Asked({ reading, onOpen }: { reading: Reading; onOpen: (id: string) => void }) {
  const items: LineItem[] = reading.questions.map((q) => ({
    entryId: q.entryId,
    date: q.date,
    text: q.text,
  }))
  if (!items.length) return null
  return (
    <Movement title="what you asked">
      <Lines items={items} onOpen={onOpen} />
    </Movement>
  )
}

/**
 * The last movement, and the whole point of the page.
 *
 * Two acts, and the order matters: writing first, keeping second. A page whose
 * primary act is "save as PDF" is a collectible; a page whose primary act is
 * "write" is a prompt to pray, which is what this was supposed to be.
 *
 * NOTE WHAT IS ABSENT: no share button, no image card, no link. Principle 1
 * says a screenshot of this must not be a scoreboard, and the surest way is to
 * not build the affordance that wants one. Export is for her.
 */
export function Onward({ reading }: { reading: Reading }) {
  return (
    <div className="onward">
      <div className="onward__row">
        <button type="button" className="onward__act">
          Take this into a page
        </button>
        <button type="button" className="onward__act onward__act--quiet">
          Keep it as paper
        </button>
      </div>
      <p className="floor" style={{ marginBlockStart: 18 }}>
        {reading.entries.length} pages, {reading.span.from.slice(0, 4)}. Everything here is something you wrote.
      </p>
    </div>
  )
}

/**
 * The thin span, and the most important screen nobody would build.
 *
 * Principle 5: "we would rather show an empty state that tells the truth than
 * a manufactured insight that impresses." The threshold is printed, the
 * arrangement stops, and the page does NOT say she wrote less than usual, did
 * not keep it up, or has been away. Absence is not ours to interpret.
 *
 * What it still does: hands back the pages themselves. That costs no model, no
 * threshold and no synthesis, so even the thinnest occasion pays out something
 * real — which is Principle 5's own corollary, design for the dip.
 */
function ThinBody({ reading, onOpen }: { reading: Reading; onOpen: (id: string) => void }) {
  const items: LineItem[] = reading.entries.map((e) => ({
    entryId: e.id,
    date: e.date,
    text: e.paragraphs[0],
  }))
  return (
    <>
      <Movement
        title="what is here"
        gloss={`These are the pages. There are fewer than ${THIN_FLOOR} of them, so the rest of this page has nothing to stand on and is not here.`}
      >
        <Lines items={items} onOpen={onOpen} />
      </Movement>
      <Onward reading={reading} />
    </>
  )
}
