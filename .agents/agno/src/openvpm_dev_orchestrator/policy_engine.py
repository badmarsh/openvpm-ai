"""
PolicyEngine for OpenVPM Dev Orchestrator.
Enforces Zero-Conflict Upstream Sync, Secrets Safety, and Slovak clinical compliance.
"""

from __future__ import annotations

import os
import re
from typing import List, Optional, Sequence

from .contracts import ChangePlan, DevTaskRequest, PolicyDecision, RiskClass

FORBIDDEN_SECRET_PATTERNS = [
    r"\.env(?:\.|$)",
    r"id_rsa",
    r"id_ed25519",
    r"credentials",
    r"secret",
]

HIGH_RISK_PATH_PATTERNS = [
    r"packages/db/schema/ext_",
    r"apps/web/server/routers/extensions/(?:ekasa|opl|billing|prescriptions)",
    r"opl",
    r"prescriptions",
]


class PolicyEngine:
    """Deterministic policy engine evaluating proposed task requests, change plans, and patches."""

    @classmethod
    def evaluate_files(cls, task_id: str, touched_files: Sequence[str]) -> PolicyDecision:
        violations: List[str] = []
        reasons: List[str] = []
        risk = RiskClass.LOW
        requires_human = False

        for f in touched_files:
            norm_f = f.replace("\\", "/")

            # 1. Vanilla Schema Immutability (Zero-Conflict Upstream Sync)
            if norm_f.startswith("packages/db/schema/") and not os.path.basename(norm_f).startswith("ext_"):
                violations.append(
                    f"Vanilla schéma `{f}` nesmie byť modifikovaná (Zero-Conflict Upstream Sync). Použi `ext_*.ts`."
                )

            # 2. Drizzle journal immutability
            if "drizzle/meta/_journal.json" in norm_f:
                violations.append("Drizzle journal `_journal.json` nesmie byť upravovaný ručne.")

            # 3. Secrets Safety
            lower_f = norm_f.lower()
            for pat in FORBIDDEN_SECRET_PATTERNS:
                if re.search(pat, lower_f):
                    violations.append(f"Citlivý súbor `{f}` nesmie byť menený (Secrets Safety).")
                    break

            # 4. Risk classification
            for pat in HIGH_RISK_PATH_PATTERNS:
                if re.search(pat, norm_f, re.IGNORECASE):
                    risk = RiskClass.HIGH
                    requires_human = True
                    reasons.append(f"Zásah do kritického klinického/legislatívneho modulu: {f}")
                    break

        if violations:
            return PolicyDecision(
                task_id=task_id,
                allowed=False,
                risk_class=RiskClass.CRITICAL,
                violations=violations,
                reasons=reasons or ["Architektonické alebo bezpečnostné porušenie pravidiel repozitára."],
                requires_human_approval=True,
            )

        if not reasons:
            reasons.append("Všetky zmenené súbory sú v súlade s architektonickými pravidlami OpenVPM AI.")

        return PolicyDecision(
            task_id=task_id,
            allowed=True,
            risk_class=risk,
            violations=[],
            reasons=reasons,
            requires_human_approval=requires_human,
        )

    @classmethod
    def evaluate_task(
        cls,
        request: DevTaskRequest,
        plan: Optional[ChangePlan] = None,
    ) -> PolicyDecision:
        files_to_check: List[str] = list(request.target_paths)
        if plan and plan.affected_files:
            files_to_check.extend(plan.affected_files)

        decision = cls.evaluate_files(request.task_id, files_to_check)
        if plan and plan.is_vanilla_change:
            decision.allowed = False
            decision.violations.append("ChangePlan deklaruje modifikáciu vanilla komponentu bez upstream autorizácie.")
            decision.risk_class = RiskClass.CRITICAL
        return decision
