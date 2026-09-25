# Migration documents

Code- and state-migration planning for OpenVPM AI. This directory was created
by Sprint 26; it is distinct from
[`../migrating-to-openvpm.md`](../migrating-to-openvpm.md), which covers
importing **clinic data** from other PIMS vendors by CSV.

| Document | What it is |
| --- | --- |
| [`sprint-26-legacy-state-bindings-audit.md`](./sprint-26-legacy-state-bindings-audit.md) | Inventory of every deprecated state binding in the codebase: 102 findings across 10 rules in 51 files, each with file, line, why it is legacy, and its migration target. |
| [`sprint-26-legacy-state-migration-plan.md`](./sprint-26-legacy-state-migration-plan.md) | Eight-phase plan to retire those bindings, with the protocol rules, per-phase path authorisation, sequencing and definition of done. |

## Reproducing the audit

Both documents are generated from a live scan, not written by hand. Every count
in them is reproducible:

```bash
node src/legacy/state/scan.mjs --by-rule  # counts per rule
node src/legacy/state/scan.mjs            # full file:line report
node src/legacy/state/audit.mjs           # gate against baseline.json
```

See [`../../src/legacy/state/README.md`](../../src/legacy/state/README.md) for
the auditor itself.

## Related documents elsewhere in the repo

| Document | Covers |
| --- | --- |
| [`../migrating-to-openvpm.md`](../migrating-to-openvpm.md) | CSV data migration from other PIMS vendors (AVImark, Covetrus, …) |
| [`../../DESIGN-SYSTEM-MIGRATION.md`](../../DESIGN-SYSTEM-MIGRATION.md) | Design-token unification (`--brand` vs `--primary`) |
| [`../shepherd-migration-support-plan.md`](../shepherd-migration-support-plan.md) | Shepherd data-migration support |

No document named "OpenVPM Migration Guide v3" exists in this repository; see
§0 of the Sprint 26 migration plan for what that means and which protocol the
plan follows instead.
