import {
  HaluError,
  HaluAuthError,
  HaluQuotaError,
  HaluRateLimitError,
  HaluInputError,
  HaluServerError,
  HaluHallucinationFlagged,
} from "./errors";
import type { DetectOptions, DetectResult, RegimeScore, Task } from "./types";

const DEFAULT_BASE_URL = "https://api.komplexai.io";
const DEFAULT_TIMEOUT_MS = 30_000;
const DETECT_PATH = "/api/detect";

function env(name: string): string | undefined {
  if (typeof process !== "undefined" && process.env && process.env[name]) return process.env[name];
  return undefined;
}

function isLocalhost(url: string): boolean {
  const u = url.toLowerCase();
  return u.startsWith("http://localhost") || u.startsWith("http://127.0.0.1") || u.startsWith("http://0.0.0.0");
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseResult(body: Record<string, any>, requestId?: string): DetectResult {
  const scores: RegimeScore[] = Array.isArray(body.regime_scores)
    ? body.regime_scores.map((it: any) => ({ regime: String(it.regime), p: num(it.p) }))
    : [];
  return {
    pHallucination: num(body.p_hallucination),
    flag: Boolean(body.flag),
    topRegime: String(body.top_regime ?? ""),
    regimeScores: scores,
    requestId: String(body.request_id ?? requestId ?? ""),
    detectionsBilled: num(body.detections_billed),
    mode: String(body.mode ?? "short"),
    latencyMs: num(body.latency_ms),
    modelVersion: String(body.model_version ?? ""),
    calibratorVersion: String(body.calibrator_version ?? ""),
    inputModeUsed: String(body.input_mode_used ?? ""),
    taskUsed: String(body.task_used ?? ""),
    raw: body,
  };
}

function raiseForStatus(status: number, body: any, headers: Headers, requestId?: string): never {
  const payload = body && typeof body === "object" ? body : {};
  const rid: string | undefined = payload.request_id ?? requestId;
  const code: string | undefined = payload.error;
  const detail: string | undefined = payload.detail;
  const message: string = payload.message ?? detail ?? code ?? `HTTP ${status}`;

  if (status === 401) throw new HaluAuthError(message, rid);
  if (status === 402) {
    throw new HaluQuotaError(message, rid, headers.get("x-quota-period") ?? undefined, payload.upgrade_url);
  }
  if (status === 429) {
    const ra = headers.get("retry-after");
    throw new HaluRateLimitError(message, rid, ra ? Number(ra) : undefined);
  }
  if (status === 400) throw new HaluInputError(message, rid, code ?? "bad_request");
  throw new HaluServerError(message, rid, status, detail);
}

/**
 * Score an LLM response for hallucination risk.
 *
 * @param response The LLM-generated text to score (English, up to 2,048 chars).
 * @param options  prompt / task / apiKey / baseUrl / timeoutMs.
 */
export async function detect(response: string, options: DetectOptions = {}): Promise<DetectResult> {
  if (typeof response !== "string" || response.length === 0) {
    throw new HaluInputError("`response` must be a non-empty string.", undefined, "response_required");
  }
  const task: Task = options.task ?? "multiclass";
  if (task !== "binary" && task !== "multiclass") {
    throw new HaluInputError(`\`task\` must be 'binary' or 'multiclass' (got ${String(task)}).`, undefined, "bad_request");
  }

  const baseUrl = (options.baseUrl ?? env("HALU_BASE_URL") ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? num(env("HALU_TIMEOUT_MS"), DEFAULT_TIMEOUT_MS);
  const apiKey = options.apiKey ?? env("HALU_API_KEY");

  if (!isLocalhost(baseUrl) && !apiKey) {
    throw new HaluAuthError(
      "No API key found. Set HALU_API_KEY or pass apiKey. Create a key at https://detector.komplexai.io/account/keys.",
    );
  }

  const reqBody: Record<string, unknown> = { response, task };
  if (options.prompt !== undefined) reqBody.prompt = options.prompt;

  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${DETECT_PATH}`, {
      method: "POST",
      headers,
      body: JSON.stringify(reqBody),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") throw new HaluError(`Request timed out after ${timeoutMs}ms.`);
    throw new HaluError(`Network error: ${err?.message ?? String(err)}`);
  } finally {
    clearTimeout(timer);
  }

  const requestId = res.headers.get("x-request-id") ?? undefined;
  const text = await res.text();
  let parsed: any;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = undefined;
  }

  if (!res.ok) raiseForStatus(res.status, parsed, res.headers, requestId);
  if (!parsed || typeof parsed !== "object") {
    throw new HaluServerError("Response was not valid JSON.", requestId, res.status);
  }
  return parseResult(parsed, requestId);
}

export interface DetectOrThrowOptions extends DetectOptions {
  /** Throw when pHallucination >= threshold (default 0.5). */
  threshold?: number;
}

/**
 * Detect, and throw {@link HaluHallucinationFlagged} if the response is flagged
 * (server flag set OR pHallucination >= threshold). Returns the result otherwise.
 */
export async function detectOrThrow(response: string, options: DetectOrThrowOptions = {}): Promise<DetectResult> {
  const { threshold = 0.5, ...rest } = options;
  const result = await detect(response, rest);
  if (result.flag || result.pHallucination >= threshold) {
    throw new HaluHallucinationFlagged(
      `Response flagged as likely hallucinated (p=${result.pHallucination.toFixed(2)}, regime=${result.topRegime}).`,
      result,
    );
  }
  return result;
}
