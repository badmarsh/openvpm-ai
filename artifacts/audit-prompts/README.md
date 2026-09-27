# artifacts/audit-prompts → moved

On 2026-09-27 the prompt library was consolidated. All 22 prompts that used to live here were checked against git and code, given a verification header, and moved to [`tasks/archive/`](../../tasks/archive/) with a date prefix (for example, `ai-audit-prompt.md` → `tasks/archive/2026-09-11-ai-audit-prompt.md`).

The old → new mapping and the status of each prompt are in [`tasks/VERIFICATION-LOG.md`](../../tasks/VERIFICATION-LOG.md). Living templates are in [`prompts/`](../../prompts/).

Older reports in `artifacts/` still cite `artifacts/audit-prompts/<name>`; use the log to find the new path.
