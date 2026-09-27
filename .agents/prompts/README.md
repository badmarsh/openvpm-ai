# .agents/prompts → moved

On 2026-09-27 the five one-off Arena prompts that lived here (`arena-24h-audit`, `dokploy-audit`, `arena-inbox-omnichannel`, `arena-inventory-wholesaler-import`, `arena-patient-clinical-reorg`) were verified as implemented (PRs #28, #31, #32, #29/#72 and the deploy-skill commits). They were moved to [`tasks/archive/`](../../tasks/archive/) as `2026-09-23-<name>.md`.

`arena-patient-clinical-reorg` ran **twice** (PR #29 and PR #72) because it stayed in this live folder. Don't put finished prompts back here. Living templates go in [`prompts/`](../../prompts/), and the ledger is [`tasks/VERIFICATION-LOG.md`](../../tasks/VERIFICATION-LOG.md).
