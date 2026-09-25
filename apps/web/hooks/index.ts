/**
 * VPM reactive hooks barrel (Sprint 24 — Finalize VPM Context Layer).
 *
 * Prefer `@/hooks` or named imports. Core pure logic lives in `@/core/context`.
 */

export {
  useVpmWorkspaceContext,
  type UseVpmWorkspaceContextResult,
} from "./use-vpm-workspace-context";

export {
  useVpmAiSafety,
  type UseVpmAiSafetyInput,
  type UseVpmAiSafetyResult,
} from "./use-vpm-ai-safety";

export {
  useVpmSympathyGate,
  type UseVpmSympathyGateInput,
  type UseVpmSympathyGateResult,
} from "./use-vpm-sympathy-gate";

export {
  useVpmContext,
  type UseVpmContextOptions,
  type UseVpmContextResult,
} from "./use-vpm-context";
