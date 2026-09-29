# Recognition eval

```
recognition eval — DRY RUN, $0, no network
  corpus            515 entries (515 available, split=all)
  openai model      gpt-6-luna
  jev model         jev-1.13.0
  providers         openai, jev
  tau               0.8
  reruns            1
  cue prefilter     167/515 entries would reach the OpenAI harvest
  openai calls      prayers=28 entities=65 subjects=25 sentiment=385  TOTAL=503
  openai est. $     ~$0.553 (rough; live run uses token logs)
  jev calls         harvest=515 tag=150 sentiment=385 (one request per item)
  jev est. tokens   171307  (~$0.0072 at $0.042/1M in, out free)
  vocab (subjects)  19 labels + none_of_these  — gold + DESIGNED_THREADS.forms + sibling/virtue distractors

  scripture is deterministic and always free.
  Live: npm run eval:recognition -- --compare=openai,jev,cascade --tau=0.8 --split=test --json
```
