# Jev classifier lab

Lab-only comparison of TypeSafe Jev (`jev-1.13.0`) against the current OpenAI
path (`gpt-6-luna` via `callModel`) on the **synthetic** recognition corpus.
Nothing here is wired into `processing.ts`, `harvestPrayers`, `tagSubjects`, or
`api/keeping/read.ts`. Production `CLASSIFIER_PROVIDER` defaults to `openai`
and is unread by those paths.

**Do not send real journal text to TypeSafe.** This harness reads the committed
synthetic corpus only. Do not run `scripts/ab-model.ts` (it loads a real
account).

## Commands

Dry run (no keys, no network) — estimates calls, tokens, and $:

```bash
npm run eval:recognition -- --dry --compare
```

`--compare` with no value means `openai,jev`.

Live side-by-side (needs `OPENAI_API_KEY` and `TYPESAFE_API_KEY` in `.env`):

```bash
npm run eval:recognition -- --compare=openai,jev,cascade --tau=0.6,0.7,0.8,0.9 --split=dev --reruns=3 --json
```

Frozen test split after τ is chosen on dev:

```bash
npm run eval:recognition -- --compare=openai,jev,cascade --tau=0.8 --split=test --reruns=5 --json
```

Single provider:

```bash
npm run eval:recognition -- --provider=jev --split=test --only=prayers
npm run eval:recognition -- --provider=openai --model=gpt-5.4-nano --only=prayers
```

Jev-only (no OpenAI key). Thread formation is skipped; subject assignment still scores:

```bash
npm run eval:recognition -- --provider=jev --split=dev --reruns=1 --json
```

Quick stratified sample (round-robin across corpus categories):

```bash
npm run eval:recognition -- --provider=jev --limit=24 --reruns=1 --json
```

Every run writes `eval-results/recognition-eval.md` and
`eval-results/recognition-eval.json`. Both report the **mean** across `--reruns`
(JSON also keeps `reruns[]` per pass). `--json` also prints the JSON to stdout.
`$ /1k` and `$ /2k` are **per corpus pass**, not the accumulated rerun total.
The process exits 0 on model variance (same as before). Missing keys exit 1
(`--provider=jev` needs `TYPESAFE_API_KEY` only).

`--provider=jev` without `OPENAI_API_KEY` logs
`thread formation skipped — OPENAI_API_KEY absent (groupTagged embeddings). Subject assignment still scored.`
`groupTagged` also accepts an injected `embed` so tests can form threads without a key.

Harvest chunks by estimated tokens (target ≤ 20k, cap 80 sentences) so long
entries stay under Jev's 64k request limit. Failures are counted and printed
with their HTTP status / code (`max_tokens_exceeded`, etc.).

Sentiment buckets valence on the **argmax rubric level** (0–1 negative, 2 mixed,
3–4 positive). The weighted-average expected value stays in `valence` /
`valenceExpected` for MAE. Cascade confidence is the argmax probability.

## Arms

| Arm | Provider | Notes |
|---|---|---|
| A | `openai` | Current path. Prayer harvest still goes through `HARVEST_CUE` then `harvestTexts`. Sentiment uses a lab-only `openaiSentiment` seam (not Keeping read). |
| A′ | `--model=gpt-5.4-nano` | Optional history. |
| B | `jev` | Pure `jev-1.13.0`. Harvests every entry (no cue). |
| C | `cascade` | Jev first; OpenAI on low confidence, `none_of_these`, or error. Sweep `--tau=`. |

## Subject vocabulary (eval only)

`evalSubjectVocabulary` is **gold labels + `DESIGNED_THREADS.forms` + sibling/virtue distractors**
(`money`/`finances`, `purity`/`porn`/`sexual temptation`, Grace/Joy/Hope as people, ASK words).
Jev assigns a line to that closed list or `none_of_these`. Returning `none_of_these` escalates
in cascade mode. This is not a production subject list.

## Gold set

~370 new synthetic entries in `src/lib/recognition/corpus/{sentiment,prayers-hard,subjects-hard,adversarial}.ts`
plus the original ~127. Drafted for coverage (cue-blind prayers, hard negatives, mixed emotion,
injection, long context, mixed language, typos). **Not human-adjudicated.** Phil should review
before pinning τ. Split is a hash of the entry id (60/40 dev/test); tune only on `--split=dev`.

## Docs vs brief

Verified against https://docs.typesafe.ai/api.md and the JS SDK 0.6.0 types (2026-09-29):

- Request is `POST /v1/systemone` with `{ model, state, questions }`. Response is
  `{ model, answers, usage: { input_tokens, output_tokens } }`. Matches the brief.
- **RetryPolicy field is `maxRetries`**, not `maxAttempts`. The client uses
  `maxRetries: 3` (four attempts total).
- Noul answers have **no `confidence` field** (only `noul`). Choice/Score have
  `confidence`. Cascade treats `max(noul, 1−noul)` as certainty for Noul.
- SDK default model is `jev-latest`; we pin `jev-1.13.0` via `TYPESAFE_MODEL`.
- There is no remote `main` on this repo — the branch was cut from `master`
  at `89a4a4a` (the SHA the research named as `main`).

## Chosen τ / recommendation

No live keys were available in the lab environment, so τ is **not chosen**.
Sweep on `--split=dev` first. Proposed ship rule (from the research brief):

- F1 ≥ baseline − 2 pts
- p95 latency ≤ ½ baseline
- cost/1k ≤ ½ baseline
- rerun flip-rate ≤ baseline
- injection cases no worse than baseline
- Prefer cascade when pure Jev misses F1 but recovers it at ≤30% escalation

Production rollout still needs privacy / subprocessor sign-off. TypeSafe ZDR
is enterprise-only.

## Out of scope

Wiring Jev into import processing. That is a follow-up behind
`CLASSIFIER_PROVIDER` after the A/B and the privacy review.
