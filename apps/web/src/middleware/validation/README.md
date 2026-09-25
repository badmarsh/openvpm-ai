# Sprint 27 — Schema Validation Middleware

JSON schema validation layer for VPM input contracts. Ajv-backed (draft-07 +
`ajv-formats`), aligned with the `openvpm/schemas` master registry and
enforced through a tRPC middleware.

## Layout

| File | Purpose |
| --- | --- |
| `types.ts` | Shared types: contract descriptors, issues, outcomes, guardrail codes. |
| `contracts.ts` | Vendored snapshot of the `openvpm/schemas` master catalog (`REGISTRY_SOURCE`). Bump `version` + schema body when the master registry advances. |
| `registry.ts` | Registry access (`getContract`, `listContracts`, `isContractId`). |
| `validator.ts` | Ajv singleton, compiled-validator cache, Ajv-error → i18n-issue normalization, `validateContract`. |
| `guardrails.ts` | Clinical guardrails layered on top of schema validation. |
| `middleware.ts` | tRPC adapters: `withSchemaValidation(contractId)` and `withSchemaValidationFromInput()` (envelope `{ contractId, payload }`). |
| `__tests__/` | Vitest suite (41 tests): contracts, guardrails, normalization, middleware. |

## Contracts (openvpm/schemas@master, v1.0.0)

- `openvpm.client-registration`
- `openvpm.patient-registration`
- `openvpm.vaccination-record`
- `openvpm.prescription-order` — guardrails: `ai-draft-only`, `narcotic-zero-ai-prefill`
- `openvpm.controlled-substance-record` — guardrail: `narcotic-zero-ai-prefill`
- `openvpm.lab-result-import`
- `openvpm.care-reminder` — guardrail: `sympathy-gate`
- `openvpm.ai-clinical-suggestion` — guardrails: `ai-draft-only`, `sympathy-gate`; schema locks `status` to `draft`

## Clinical guardrails

1. **`ai-draft-only` — Zákon 39/2007 Z. z. (veterinárna starostlivosť).**
   AI-generated content must remain in draft state until a veterinarian signs
   it. Any AI-originated payload carrying a signed/final lifecycle state
   (`signed`, `final`, `approved`, `issued`, `active`, `completed`) is
   rejected. The `ai-clinical-suggestion` schema additionally hard-locks
   `status` to `draft` and `signature` to `null`.

2. **`narcotic-zero-ai-prefill` — Zákon 139/1998 Z. z. (omamné látky).**
   ZERO AI prefill for ketamine, opioids and propofol. Detection is
   diacritic- and case-insensitive on word boundaries (`Ketamín` ≡
   `ketamine`); manual entry only. UI surfaces must render these blocks with
   the `ShieldAlert` icon.

3. **`sympathy-gate`.** When `patientStatus === "deceased"`, automated
   reminders/outreach are suppressed: no `automated: true`, no delivery
   channels, and no AI `care_reminder` suggestions. Manual, non-automated
   records stay allowed.

## Enforcement

```ts
// Static contract bound to one procedure:
protectedProcedure
  .use(requireRole("admin", "veterinarian"))
  .use(withSchemaValidation("openvpm.prescription-order"))
  .input(...)

// Envelope endpoint (contractId travels with the payload):
protectedProcedure
  .use(withSchemaValidationFromInput())
  .input(z.object({ contractId: z.string(), payload: z.unknown() }))
```

Every verdict is audited best-effort into `ext_schema_validation_events`
(PHI-free: field paths + issue codes only, never payload values).

## Error model

Issues are `{ field, code, messageKey, params?, guardrail? }`. `messageKey`
points into the `schemaValidation.error.*` namespace so all user-facing copy
stays in `messages/sk.json` / `messages/en.json` — the server never emits
hardcoded UI text.
