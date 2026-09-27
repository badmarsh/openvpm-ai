# tasks/archive — read-only history

Finished, superseded or one-off prompts and records, date-prefixed (`YYYY-MM-DD-<original-name>`) so `ls` lists them oldest → newest.

- Every file starts with a verification header (Status · Verdict · Evidence · Origin).
- The full ledger with the reasoning for each file is in [`../VERIFICATION-LOG.md`](../VERIFICATION-LOG.md).
- **Never dispatch anything from this folder.** If an archived prompt is needed again, copy it to `prompts/` (template) or `tasks/sprints/` (spec), refresh it against current code, and give it a new header.
- `2026-09-24-arena-1790286107-arena-sprint-8-billing-ledger-.md` is a regression fixture for `.agents/agno/tests/test_prompt_templates.py`. Don't edit anything below its header.

Where these files came from:

| Prefix range | Former location |
|---|---|
| 2026-09-11 … 2026-09-17 | `artifacts/audit-prompts/` (audit/mission megaprompts) |
| 2026-09-20 … 2026-09-21 | `tasks/` (pre-numbering UI/consolidation prompts) |
| 2026-09-21 `gt-*` | `tasks/proposed/` (Golden Tickets that are DONE) |
| 2026-09-23 | `.agents/prompts/` and `tasks/` |
| 2026-09-24 … 2026-09-25 `arena-17…`, `arena-response-…` | `tasks/` (Agno dispatch copies and collected Arena responses) |
| 2026-09-25 `arena-final-pass-…` | `prompts/` |
