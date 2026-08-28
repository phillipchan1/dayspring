import { useState } from 'react'
import { KIND_META } from '../kinds'
import { Dawn, Evidence, Head, Lines, Movement, type LineItem } from '../parts'
import { read, spanById, THIN_FLOOR, type Reading, type Thread } from '../span'

/**
 * The artifact, whole. The main event.
 *
 * ── What this page is for, after the first version was wrong ────────────────
 *
 * The first build's central movement was a grid of her declared markings —
 * six chambers of `/pray`, `/sense`, `/desire`, `/story`, `/learned`,
 * `/scripture`. It was legal, it was grounded, it was pretty, and it was
 * REDUNDANT: a time-sliced Altar beside a time-sliced Lamp. Slicing an
 * existing surface by date is a filter, not a surface.
 *
 * The job that is actually unclaimed:
 *
 *   > EVERY OTHER RETURN SURFACE SHOWS YOU WHAT. NONE OF THEM DOES ANYTHING
 *   > WITH IT. THIS PAGE HELPS YOU ASK BETTER.
 *
 * That reframing does three things at once, which is how you can tell it is
 * the real thesis rather than a nicer description of the same object:
 *
 *   1. It kills the oracle by construction. A page whose output is a question
 *      has no answer in it to be wrong about.
 *   2. It stops being redundant. The contribution is no longer new data — the
 *      Altar already has the data — it is a new ACT performed on it.
 *   3. It threads H4. Counsel, diagnosis and prescription are all assertions.
 *      A question is none of the three.
 *
 * ── And the markings become input ───────────────────────────────────────────
 *
 * They are not displayed anywhere on this page. They corroborate her words —
 * see span.ts § wordsIn, including the stronger version that was built and
 * reverted. The Altar keeps its job.
 *
 * ── The arc ─────────────────────────────────────────────────────────────────
 *
 *   what you are still asking  →  and these  →  write
 *
 * Three movements. The first is her questions grouped by her own word with a
 * question from the tradition beneath. The second is every other question she
 * asked, with nothing beside them, because most of what someone asks reaches
 * nothing and pretending otherwise is the fortune cookie. The third is the
 * editor.
 *
 * ── What is still deliberately absent ───────────────────────────────────────
 *
 * No summary. No theme name (the theme is machinery — see span.ts § Thread).
 * No answer, ever, to any question on the page. Nothing comparing this span to
 * the last one.
 */
export function Arrives({ spanId = 'spring-2026' }: { spanId?: string }) {
  const reading = read(spanById(spanId))
  const [open, setOpen] = useState<{ id: string; word?: string } | null>(null)

  return (
    <div className="surface">
      <Dawn />
      <article className="sheet">
        <Head reading={reading} />

        {reading.thin ? (
          <ThinBody reading={reading} onOpen={(id) => setOpen({ id })} />
        ) : (
          <>
            <Asking reading={reading} onOpen={(id, word) => setOpen({ id, word })} />
            <Unmatched reading={reading} onOpen={(id) => setOpen({ id })} />
            <Onward reading={reading} />
          </>
        )}
      </article>

      {open ? <Evidence id={open.id} word={open.word} onClose={() => setOpen(null)} /> : null}
    </div>
  )
}

/**
 * The central movement: what she is still asking.
 *
 * Her word heads it, never the theme. Her questions follow, all of them. Then
 * one question from the tradition, with nothing between them.
 */
export function Asking({
  reading,
  onOpen,
}: {
  reading: Reading
  onOpen: (id: string, word: string) => void
}) {
  if (!reading.threads.length) return null
  return (
    <Movement
      title="what you are still asking"
      /*
       * The gloss states the floor, because a grouping whose rule is invisible
       * reads as the app having decided these belong together. It has not: they
       * share a word she wrote on more than one page, and that is all.
       *
       * The second sentence is the promise the surface has to keep. Say it once,
       * plainly, at the top — and then never answer anything.
       */
      gloss="Questions of yours that share a word you wrote on more than one of these pages. Nothing here has been answered, and nothing here will be."
    >
      {reading.threads.map((t) => (
        <ThreadBlock key={t.theme} thread={t} onOpen={onOpen} />
      ))}
    </Movement>
  )
}

function ThreadBlock({ thread, onOpen }: { thread: Thread; onOpen: (id: string, word: string) => void }) {
  const lead = thread.words[0].word
  const items: LineItem[] = thread.questions.map((q) => ({
    entryId: q.entryId,
    date: q.date,
    text: q.text,
    lit: thread.words.find((w) => new RegExp(`\\b${w.word}\\b`, 'i').test(q.text))?.word,
  }))

  /* Which kinds of marking her words also sit inside. Corroboration, not a list. */
  const declared = [...new Set(thread.words.flatMap((w) => w.declaredIn))]

  return (
    <div className="pin">
      <div className="pin__word">
        {thread.words.map((w) => w.word).join(' · ')}
        <span className="pin__count">
          {thread.questions.length} {thread.questions.length === 1 ? 'question' : 'questions'}
        </span>
      </div>

      {/*
        The native data, doing its work without being displayed. It says the
        word is not merely frequent — it also sits inside something she reached
        over and marked. The Altar shows the prayers; this only says there were
        some.
      */}
      {declared.length ? (
        <p className="corroborate">
          also inside what you marked · {declared.map((k) => KIND_META[k].label).join(' · ')}
        </p>
      ) : null}

      <div className="pin__hers">
        <Lines items={items} onOpen={(id) => onOpen(id, lead)} />
      </div>

      {thread.asked ? (
        <div className="passage">
          <p className="passage__text">{thread.asked.text}</p>
          <div className="passage__cite">
            <b>{thread.asked.who}</b>
            <span>{thread.asked.when}</span>
            <span>{thread.asked.where}</span>
            <span>{thread.asked.edition}</span>
          </div>
          {/*
            The addressee, and it is the whole defence rendered visible: this
            was asked of a room of monks, of an elder, of God — never of her.
            A question with no stated addressee starts to read as though it
            were addressed to whoever is holding the page.
          */}
          <p className="passage__askedof">asked of {thread.asked.askedOf}</p>
        </div>
      ) : (
        <p className="silent__note">The reading has no question for this. There is nothing here.</p>
      )}
    </div>
  )
}

/**
 * Every other question she asked, with nothing beside them.
 *
 * Most of what a person asks reaches nothing, and a page that found a
 * companion for all eight would be a fortune cookie. Showing them bare is
 * Principle 4's second half — grounded, OR SILENT — and it is also the only
 * thing on the page that keeps the matched ones honest: if every question got
 * a father, the fathers would mean nothing.
 *
 * All of them, date order, never sorted by whether they are still being asked.
 */
export function Unmatched({ reading, onOpen }: { reading: Reading; onOpen: (id: string) => void }) {
  const matched = new Set(reading.threads.flatMap((t) => t.questions.map((q) => q.entryId + q.text)))
  const rest = reading.questions.filter((q) => !matched.has(q.entryId + q.text))
  if (!rest.length) return null

  const items: LineItem[] = rest.map((q) => ({ entryId: q.entryId, date: q.date, text: q.text }))
  return (
    <Movement title="and these">
      <Lines items={items} onOpen={onOpen} />
      <p className="floor">
        Also yours, from these pages. The reading has nothing to set beside them, so nothing is set beside them.
      </p>
    </Movement>
  )
}

/**
 * The last movement, and the whole point of the page.
 *
 * A page that ends in a conclusion has told her what her season was. A page
 * that ends in the editor has handed her back her own material and got out of
 * the way. It is the only Return→Write path in the app.
 *
 * NOTE WHAT IS ABSENT: no share button, no image card, no link. Principle 1
 * says a screenshot of this must not be a scoreboard, and the surest way is
 * not to build the affordance that wants one. Export is for her.
 */
export function Onward({ reading }: { reading: Reading }) {
  return (
    <div className="onward">
      <div className="onward__row">
        <button type="button" className="onward__act">
          Take a question into a page
        </button>
        <button type="button" className="onward__act onward__act--quiet">
          Keep it as paper
        </button>
      </div>
      <p className="floor" style={{ marginBlockStart: 18 }}>
        {reading.entries.length} pages. Every question here is one you asked.
      </p>
    </div>
  )
}

/**
 * The thin span, and the most important screen nobody would build.
 *
 * ── It degrades into its own last movement, not into a different page ───────
 *
 * The first version showed the first paragraph of each entry, which was a
 * different object wearing the same header. This shows her QUESTIONS, bare —
 * which is exactly what `and these` is on the full page. The surface does not
 * become something else when the archive is thin; it becomes less of itself.
 *
 * That falls out of the thesis rather than being a nicety: gathering questions
 * needs no threshold, no recurrence and no corpus. Only the grouping does. So
 * the floor gates the threads and nothing else, and even three entries pay out
 * something real — Principle 5's own corollary, design for the dip.
 *
 * Principle 5: "we would rather show an empty state that tells the truth than
 * a manufactured insight that impresses." The threshold is printed, and the
 * page does NOT say she wrote less than usual, did not keep it up, or has been
 * away. Absence is not ours to interpret.
 *
 * It is deliberately the SAME OCCASION as the main page — spring and summer,
 * two years earlier — so the only thing differing is her archive.
 */
function ThinBody({ reading, onOpen }: { reading: Reading; onOpen: (id: string) => void }) {
  const questions: LineItem[] = reading.questions.map((q) => ({
    entryId: q.entryId,
    date: q.date,
    text: q.text,
  }))
  const pages: LineItem[] = reading.entries.map((e) => ({
    entryId: e.id,
    date: e.date,
    text: e.paragraphs[0],
  }))
  const has = questions.length > 0

  return (
    <>
      <Movement
        title={has ? 'what you asked' : 'what is here'}
        gloss={`There are fewer than ${THIN_FLOOR} pages here, so nothing is grouped and nothing is set beside anything.`}
      >
        <Lines items={has ? questions : pages} onOpen={onOpen} />
      </Movement>
      <Onward reading={reading} />
    </>
  )
}
