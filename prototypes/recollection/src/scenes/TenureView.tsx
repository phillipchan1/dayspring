import type { SceneId } from '../App'

/**
 * FACILITATOR SCREEN. Never shown on the screen share — it carries product
 * names, and the instant you name a door the reaction is to the name.
 *
 * The open question was framed as "is looking back a place you go or a thing
 * that arrives". That axis turns out not to be the load-bearing one. TENURE is:
 * how long a page exists, and whether it can pile up while she is not looking.
 *
 * The guilt problem lives entirely in the fourth row of that table. A weekly
 * page that is gone on Monday is a liturgy. The same page still sitting there
 * in March is a chore about somebody's prayer life, and no amount of gentle
 * copy fixes it.
 *
 *   THE RULE: no occasion may accrue.
 */

type Tenure = 'permanent' | 'occasional' | 'ephemeral'

type Row = {
  scene: SceneId
  key: string
  name: string
  on: string
  tenure: Tenure
  signal: string
  accrues: string
}

const ROWS: Row[] = [
  {
    scene: 'moment',
    key: 'm',
    name: 'moment',
    on: 'kinds that landed close together',
    tenure: 'permanent',
    signal: 'she marked all of them',
    accrues: 'no — nothing waits',
  },
  {
    scene: 'returning',
    key: 'g',
    name: 'returning',
    on: 'the same thing said again',
    tenure: 'permanent',
    signal: 'she marked all of them',
    accrues: 'no — nothing waits',
  },
  {
    scene: 'asked',
    key: 'q',
    name: 'what you asked',
    on: 'her own questions, by date',
    tenure: 'permanent',
    signal: 'she wrote the question mark',
    accrues: 'no — nothing waits',
  },
  {
    scene: 'words',
    key: 'v',
    name: 'the words you use',
    on: 'her vocabulary across two spans',
    tenure: 'permanent',
    signal: 'every word is hers',
    accrues: 'no — nothing waits',
  },
  {
    scene: 'episodes',
    key: '9',
    name: 'episodes',
    on: 'bursts bounded by silence',
    tenure: 'permanent',
    signal: 'arithmetic on her dates',
    accrues: 'no — nothing waits',
  },
  {
    scene: 'liturgy',
    key: 'l',
    name: 'liturgy',
    on: "the Examen's order, inside a horizon",
    tenure: 'occasional',
    signal: 'she marked all of them',
    accrues: 'ONLY ONE THAT COULD — it has a horizon',
  },
  {
    scene: 'around',
    key: 'o',
    name: 'around now',
    on: 'a date that came back',
    tenure: 'occasional',
    signal: 'the calendar, or her own dates',
    accrues: 'no — it expires, uncounted',
  },
  {
    scene: 'sitdown',
    key: '0',
    name: 'the sit-down',
    on: 'an occasion she chose',
    tenure: 'occasional',
    signal: 'she opened it',
    accrues: 'no — she brings the occasion',
  },
  {
    scene: 'comesto',
    key: 'c',
    name: 'comes to you',
    on: 'what she just wrote',
    tenure: 'ephemeral',
    signal: 'she marked it, just now',
    accrues: 'no — stored nowhere',
  },
  {
    scene: 'again',
    key: 'a',
    name: 'again',
    on: 'what it showed her six weeks ago',
    tenure: 'ephemeral',
    signal: 'she marked it, once',
    accrues: 'no — stored nowhere',
  },
  {
    scene: 'consolation',
    key: 'b',
    name: 'consolation',
    on: 'an absence, and the gift before it',
    tenure: 'ephemeral',
    signal: 'she declared both ends',
    accrues: 'no — stored nowhere',
  },
  {
    scene: 'word',
    key: 'w',
    name: 'the word',
    on: 'one line, and nothing else',
    tenure: 'ephemeral',
    signal: 'she marked it',
    accrues: 'no — stored nowhere',
  },
]

export function TenureView({ onGo }: { onGo?: (id: SceneId) => void }) {
  return (
    <div className="desk">
      <div className="notes ten">
        <div className="leaf leaf--flat">
          <p className="eyebrow">facilitator only — never on the screen share</p>
          <h1 className="title">Tenure</h1>
          <p className="lede">
            The question was <i>a place you go, or a thing that arrives</i>. The axis that actually
            decides things is how long a page exists, and whether it can pile up while she is not
            looking.
          </p>

          <table className="ten__table">
            <thead>
              <tr>
                <th>arrangement</th>
                <th>arranges on</th>
                <th>tenure</th>
                <th>who supplies the signal</th>
                <th>can it accrue?</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.scene} data-tenure={r.tenure}>
                  <th scope="row">
                    <button type="button" onClick={() => onGo?.(r.scene)}>
                      <kbd>{r.key}</kbd> {r.name}
                    </button>
                  </th>
                  <td>{r.on}</td>
                  <td>
                    <span className="ten__pill" data-tenure={r.tenure}>
                      {r.tenure}
                    </span>
                  </td>
                  <td>{r.signal}</td>
                  <td data-warn={r.accrues.startsWith('ONLY') ? 'true' : undefined}>{r.accrues}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="notes__h">The rule</h2>
          <p className="notes__p ten__rule">No occasion may accrue.</p>
          <p className="notes__p">
            A weekly page that is gone on Monday is a liturgy. The same page still sitting there in
            March is a chore about somebody's prayer life, and no amount of gentle copy fixes that —
            the fourth tenure, <b>pending</b>, is just the inbox with a nicer name. It is the one
            row that is not on this table, and it must never get one.
          </p>
          <p className="notes__p">
            <b>Permanent</b> pages can never make her late, because they hold still and grow. They
            also never arrive, which is `#comesto`'s whole argument against them: Judy looks back{' '}
            <b>twice a year</b>.
          </p>
          <p className="notes__p">
            <b>Occasional</b> is the only place a horizon is safe, and only while it expires. The
            liturgy is the one thing here with a week in it, which is why it is the one row carrying
            a warning.
          </p>
          <p className="notes__p">
            <b>Ephemeral</b> pages cannot be a backlog by construction — there is nowhere for them
            to queue. The cost is real: she cannot go back for one, and if she wanted it, it is
            gone.
          </p>

          <h2 className="notes__h">Where each one came from</h2>
          <ul className="notes__ul">
            <li>
              <b>w the word</b> — the desert. A monk asks an elder for a word and carries the answer
              for years. Not a shorter result: one sentence, and nothing else on the screen. Every
              other arrangement here is a list, which is software's instinct rather than the
              tradition's. <i>Falsified if</i> the first thing they do is hunt for more.
            </li>
            <li>
              <b>a again</b> — the Exercises repeat the same material rather than advancing, and
              lectio chews one line. Both assume you meet the same sentence again on purpose, and
              nothing else here re-serves anything. The earlier pick is derived by running{' '}
              <b>c comes to you</b>'s own rule at an earlier date, so the repeat is the app's actual
              behaviour and not a story about it. <i>Falsified if</i> "I have seen this" arrives as
              a complaint rather than as recognition.
            </li>
            <li>
              <b>b consolation</b> — Ignatius tells the person in desolation to remember that the
              consolation was real. That instruction is addressed to precisely the one person who
              cannot carry it out, and finding it by hand is the reread both interviews refuse.
              Both ends are declared: she marked the absence, she marked the gift.{' '}
              <b>Deliberately one-way</b> — Rule 10 runs the other direction too, and we are not
              building that; an app raising a shadow while she is glad is not the same act as a
              director doing it. <i>Falsified if</i> it reads as a consolation prize, which is
              counsel.
            </li>
            <li>
              <b>o around now</b> — the tradition schedules by a calendar that returns, not a review
              you owe. Three variants, because the argument is what the occasion belongs to. The
              seasons variant is the one to watch: it is opt-in because GUARDRAILS forbids assuming
              a practice, and it is blank most of the year, which is a property and not a bug.
            </li>
            <li>
              <b>v the words you use</b> — the growth question without an axis, and the only thing
              in the product that can contradict "I'm doing the same thing this year that I was last
              year" without rendering a verdict. Sanctioned by GUARDRAILS' own example. Watch the
              entry counts: an uneven comparison reads as a verdict on the thinner side.
            </li>
            <li>
              <b>q what you asked</b> — <b>an argument, not a recommendation.</b> The arithmetic is
              clean and the shape is the risk: a question with a last date invites the word
              "answered", which is right when she supplies it and forbidden when the app does. Ask
              directly whether the arrangement itself already says too much.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
