"""
Unit tests for openvpm_dev_orchestrator PolicyEngine, contracts, and security guardrails.
Remediates Claude audit recommendations.
"""

import os
import sys
from pathlib import Path
import pytest

AGNO_DIR = Path(__file__).resolve().parent.parent
if str(AGNO_DIR / "src") not in sys.path:
    sys.path.insert(0, str(AGNO_DIR / "src"))
if str(AGNO_DIR) not in sys.path:
    sys.path.insert(0, str(AGNO_DIR))

from openvpm_dev_orchestrator.contracts import (
    DevTaskRequest,
    DevelopmentRun,
    PolicyDecision,
    RiskClass,
    RunState,
)
from openvpm_dev_orchestrator.policy_engine import PolicyEngine
import pipeline_team_os as team_os


def test_policy_engine_rejects_vanilla_schema() -> None:
    req = DevTaskRequest(
        task_id="audit-1",
        title="Modify patients schema",
        target_paths=["packages/db/schema/patients.ts"],
    )
    decision = PolicyEngine.evaluate_task(req)
    assert not decision.allowed
    assert decision.risk_class == RiskClass.CRITICAL
    assert any("Vanilla schéma" in v for v in decision.violations)


def test_policy_engine_allows_ext_schema_with_high_risk() -> None:
    req = DevTaskRequest(
        task_id="audit-2",
        title="Add extension table",
        target_paths=["packages/db/schema/ext_custom_telemetry.ts"],
    )
    decision = PolicyEngine.evaluate_task(req)
    assert decision.allowed
    assert decision.risk_class == RiskClass.HIGH
    assert decision.requires_human_approval is True


def test_policy_engine_rejects_drizzle_journal() -> None:
    decision = PolicyEngine.evaluate_files("audit-3", ["packages/db/drizzle/meta/_journal.json"])
    assert not decision.allowed
    assert any("_journal.json" in v for v in decision.violations)


def test_policy_engine_rejects_secrets() -> None:
    for secret_path in [".env", ".env.local", "id_rsa", "config/secrets.json", "credentials.pem"]:
        decision = PolicyEngine.evaluate_files("audit-4", [secret_path])
        assert not decision.allowed, f"Should reject secret file: {secret_path}"
        assert any("Citlivý súbor" in v for v in decision.violations)


def test_policy_engine_allows_ui_with_low_risk() -> None:
    decision = PolicyEngine.evaluate_files(
        "audit-5",
        ["apps/web/messages/sk.json", "apps/web/messages/en.json", "apps/web/components/button.tsx"]
    )
    assert decision.allowed
    assert decision.risk_class == RiskClass.LOW
    assert decision.requires_human_approval is False


def test_deploy_to_production_blocks_shell_injection() -> None:
    deploy_fn = getattr(team_os.deploy_to_production, "entrypoint", team_os.deploy_to_production)
    # Test bad service name
    res1 = deploy_fn("web; rm -rf /", "1.0.0")
    assert "Bezpečnostné zamietnutie" in res1

    # Test bad version with subshell
    res2 = deploy_fn("web", "1.0.0$(id)")
    assert "Bezpečnostné zamietnutie" in res2

    # Test bad version with pipe
    res3 = deploy_fn("web", "1.0.0|cat")
    assert "Bezpečnostné zamietnutie" in res3


def test_internal_service_token_is_secure() -> None:
    # Must never be the default insecure secret
    assert team_os.INTERNAL_SERVICE_TOKEN != "openvpm-service-secret"
    assert len(team_os.INTERNAL_SERVICE_TOKEN) >= 16
