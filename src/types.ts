/** One row of `regimeScores` — a regime code and its calibrated probability. */
export interface RegimeScore {
  regime: string;
  p: number;
}

export type Task = "binary" | "multiclass";

/** Successful response from `POST /api/detect` (snake_case wire fields mapped to camelCase). */
export interface DetectResult {
  /** Calibrated probability of hallucination (0–1). */
  pHallucination: number;
  /** True when the server's per-head threshold is exceeded. */
  flag: boolean;
  /** Most likely hallucination regime (NORMAL, FABRICATED, CF_AUTH, NEAR_FALSE, ...). */
  topRegime: string;
  regimeScores: RegimeScore[];
  requestId: string;
  detectionsBilled: number;
  mode: string;
  latencyMs: number;
  modelVersion: string;
  calibratorVersion: string;
  inputModeUsed: string;
  taskUsed: string;
  /** The raw JSON body as returned by the server. */
  raw: Record<string, unknown>;
}

export interface DetectOptions {
  /** Optional prompt the model saw; including it selects prompt+response mode. */
  prompt?: string;
  /** "multiclass" (default) or "binary". */
  task?: Task;
  /** API key (sk_*). Falls back to the HALU_API_KEY env var. */
  apiKey?: string;
  /** Base URL. Falls back to HALU_BASE_URL, then https://api.komplexai.io. */
  baseUrl?: string;
  /** Request timeout in ms. Falls back to HALU_TIMEOUT_MS, then 30000. */
  timeoutMs?: number;
}
