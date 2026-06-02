# OpenVPM REST API (v1)

A versioned, public REST API over OpenVPM's core records. It is intended for
third-party integrators (booking, reminders, client comms, AI agents) that read
and write practice data without using the internal tRPC client.

> **Compatibility layer.** The `v1` surface is OpenVPM's own clean contract and
> doubles as the reference implementation for vendor-compatible APIs. Each
> response shape is owned by an explicit schema and frozen independently of the
> internal database — internal columns can change without breaking you. A
> vendor-specific "identical-twin" surface (so an existing integration can point
> at OpenVPM with zero changes) is added as a sibling namespace; see
> [Adding a compatibility target](../../CONTRIBUTING.md#adding-a-compatibility-endpoint-or-target).

## Authentication

Every request requires a scoped API key. A practice admin creates one from
**Settings → API Keys** (backed by the `apiKeys` tRPC router). The raw key is
shown **once** at creation — store it securely.

Send it on every request as a bearer token (preferred) or `X-API-Key`:

```bash
curl https://demo.openvpm.com/api/v1/clients \
  -H "Authorization: Bearer ovpm_xxxxxxxxxxxxxxxxxxxxxxxx"

# equivalent
curl https://demo.openvpm.com/api/v1/clients \
  -H "X-API-Key: ovpm_xxxxxxxxxxxxxxxxxxxxxxxx"
```

Keys are stored as bcrypt hashes (never in plaintext) and are scoped to a single
practice — a key can only ever read or write its own practice's data.

### Scopes

| Scope | Grants |
|---|---|
| `clients:read` | List/read clients |
| `patients:read` | List/read patients |
| `appointments:read` | List/read appointments *(reserved for upcoming reads)* |
| `appointments:write` | Create appointments |
| `*` | All of the above |

A request missing the required scope returns `403`.

## Rate limits

Each key is limited to **600 requests/minute**. Over the limit returns `429`
with `Retry-After` and `X-RateLimit-*` headers.

> Note: the limiter is currently in-memory and per-instance, so on multi-instance
> deployments the effective limit is per instance. A shared (Redis) limiter is on
> the roadmap.

## Error format

All errors use a single envelope:

```json
{ "error": { "message": "API key missing required scope: appointments:write" } }
```

Validation errors (`400`) include field detail:

```json
{ "error": { "message": "Validation failed", "fields": { "end_time": ["end_time must be after start_time"] } } }
```

| Status | Meaning |
|---|---|
| `400` | Malformed JSON or failed validation |
| `401` | Missing or invalid API key |
| `403` | Key lacks the required scope |
| `404` | Resource not found (or not in your practice) |
| `429` | Rate limit exceeded |

## Endpoints

List responses use a `{ data, pagination }` envelope; single-resource responses
use `{ data }`.

### `GET /api/v1/clients`
Scope `clients:read`. Query: `limit` (default 25, max 100), `offset`.

```json
{
  "data": [
    {
      "id": "…", "first_name": "Jane", "last_name": "Doe",
      "email": "jane@example.com", "phone": "555-0100",
      "address": "1 Main St", "city": "Tampa", "state": "FL", "zip": "33601",
      "preferred_contact_method": "email", "notes": null,
      "created_at": "2026-01-02T03:04:05.000Z", "updated_at": "2026-01-02T03:04:05.000Z"
    }
  ],
  "pagination": { "limit": 25, "offset": 0, "total": 1 }
}
```

### `GET /api/v1/clients/:id`
Scope `clients:read`. Returns `{ data: <client> }` or `404`.

### `GET /api/v1/patients`
Scope `patients:read`. Query: `limit`, `offset`, optional `client_id`.
Species are normalized to integrator-friendly values (`dog`, `cat`, `bird`,
`rabbit`, `reptile`, `horse`, `other`) and the internal sex enum is split into
`sex` (`male`/`female`/`unknown`) + `neutered` (boolean | null).

### `GET /api/v1/patients/:id`
Scope `patients:read`. Returns `{ data: <patient> }` or `404`.

### `POST /api/v1/appointments`
Scope `appointments:write`. Body:

```json
{
  "start_time": "2026-03-01T09:00:00.000Z",
  "end_time": "2026-03-01T09:30:00.000Z",
  "client_id": "…",
  "patient_id": "…",
  "doctor_id": "…",
  "type_id": "…",
  "room_id": "…",
  "notes": "Annual exam"
}
```

`start_time`/`end_time` are required ISO-8601 timestamps (`end_time` must be
after `start_time`); all ids and `notes` are optional. Returns `201` with
`{ data: <appointment> }` and fires the `appointment.created` webhook to any
subscribed endpoints (see the [Webhooks](../../README.md#webhooks) section).
