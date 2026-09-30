# Gather (internal)

Gate-first prayer harvest + tight emotion definitions. **Internal name only** — never a user-facing string, surface, or setting.

Picked lab variant (`lab/jev-classifier` @ `9566d4c`): `harvest=gate,gb=6,hb=3,chunk=4000,sent=tight+denial`. No logprob / threshold fitting. Subject tagging is unchanged.

Merging this is inert until the flags below are set. Defaults are today's production path.

## Flags

| Var | Default | Role |
|---|---|---|
| `GATHER_MODE` | unset → `cue` | `gate` skips `HARVEST_CUE` and runs `gatherHarvest` (6-wide gate, then 3-wide span). Anything else, including unknown values, is the cue prefilter + 6-wide `harvestBatch`. |
| `GATHER_SENTIMENT` | unset → `v2` | `tight-denial` swaps the Keeping-read emotion line for the 14 tight definitions + exclusion rule, and requires `denied` before `emotions` on each movement. Anything else is today's prompt and schema. |

The two flags are independent. Flip them separately.

`KEEPING_READ_VERSION` stays `movements-v2-seven-signals` on the flag-off path so stored reads stay comparable. The tight-denial path reports `movements-v2-tight-denial`.

## Rollout

1. Ship with both flags unset (this PR). Flag-off harvest and Keeping-read behavior is unchanged.
2. Score `gather` vs `luna` on `lab/gather-eval` (see that branch; not for merge).
3. Set `GATHER_MODE=gate` on a preview first. Gate reads every unscanned entry; cue-blind prayers that never reached the model will start to.
4. Set `GATHER_SENTIMENT=tight-denial` independently on preview. Stored Keeping reads will report the new version.
5. Production only after the eval and a preview pass. Do not enable either flag in production from this PR.

A failed span batch leaves that entry unmarked and writes no rows. `harvestPrayers` inserts without dedupe, so a partial write would duplicate on retry. Gate-negative entries are marked scanned with no rows.

## Cost

Cue mode bills a span pass (`altar_harvest`, batch 6, 2000 max tokens) only for cue-positive entries. Most ordinary prose never reaches the model.

Gate mode bills a cheap yes/no (`gather_gate`, batch 6, 600 max tokens, low effort) for **every** unscanned entry, then the existing span prompt on gate-positive chunks only, 3 per call. Fail-open: a thrown or unanswered gate still pays for the span pass on those chunks.

The cost increase is the gate calls on cue-negative entries. The return is recall on cue-blind prayers (the ceiling `HARVEST_CUE` cannot lift). Span log name stays `altar_harvest` so existing token greps still attribute the expensive pass.

## Glossary

- **Gather** — internal name for this gate-first harvest + tight-denial sentiment pair.
- **Cue** — `HARVEST_CUE` regex prefilter. Today's default.
- **Gate** — batched prayer/sense yes/no before span harvest.
- **Span harvest** — production `HARVEST_PROMPT` extraction (`harvestBatch`).
- **tight-denial** — 14 tight emotion definitions, plus a `denied` field the model fills before `emotions`.

## Eval + rescan (lab/gather-eval only — do not merge)

```bash
npm run eval:recognition -- --only=prayers --compare=gather,luna --split=test --json
npm run eval:recognition -- --only=sentiment --compare=gather,luna --split=test --json
```

`gather` is production `gatherHarvest` + keepingRead tight-denial. `luna` is production flag-off `harvestTexts` + keepingRead v2. Both need only `OPENAI_API_KEY`.

```bash
npx tsx scripts/gather-rescan.ts --owner=<uuid> --dry-run
npx tsx scripts/gather-rescan.ts --owner=<uuid> --max=50 --after=<entry-id-or-date> --apply
npx tsx scripts/gather-rescan.ts --owner=<uuid> --apply --downstream
```
