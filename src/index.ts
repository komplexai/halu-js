export { detect, detectOrThrow } from "./client";
export type { DetectOrThrowOptions } from "./client";
export type { DetectOptions, DetectResult, RegimeScore, Task } from "./types";
export {
  HaluError,
  HaluAuthError,
  HaluQuotaError,
  HaluRateLimitError,
  HaluInputError,
  HaluServerError,
  HaluHallucinationFlagged,
} from "./errors";
