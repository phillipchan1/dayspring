# AI Gateway ZDR (server-side, flag off by default)

Routes Dayspring's **text, vision, and embedding** OpenAI calls through
[Vercel AI Gateway](https://vercel.com/docs/ai-gateway) with per-request
`zeroDataRetention: true`. Audio transcription and realtime live captions are
intentionally unchanged — no ZDR provider exists for those models.

Merging this is inert until `AI_GATEWAY_ZDR` is set to `on` or `true`.

## Prerequisite: paid AI Gateway credits

Do **not** flip `AI_GATEWAY_ZDR` on until the team has **paid** AI Gateway
credits. On free-tier credits, `gpt-6-luna` and `text-embedding-3-small`
return HTTP 403 `RestrictedModelsError`. Fail-closed means those features
break — there is no fallback to `api.openai.com`.

## Env vars

| Var | Default | Role |
|---|---|---|
| `AI_GATEWAY_ZDR` | unset (off) | `on` / `true` enables the gateway. Anything else is today's direct OpenAI path. |
| `AI_GATEWAY_ZDR_PROVIDERS` | `azure` | Comma list passed as `providerOptions.gateway.only`. `azure,openai` is valid. Embeddings are ZDR only on Azure. |
| `AI_GATEWAY_API_KEY` | unset | Optional override for local / synthetic tests. Production should use OIDC (`getVercelOidcToken`). |
| `ZDR_SELFTEST_TOKEN` | unset | Protects `GET /api/zdr-selftest`. Unset → the route 404s. |

`OPENAI_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_EMBED_MODEL` still apply. When the
flag is on they are prefixed (`gpt-6-luna` → `openai/gpt-6-luna`).

Keep `AI_GATEWAY_ZDR_PROVIDERS` pinned (default `azure`). A live probe without
a pin showed the gateway preferring `openai` over `azure`. OpenAI's listing is
"ZDR with safety retention"; embeddings are ZDR only on Azure.

`max_completion_tokens` must be ≥ 16 through the gateway. `callModel` clamps
to 16 on the gateway path only; today's callers already send 512+.

## Self-test (preview)

Set `ZDR_SELFTEST_TOKEN` on the preview (or pass `AI_GATEWAY_API_KEY` if OIDC
isn't available locally). The route sends only hard-coded synthetic text and a
generated 1×1 PNG — never journal content.

```bash
curl -sS "$PREVIEW_URL/api/zdr-selftest" \
  -H "x-zdr-selftest-token: $ZDR_SELFTEST_TOKEN"
```

`Authorization: Bearer $ZDR_SELFTEST_TOKEN` is also accepted.

Preview deployments sit behind Vercel Authentication; a browser session or a
Protection Bypass for Automation secret is needed to reach the URL.

## Rollback

Unset `AI_GATEWAY_ZDR` (or set it to anything other than `on`/`true`) and
redeploy. Keep `OPENAI_API_KEY` in place. Direct OpenAI is the only path again.

## What is not covered

- `api/transcribe.ts` (gpt-4o-mini-transcribe) — no ZDR speech-to-text on OpenAI
- `api/realtime-token.ts` + the client WebSocket to `wss://api.openai.com`
- Local `scripts/*` that construct their own OpenAI client (most import
  `api/_lib` and follow the flag automatically; they need
  `AI_GATEWAY_API_KEY` or `vercel env pull` locally)
