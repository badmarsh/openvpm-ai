# Security policy — Secure Interop Bridge v1 → v2

**Scope:** message exchange between a VPM **v1** runtime (legacy clinic system,
system of record during migration) and a VPM **v2** runtime (OpenVPM AI).
**Owner:** platform security · **Review cadence:** every 90 days with key rotation.
**Status:** enforced in code — the operator console cannot bypass it.

| Layer | Implementation |
|---|---|
| Protocol contract | `apps/web/lib/interop/bridge-v1v2/protocol.ts` |
| Cryptography | `apps/web/lib/interop/bridge-v1v2/crypto.ts` |
| Schema validation | `apps/web/lib/interop/bridge-v1v2/validation.ts` |
| Statutory gates | `apps/web/lib/interop/bridge-v1v2/safety.ts` |
| Ingest / dispatch pipeline | `apps/web/lib/interop/bridge-v1v2/pipeline.ts` |
| Router & persistence | `apps/web/server/routers/extensions/bridge-v1v2.ts`, `packages/db/schema/ext_bridge_v1v2.ts` |
| Operator console | `apps/web/app/(dashboard)/admin/interop-bridge/page.tsx` |

---

## 1. Threat model

The bridge assumes an **untrusted network** and a **semi-trusted peer**:

| Threat | Control |
|---|---|
| Passive interception | AES-256-GCM payload encryption; only ciphertext leaves the process. |
| Ciphertext tampering | GCM authentication tag; any bit flip surfaces as `auth_failed` → `decryption_failed` quarantine. |
| Envelope re-labelling (moving a valid body under another type, direction, key or timestamp) | The canonical header is bound as **additional authenticated data** and signed — `bridgeEnvelopeAad()`. |
| Forgery by an attacker without the secret | HMAC-SHA256 envelope signature, verified in constant time. |
| Replay of a previously accepted envelope | 128-bit nonce consumed exactly once per practice (`ext_bridge_messages_nonce_uq`) plus a ±5 min clock-skew window. |
| Smuggling of unmodelled fields (`aiPrefill`, `photoUrl`, `autoSign`) | Payload contracts are `strict()` — unknown fields are a validation failure. |
| Secret exfiltration via the database | The database stores a **fingerprint** (`sha256:<hex>`), an HKDF salt and a secret *reference* only. |
| PHI leakage through logs/console | Rejected and quarantined envelopes keep validation issues and a **redacted** payload copy; ciphertext is never returned to the browser. |

## 2. Cryptographic envelope

* **Payload encryption** — AES-256-GCM, 96-bit random IV, 128-bit auth tag,
  `algorithm` pinned to `aes-256-gcm`. AAD = canonical header.
* **Envelope signature** — HMAC-SHA256 over `AAD + "\n" + sha256(canonical payload)`,
  base64url encoded, compared with `timingSafeEqual`.
* **Key derivation** — HKDF-SHA256, 256-bit output,
  `info = openvpm-interop-bridge:<runtime>:<keyId>`. Rotating the key id yields
  disjoint key material without changing the provisioned secret.
* **Canonical serialisation** — recursively key-sorted JSON (`canonicalBridgeJson`),
  so a harmless refactor cannot invalidate signatures or digests.
* **Size ceiling** — 256 KiB per payload, enforced before and after decryption.
* **Wire protocol version** — `2026-09-bridge-v1`; payload schema version `1.0`
  (unsupported versions are rejected, never coerced).

## 3. Key management

| Item | Rule |
|---|---|
| Secret storage | Deployment secret store only: `OPENVPM_BRIDGE_V1_SECRET`, `OPENVPM_BRIDGE_V2_SECRET` (or a named `secretRef`). Never in the repository, never in the database, never in an API request. |
| Minimum length | 16 characters enforced by `deriveBridgeKey`; provisioning fails closed below that. |
| Registration | `trpc.extensions.bridgeV1V2.registerKey` reads the provisioned secret, stores its fingerprint + salt + reference, and marks any previously active key for that runtime `rotated`. |
| Rotation | Every **90 days** (`BRIDGE_KEY_ROTATION_DAYS`); the console raises a rotation hint on the KPI card. |
| Revocation | `revokeKey` is immediate: the key can no longer seal or open envelopes; the event is written to `ext_bridge_events` with `warning` severity. |
| Endpoint transport | HTTPS is mandatory (plain HTTP only for `localhost` development). |

## 4. Validation contract

* Envelope: structure, protocol/schema version, direction ↔ runtime agreement,
  message-type ↔ direction matrix, key-id consistency, size, timestamp window.
* Payload: one strict Zod contract per message type
  (`BRIDGE_PAYLOAD_CONTRACTS`); the practice-level approval state is recorded in
  `ext_bridge_contracts` (strictness, enabled/disabled, approver, timestamp).
* Contracts evolve by **new schema version**, never by loosening `strict()`.
* Every outcome is stored: `validated`, `quarantined` (authentication, contract
  or gate failure) or `rejected` (structural, peer-fixable). Nothing is dropped
  silently.

## 5. Statutory gates (Slovak law)

1. **Zákon č. 39/2007 Z. z. — clinical records stay drafted.**
   Clinical message types are accepted only in `draft`, and flags such as
   `autoSign`, `autoFinalize`, `aiSignature`, `skipVetReview` are refused.
   A `signed` record is only accepted when it carries a human veterinarian
   (`signedByVetId` must not be an AI/system identifier). The veterinarian signs
   inside OpenVPM via the confirmation protocol — never over the wire.

2. **Zákon č. 139/1998 Z. z. — zero AI prefill for controlled substances.**
   Ketamín, opioidy, propofol and every other OPL substance are detected in
   payload text; any payload carrying `aiPrefill: true` for such a substance is
   quarantined. Prescriptions with a controlled substance require
   `manualEntry: true`, and ledger entries for administration/disposal require a
   witness (`controlledSubstanceWitnessError`). The console marks these rows with
   a red **OPL — manual entry** badge (ShieldAlert).

3. **Sympathy Gate.** A patient marked `deceased` (or `euthanized`) suppresses
   automated outreach immediately: an automation-carrying message is refused and
   recorded, and a suppression request is forwarded into the canonical
   `ext_automation_suppression_log` with reason `deceased_patient` so the
   automation engine stops every queued reminder for that client.

Additionally, imaging attachments (`attachment.linked`) must never carry
`photoUrl` / `avatarUrl` / `imageUrl`; they live in their own category.

## 6. Data handling

* `ext_bridge_messages` keeps the sealed envelope, the payload digest, the
  signature-verification result, validation issues and a **redacted** payload
  summary (free-text clinical fields masked). Plaintext clinical records are
  never persisted by the bridge.
* `ext_bridge_keys` keeps identifiers and fingerprints only.
* `ext_bridge_events` is append-only security telemetry: actor (`user:<id>`,
  `bridge:v1`, `system`), event type, severity, message reference.
* The message log is tenant-scoped by `practice_id` on every query.

## 7. Operations

1. `saveEndpoint` — register the peer runtime (HTTPS origin, direction,
   optional message-type allowlist).
2. `registerKey` — activate the provisioned secret; confirm the fingerprint
   matches the peer's expectation.
3. **Verify round trip** — the console seals a `bridge.heartbeat` envelope and
   feeds it back through ingest; a healthy bridge answers `validated`.
4. Triage — filter `quarantined` / `rejected` messages, read the failure code
   and Zod issues, correct the peer, re-drive the message.
5. Rotate keys before the 90-day hint turns red; revoke immediately on
   suspected compromise and follow `docs/incident-response.md`.

## 8. Incident response hooks

* `signature_invalid`, `decryption_failed`, `replay_detected` and
  `safety_gate_blocked` are `warning`/`critical` events in `ext_bridge_events`.
* A compromised secret requires: revoke the key, rotate the deployment secret,
  register a new key, then review `ext_bridge_messages` for the affected window.
* Do not delete bridge rows during an incident — they are the evidence trail.
