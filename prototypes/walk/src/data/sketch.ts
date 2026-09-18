/**
 * Everything a writer "wrote" here is invented. The practice name, the four
 * movement labels and their questions are read off the real
 * `src/editor/practices/practicesData.ts`, so the walk is Lectio's actual shape
 * rather than a drawn one.
 *
 * No real archive is loaded — a shape can be judged on invented words — so
 * unlike `prototypes/rituals` there is nothing here to gitignore, which matters
 * because `listed: false` only hides a prototype from the hub index. The URL is
 * still public.
 */

// ── The passage ────────────────────────────────────────────────────────────
// World English Bible (public domain), because this prototype deploys publicly.
// The live app fetches ESV through `api/spiritual/scripture-chapter.ts` — already
// wired, already licensed. Bring needs no new backend, only a new movement kind.

export const PASSAGE = {
  ref: 'Matthew 11:28–29',
  translation: 'WEB',
  /**
   * Split to words so Mark can be a touch rather than a text field. The real
   * surface would tokenise the fetched verse the same way; punctuation rides
   * along with its word so a tap never lands on a bare comma, and is stripped
   * back off before anything is recorded.
   */
  text:
    'Come to me, all you who labor and are heavily burdened, and I will give you rest. Take my yoke upon you and learn from me, for I am gentle and lowly in heart; and you will find rest for your souls.',
}

export const WORDS = PASSAGE.text.split(' ')

/** Punctuation must not end up in the record. "rest." is not a word. */
export const bare = (w: string) => w.replace(/[^\p{L}\p{N}’'-]/gu, '')

/**
 * Passages this writer has marked before — the second door on the Bring step.
 *
 * Grounded, not suggested: references their own entries already carry, which the
 * Scripture surface captures on save today. The app never proposes a reading
 * plan of its own — deciding what someone should read this morning is exactly
 * the spiritual direction Principle 6 declines to give.
 */
export const MARKED = [
  { ref: 'Psalm 62:5–8', when: 'marked in June' },
  { ref: 'Matthew 11:28–29', when: 'marked twice' },
  { ref: 'Lamentations 3:22–23', when: 'marked in March' },
]

/** What the writer prays at Oratio, for the record screen. */
export const PRAYER =
  'I have been carrying the rota thing and the invoice like they are mine to fix. I do not know how to hand them over. Teach me what gentle looks like when I am this tired.'
