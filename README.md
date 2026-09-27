# @komplexai/halu

JavaScript/TypeScript client for [**Komplex AI**](https://detector.komplexai.io) —
a hallucination detector for LLM output. Score any AI response for hallucination
risk in one call. Works in Node 18+ and modern browsers (zero dependencies —
uses native `fetch`).

```bash
npm install @komplexai/halu
```

## Quick start

```ts
import { detect } from "@komplexai/halu"; // set HALU_API_KEY in your env

const result = await detect("The Eiffel Tower was built in 1789 by Napoleon Bonaparte.");
console.log(result.pHallucination); // 0.87 — likely a hallucination
console.log(result.flag);           // true
console.log(result.topRegime);      // "FABRICATED"
```

[Get a free API key](https://detector.komplexai.io/account/keys) — no credit card.

> **First call slow?** The detector scales to zero when idle, so the *first* request
> after a quiet period warms the model and can take ~10–30s. Later calls are fast.
> If a first call times out, retry, or give it more room: `detect(text, { timeoutMs: 60000 })`.

## Authentication

`detect()` reads the API key from `options.apiKey`, else the `HALU_API_KEY`
environment variable. Keys are sent as `Authorization: Bearer <key>`.

```ts
await detect("...", {
  apiKey: "sk_...",
  baseUrl: "https://api.komplexai.io", // default
  timeoutMs: 30000,                    // default
});
```

`HALU_BASE_URL` and `HALU_TIMEOUT_MS` env vars override the defaults.

> **Browser note:** don't ship a real API key in client-side code — proxy through
> your own backend. Env-var key loading only applies in Node.

## Gate output — `detectOrThrow`

```ts
import { detectOrThrow, HaluHallucinationFlagged } from "@komplexai/halu";

try {
  await detectOrThrow(llmResponse, { threshold: 0.5 });
  // safe to use llmResponse
} catch (e) {
  if (e instanceof HaluHallucinationFlagged) {
    // e.result has pHallucination, topRegime, etc.
    answer = "I'm not sure — please verify with an expert.";
  }
}
```

## What `detect()` returns

| Field | Type | Description |
|---|---|---|
| `pHallucination` | `number` | Calibrated probability (0–1). |
| `flag` | `boolean` | True when the server's threshold is exceeded. |
| `topRegime` | `string` | Most likely regime (`NORMAL`, `FABRICATED`, `CF_AUTH`, `NEAR_FALSE`, `FALSE_REFUSAL`, `Other`). |
| `regimeScores` | `RegimeScore[]` | All regime probabilities. |
| `requestId` | `string` | Server request ID for log correlation. |
| `latencyMs` | `number` | Server-side inference time. |
| `modelVersion` / `calibratorVersion` | `string` | Build identifiers. |

## Errors

All errors extend `HaluError` and carry `.requestId`:

| Class | HTTP | When |
|---|---|---|
| `HaluAuthError` | 401 | Missing/invalid key |
| `HaluQuotaError` | 402 | Quota exceeded (`.quotaPeriod`, `.upgradeUrl`) |
| `HaluRateLimitError` | 429 | Rate limited (`.retryAfter`) |
| `HaluInputError` | 400 | Bad request (`.errorCode`) |
| `HaluServerError` | 5xx | Upstream/handler failure (`.statusCode`) |
| `HaluHallucinationFlagged` | — | Thrown by `detectOrThrow` (`.result`) |

## Scope & limits

English natural-language responses, up to 2,048 characters. Probabilistic signal,
not a fact-checker. Free tier: 3,700 API units/month. See
[Performance](https://detector.komplexai.io/performance) for per-regime accuracy and
[the Guide](https://detector.komplexai.io/guide) for the full API.

## License

Apache-2.0
