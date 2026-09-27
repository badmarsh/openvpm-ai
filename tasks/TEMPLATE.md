---
id: 0                      # next free number: see tasks/SPRINT-INDEX.md
kind: sprint
title: "<Short title> /route"
state: open
priority: P2               # P0 safety/legal · P1 security/correctness · P2 workflow · P3 polish
source: GT-000             # optional: ticket or audit finding this came from
depends_on: []             # optional: sprint ids that must be `state: done` first (else BLOCKED)
targets:                   # every file the implementer may change
  - apps/web/app/(dashboard)/<route>/page.tsx
creates: []                # new files (targets that don't exist yet)
contract_test: apps/web/lib/__tests__/<slug>.test.ts
premises:                  # facts this spec relies on; re-checked by `tasks.mjs check`
  - "lines: apps/web/app/(dashboard)/<route>/page.tsx | 900..1100"
  - "lacks: apps/web/app/(dashboard)/<route>/page.tsx | @/components/layout/page-kit"
---

# Sprint 0: <Title>

**Why now:** one paragraph with evidence (audit finding, bug, user impact).
**Rules:** [`tasks/RULES.md`](RULES.md) applies in full. This spec lists only what's specific to these targets.

## 1. Current state (measured)
- What the code does today, with file:line and quoted literals. Every claim here should also be a premise.

## 2. Change
- 2A …
- 2B …
- Presentation-only? yes/no. If yes: no change to logic, amounts, statuses, mutations or routers.

## 3. Frozen (DO NOT TOUCH)
- Source-contract literals pinned by existing tests (copy them exactly), with the test file names.
- Logic that must not change.
- Files outside `targets`.

## 4. Contract
- `contract_test` is committed with this spec as `it.fails(...)`, one case per acceptance criterion.
- The implementer flips each case to `it(...)`. Done = all cases pass plus the tests listed here stay green:
  - `pnpm --filter @openpims/web exec vitest run <pinned tests>`

## 5. Follow-ups (report only)
- …
