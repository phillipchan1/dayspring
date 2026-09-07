import { questionsIn } from '../lib'
import { Lines } from '../render'

/**
 * What he asked here.
 *
 * The filter is: does the line end in a question mark. That is a fact about
 * punctuation, in the same family as D-016's rule that deciding whose voice a
 * sentence is in is a judgment we do not get to make, but whether it ends is
 * not. No model runs. Nothing is interpreted.
 *
 * And it is the sharpest thing in the set, because an audit of a life conducted
 * entirely in the writer's own interrogatives is not something the app can be
 * accused of having authored.
 */
export function AskedView({ domain }: { domain: string }) {
  const questions = questionsIn(domain)

  return (
    <div className="paper">
      <div className="wrap wrap--narrow">
        <p className="eyebrow">what you asked here</p>
        <h1 className="title">{domain}</h1>
        <p className="lede">Every line you ended with a question mark, in the order you asked.</p>
        <Lines lines={questions} />
      </div>
    </div>
  )
}
