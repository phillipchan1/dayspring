/**
 * Notes for whoever is driving. Not part of the mock — press ? to get here.
 */
export function Facilitator() {
  return (
    <div className="quiet">
      <div className="wrap wrap--narrow">
        <p className="eyebrow">facilitator</p>
        <h1 className="title">Domains</h1>

        <div className="notes">
          <p>
            Phil already does this by hand: a Saturday reflection with{' '}
            <code>## personal</code>, <code>## faith</code>, <code>## frontier</code>,{' '}
            <code>## sce</code>, <code>## family</code> as headings, so he can look at the key
            areas of his life. The whole feature is: <strong>notice the heading</strong>. Nothing is
            tagged, nothing is filed, and the app never asks.
          </p>

          <h3>The design law</h3>
          <ol>
            <li>
              <strong>There is no way to create a domain.</strong> One exists because someone typed
              a heading and wrote under it. No New Domain button appears in any scene, and{' '}
              <code>lib.ts</code> has no function that could add one. This is what keeps it from
              becoming the tag manager SURFACES.md forbids.
            </li>
            <li>
              <strong>Never ordered by count.</strong> The sit-down goes by last written; the house
              goes by first opened. Ranking domains by frequency is the app ranking what matters in
              a person's life.
            </li>
            <li>
              <strong>Every line, always.</strong> The domain view has no limit. Showing the best
              eight of forty is a selection, and selection is significance, and significance is a
              verdict.
            </li>
            <li>
              <strong>The model points, never pronounces.</strong> It may choose which of your own
              sentences to put in front of you. It may never write a sentence about you.
            </li>
          </ol>

          <h3>What each scene is testing</h3>
          <ul>
            <li>
              <strong>1 heading</strong> — does the completion feel like help or like a form? Type
              something that is not in the list; it should be completely unremarkable.
            </li>
            <li>
              <strong>2 continue</strong> — does your own last sentence turn a blank page into a
              continuation, or does it feel like being handed homework?
            </li>
            <li>
              <strong>3 rounds</strong> — <code>personal</code> is at the bottom because it was last
              written in May 2025. Nothing says so. Does the order alone land, or does it need a
              word we are not allowed to write?
            </li>
            <li>
              <strong>4 domain</strong> — four years of <code>frontier</code> in time. Watch for the
              urge to summarise it. That urge is the product.
            </li>
            <li>
              <strong>5 asked</strong> — the same domain, filtered to lines ending in a question
              mark. No model. Is this the strongest thing here?
            </li>
            <li>
              <strong>6 house</strong> — the anti-dashboard. <em>someone else</em> proves we ship no
              list. <em>scoreboard</em> is the same data done the obvious way; the "Needs attention"
              line is not a straw man, it is what every competitor ships.
            </li>
            <li>
              <strong>7 rhyme</strong> — the only AI in the set, and the refusal beneath it.
            </li>
          </ul>

          <h3>What would falsify it</h3>
          <ul>
            <li>
              They ask for colours, nesting, or a way to rename a domain everywhere at once — that
              is D-016's own kill condition firing, and it means we built a filing system.
            </li>
            <li>
              They want forty of them. Four or five is a life; forty is PKM, which VISION rules out.
            </li>
            <li>
              They start writing to the headings instead of writing. If the Saturday scaffold makes
              the journal feel like a form to fill in, scene 3 is the one to cut.
            </li>
            <li>
              Nobody's imported history has headings in it. Then this pays nothing until year three,
              and Principle 5 says do not fake it early.
            </li>
          </ul>

          <h3>Keys</h3>
          <p>
            <code>1</code>–<code>7</code> jump between scenes · <code>S</code> hides the scene bar
            for a screen-share · <code>?</code> comes back here.
          </p>

          <p className="stamp" style={{ marginTop: '2rem' }}>
            fictional journal · invented people · the domains are Phil's
          </p>
        </div>
      </div>
    </div>
  )
}
