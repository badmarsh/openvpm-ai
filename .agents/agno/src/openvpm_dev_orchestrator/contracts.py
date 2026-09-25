"""
Contracts and data models for OpenVPM Dev Orchestrator.
"""

from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass, field, fields, is_dataclass
from enum import Enum
from typing import Any, Dict, List, Optional


class RunState(str, Enum):
    PENDING = "PENDING"
    PLANNING = "PLANNING"
    POLICY_CHECK = "POLICY_CHECK"
    IMPLEMENTING = "IMPLEMENTING"
    VERIFYING = "VERIFYING"
    READY_FOR_PR = "READY_FOR_PR"
    REJECTED = "REJECTED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class RiskClass(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class DevTaskRequest:
    task_id: str
    title: str
    description: str = ""
    target_paths: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: time.strftime("%Y-%m-%d %H:%M:%S"))

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ChangePlan:
    task_id: str
    summary: str = ""
    affected_files: List[str] = field(default_factory=list)
    is_schema_change: bool = False
    is_vanilla_change: bool = False
    risk_class: RiskClass = RiskClass.LOW
    rollback_plan: str = ""

    def to_dict(self) -> Dict[str, Any]:
        res = asdict(self)
        if isinstance(res.get("risk_class"), Enum):
            res["risk_class"] = res["risk_class"].value
        return res


@dataclass
class PolicyDecision:
    task_id: str
    allowed: bool = True
    risk_class: RiskClass = RiskClass.LOW
    reasons: List[str] = field(default_factory=list)
    violations: List[str] = field(default_factory=list)
    requires_human_approval: bool = False
    timestamp: str = field(default_factory=lambda: time.strftime("%Y-%m-%d %H:%M:%S"))

    def to_dict(self) -> Dict[str, Any]:
        res = asdict(self)
        if isinstance(res.get("risk_class"), Enum):
            res["risk_class"] = res["risk_class"].value
        return res


@dataclass
class CommandResult:
    name: str
    argv: List[str]
    exit_code: int
    duration_ms: int
    output_tail: str = ""


@dataclass
class VerificationResult:
    check_name: str
    passed: bool
    details: str = ""
    duration_ms: int = 0


@dataclass
class ReviewReport:
    approved: bool
    blocking_findings: List[str] = field(default_factory=list)
    non_blocking_findings: List[str] = field(default_factory=list)
    evidence_summary: str = ""


@dataclass
class DevelopmentRun:
    task_id: str
    state: RunState
    title: str = ""
    allowed_paths: List[str] = field(default_factory=list)
    declared_risk: Any = None
    created_at: str = field(default_factory=lambda: time.strftime("%Y-%m-%d %H:%M:%S"))
    updated_at: str = field(default_factory=lambda: time.strftime("%Y-%m-%d %H:%M:%S"))
    policy_decision: Optional[PolicyDecision] = None
    change_plan: Optional[ChangePlan] = None
    worktree_path: Optional[str] = None
    verification_results: List[Any] = field(default_factory=list)
    failure_reason: str = ""
    repair_attempts: int = 0
    review_report: Optional[ReviewReport] = None

    def __post_init__(self) -> None:
        if self.allowed_paths is None:
            self.allowed_paths = []
        if self.verification_results is None:
            self.verification_results = []

    def model_dump_json(self, indent: int = 2) -> str:
        def conv(obj: Any) -> Any:
            if isinstance(obj, Enum):
                return obj.value
            if is_dataclass(obj):
                return {k: conv(v) for k, v in asdict(obj).items()}
            if isinstance(obj, list):
                return [conv(i) for i in obj]
            if isinstance(obj, dict):
                return {k: conv(v) for k, v in obj.items()}
            return obj

        return json.dumps(conv(self), indent=indent, ensure_ascii=False)

    @classmethod
    def model_validate_json(cls, raw: str) -> "DevelopmentRun":
        data = json.loads(raw)
        if "state" in data and not isinstance(data["state"], RunState):
            data["state"] = RunState(data["state"])
        if "declared_risk" in data and data["declared_risk"] and not isinstance(data["declared_risk"], RiskClass):
            try:
                data["declared_risk"] = RiskClass(data["declared_risk"])
            except ValueError:
                pass
        known = {item.name for item in fields(cls)}
        return cls(**{key: value for key, value in data.items() if key in known})
