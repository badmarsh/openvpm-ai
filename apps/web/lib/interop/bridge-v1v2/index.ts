/**
 * Secure Interop Bridge v1 → v2 — public surface (Sprint 30).
 *
 * Consumed by:
 *   • `apps/web/server/routers/extensions/bridge-v1v2.ts` (tRPC — mounted as
 *     `trpc.extensions.bridgeV1V2.*`),
 *   • `apps/web/app/(dashboard)/admin/interop-bridge/page.tsx` (operator
 *     console, dashboard UI kit),
 *   • `security/policies/bridge.md` documents the operational contract.
 */
export * from "./protocol";
export * from "./crypto";
export * from "./validation";
export * from "./safety";
export * from "./pipeline";
