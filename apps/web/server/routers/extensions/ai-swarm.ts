/**
 * AI Swarm & AgentOS Management Router for OpenVPM AI.
 * Provides real-time status of AgentOS runtime (:7777), active Arena sessions,
 * task pipelines, telemetry, and agent fleet configuration.
 *
 * Strict upstream zero-conflict compliance: Isolated under extensionsRouter.
 */
import fs from "fs";
import path from "path";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure } from "../../trpc";

export interface SwarmAgentInfo {
  id: string;
  name: string;
  role: string;
  description: string;
  model: string;
  provider: string;
  category: "orchestrator" | "developer" | "qa" | "operations";
  status: "ready" | "busy" | "standby";
  tools: string[];
}

export interface SwarmTeamInfo {
  id: string;
  name: string;
  mode: string;
  leader: string;
  members: string[];
  description: string;
}

export interface SwarmWorkflowInfo {
  id: string;
  name: string;
  stepsCount: number;
  description: string;
}

export interface SwarmSession {
  sessionId: string;
  module: string;
  promptSummary?: string;
  targetModel?: string;
  status: "COMPLETED" | "RUNNING" | "FAILED" | "PENDING" | "UNKNOWN";
  createdAt?: string;
  progress?: string;
}

export interface SwarmTask {
  taskId: string;
  title: string;
  state: string;
  declaredRisk?: string;
  allowedPaths?: string[];
  createdAt?: string;
  updatedAt?: string;
  failureReason?: string;
  repairAttempts?: number;
}

const STATIC_FLEET: SwarmAgentInfo[] = [
  {
    id: "prompt_manager",
    name: "Prompt Manager & Dev Leader",
    role: "Orchestrácia & Golden Ticket architektúra",
    description: "Preskúma požiadavku, overí pravidlá OpenVPM (AGENTS.md, UIKIT.md, i18n, zero-conflict) a pripraví Golden Ticket.",
    model: "Gemini 3.8 Flash / Qwen Coder Plus",
    provider: "Antigravity / AliProxy",
    category: "orchestrator",
    status: "ready",
    tools: ["create_and_dispatch_arena_task", "evaluate_verification_and_repair", "read_project_file"],
  },
  {
    id: "arena_dispatcher",
    name: "Arena Dispatcher",
    role: "Browser Automation & Tab Dispatch",
    description: "Automatické otvorenie Arena.ai cez Chrome DevTools Protocol (port 9222) a vloženie zadania do relácie.",
    model: "Gemini 3.8 Flash",
    provider: "Antigravity Proxy",
    category: "operations",
    status: "ready",
    tools: ["dispatch_to_arena_session", "send_prompt_to_arena_browser", "open_arena_in_browser"],
  },
  {
    id: "arena_watcher",
    name: "Arena Watcher & Heartbeat",
    role: "Proaktívny dohľad & zber patchov",
    description: "Sleduje prechody stavov v tasks/, deteguje uviaznuté relácie, zberá hotový diff a vytvára .patch súbory.",
    model: "Gemini 3.8 Flash",
    provider: "Antigravity Proxy",
    category: "operations",
    status: "ready",
    tools: ["collect_code_from_arena_browser", "list_active_arena_sessions", "monitor_arena_health"],
  },
  {
    id: "github_manager",
    name: "Git & Worktree Manager",
    role: "Izolované vetvy & worktree prostredia",
    description: "Zabezpečuje prácu v oddelených worktrees bez blokovania hlavného pracovného stromu.",
    model: "Gemini 3.8 Flash",
    provider: "Antigravity Proxy",
    category: "operations",
    status: "ready",
    tools: ["create_git_worktree", "remove_git_worktree", "git_checkout_branch", "git_diff_summary"],
  },
  {
    id: "qwen_implementer",
    name: "Qwen Implementer",
    role: "Aplikácia zmien & TypeScript/React generovanie",
    description: "Aplikuje Arena diffy do izolovanej vetvy swarm/agno-*, refaktoruje komponenty a rieši prípadné konflikty.",
    model: "Qwen 2.5 Coder Plus (32B)",
    provider: "AliProxy (:8080)",
    category: "developer",
    status: "ready",
    tools: ["apply_arena_patch", "run_openvpm_verification", "write_project_file"],
  },
  {
    id: "gemini_reviewer",
    name: "Gemini Reviewer & QA",
    role: "Architektonický & klinický audit",
    description: "Audituje striktné vanilkové nemennosti schém, 100% i18n symetriu a klinické safety brány (Zákon 39/2007, 139/1998).",
    model: "Gemini 3.8 Flash High",
    provider: "Antigravity Proxy",
    category: "qa",
    status: "ready",
    tools: ["audit_architectural_boundaries", "audit_clinical_and_safety_gates", "audit_i18n_symmetry"],
  },
  {
    id: "prompt_architect",
    name: "Prompt Architect",
    role: "Štruktúrovanie XML & Prompt Engineering",
    description: "Optimalizuje systémové inštrukcie, odstraňuje tokenovú redundanciu a validuje XML tagy.",
    model: "Gemini 3.8 Flash",
    provider: "Antigravity Proxy",
    category: "orchestrator",
    status: "ready",
    tools: ["design_system_prompt", "validate_prompt_xml"],
  },
];

const STATIC_TEAMS: SwarmTeamInfo[] = [
  {
    id: "openvpm-dev-team",
    name: "OpenVPM Dev Team",
    mode: "Coordinate / Leader Delegation",
    leader: "prompt_manager",
    members: ["prompt_manager", "arena_dispatcher", "arena_watcher", "github_manager", "qwen_implementer"],
    description: "Autonómny vývojový tím koordinovaný lídrom pre paralelné sprinty, generovanie kódu a kontrolu kvality.",
  },
];

const STATIC_WORKFLOWS: SwarmWorkflowInfo[] = [
  {
    id: "arena-dev-pipeline",
    name: "Arena Dev Pipeline",
    stepsCount: 5,
    description: "5-fázový autonómny cyklus: Zadanie modulu -> Líder Prompt -> Arena.ai -> Vetva swarm/agno-* -> Verifikácia -> Líder Review.",
  },
];

function findRepoRoot(): string {
  const candidates = [
    path.resolve(process.cwd(), "../.."),
    process.cwd(),
    path.resolve(process.cwd(), ".."),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, ".agents"))) {
      return c;
    }
  }
  return process.cwd();
}

function loadArenaSessions(repoRoot: string): SwarmSession[] {
  const candidates = [
    path.join(repoRoot, ".agents", "agno", "tmp", "arena_sessions.json"),
    path.join(repoRoot, "tmp", "arena_sessions.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => ({
            sessionId: String(item.session_id || item.sessionId || "unknown"),
            module: String(item.module || "Neznáma úloha"),
            promptSummary: item.prompt_summary || item.promptSummary,
            targetModel: item.target_model || item.targetModel || "Arena.ai",
            status: (item.status as SwarmSession["status"]) || "UNKNOWN",
            createdAt: item.created_at || item.createdAt,
            progress: item.progress,
          }));
        }
      } catch (err) {
        console.error("Failed to parse arena_sessions.json", err);
      }
    }
  }
  return [];
}

function loadTasks(repoRoot: string): SwarmTask[] {
  const tasksDir = path.join(repoRoot, "tasks");
  if (!fs.existsSync(tasksDir)) return [];
  try {
    const files = fs.readdirSync(tasksDir);
    const tasks: SwarmTask[] = [];
    for (const f of files) {
      if (f.startsWith("run-") && f.endsWith(".json")) {
        try {
          const raw = fs.readFileSync(path.join(tasksDir, f), "utf-8");
          const p = JSON.parse(raw);
          tasks.push({
            taskId: p.task_id || f.replace(".json", ""),
            title: p.title || f,
            state: p.state || "UNKNOWN",
            declaredRisk: p.declared_risk,
            allowedPaths: p.allowed_paths,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
            failureReason: p.failure_reason,
            repairAttempts: p.repair_attempts,
          });
        } catch {
          // ignore corrupted json
        }
      }
    }
    return tasks.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  } catch (err) {
    console.error("Failed to list tasks", err);
    return [];
  }
}

/**
 * Loopback probes answer in single-digit milliseconds, so a short timeout keeps the
 * admin page snappy. A tunnel URL has to complete DNS + TLS + a Cloudflare round trip
 * before the origin even responds; at 800 ms a cold tunnel reports "offline" while it
 * is perfectly healthy. Budget per candidate, not globally.
 */
const LOOPBACK_PROBE_TIMEOUT_MS = 800;
const REMOTE_PROBE_TIMEOUT_MS = 2_500;

function probeTimeoutMs(url: string): number {
  try {
    const { hostname } = new URL(url);
    const isLoopback =
      hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
    return isLoopback ? LOOPBACK_PROBE_TIMEOUT_MS : REMOTE_PROBE_TIMEOUT_MS;
  } catch {
    return REMOTE_PROBE_TIMEOUT_MS;
  }
}

async function checkAgentOsHealth(preferredUrl?: string): Promise<{
  url: string;
  online: boolean;
  statusText: string;
  statusCode?: number;
  responseTimeMs?: number;
}> {
  const candidates = [
    preferredUrl,
    "http://127.0.0.1:7777",
    "http://192.168.0.100:7777",
    "http://localhost:7777",
  ].filter(Boolean) as string[];

  const uniqueCandidates = Array.from(new Set(candidates));

  let lastFailure: {
    url: string;
    online: boolean;
    statusText: string;
    statusCode?: number;
    responseTimeMs: number;
  } = {
    url: uniqueCandidates[0] || "http://127.0.0.1:7777",
    online: false,
    statusText: "Connection refused",
    statusCode: undefined,
    responseTimeMs: 0,
  };

  for (const url of uniqueCandidates) {
    const startTime = Date.now();
    try {
      const res = await fetch(`${url}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(probeTimeoutMs(url)),
      });
      if (res.ok) {
        return {
          url,
          online: true,
          statusText: "Healthy",
          statusCode: res.status,
          responseTimeMs: Date.now() - startTime,
        };
      }
      lastFailure = {
        url,
        online: false,
        statusText: `HTTP ${res.status}`,
        statusCode: res.status,
        responseTimeMs: Date.now() - startTime,
      };
    } catch (err) {
      lastFailure = {
        url,
        online: false,
        statusText: err instanceof Error ? err.message : "Connection refused",
        responseTimeMs: Date.now() - startTime,
      };
    }
  }

  return lastFailure;
}

export const aiSwarmRouter = createRouter({
  /**
   * Get full telemetry, status, sessions, and fleet metadata for AI Swarm.
   */
  getStatus: protectedProcedure.query(async () => {
    const preferredOsUrl = process.env.AGENT_OS_URL;
    const osHealth = await checkAgentOsHealth(preferredOsUrl);
    const agentOsUrl = osHealth.url;
    const agentUiUrl =
      process.env.AGENT_UI_URL ||
      (agentOsUrl.includes("192.168.0.100")
        ? "http://192.168.0.100:3007"
        : "http://localhost:3007");
    const repoRoot = findRepoRoot();
    const sessions = loadArenaSessions(repoRoot);
    const tasks = loadTasks(repoRoot);

    const completedSessions = sessions.filter((s) => s.status === "COMPLETED").length;
    const runningSessions = sessions.filter((s) => s.status === "RUNNING").length;
    const failedSessions = sessions.filter((s) => s.status === "FAILED").length;
    const pendingSessions = sessions.filter((s) => s.status === "PENDING").length;

    return {
      runtime: {
        agentOsUrl,
        agentUiUrl,
        isOnline: osHealth.online,
        statusText: osHealth.statusText,
        statusCode: osHealth.statusCode,
        responseTimeMs: osHealth.responseTimeMs,
        bindPort: 7777,
        uiPort: 3007,
      },
      stats: {
        totalAgents: STATIC_FLEET.length,
        totalTeams: STATIC_TEAMS.length,
        totalWorkflows: STATIC_WORKFLOWS.length,
        totalSessions: sessions.length,
        completedSessions,
        runningSessions,
        failedSessions,
        pendingSessions,
        activeTasksCount: tasks.length,
      },
      fleet: STATIC_FLEET,
      teams: STATIC_TEAMS,
      workflows: STATIC_WORKFLOWS,
      sessions,
      tasks,
      guardrails: {
        humanInTheLoop: true, // Zákon 39/2007 Z. z. §3
        controlledSubstancesGate: true, // Zákon 139/1998 Z. z.
        sympathyGate: true,
        zeroConflictUpstream: true,
      },
    };
  }),

  /**
   * Quick refresh of active sessions and tasks without full health re-ping.
   */
  getSessions: protectedProcedure.query(async () => {
    const repoRoot = findRepoRoot();
    const sessions = loadArenaSessions(repoRoot);
    const tasks = loadTasks(repoRoot);
    return { sessions, tasks };
  }),

  /**
   * Fetch active HITL approvals from AgentOS runtime (:7777).
   */
  getApprovals: protectedProcedure.query(async () => {
    const preferredOsUrl = process.env.AGENT_OS_URL;
    const osHealth = await checkAgentOsHealth(preferredOsUrl);
    if (!osHealth.online) {
      return { count: 0, approvals: [] };
    }
    try {
      const res = await fetch(`${osHealth.url}/approvals`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return { count: 0, approvals: [] };
      const data = await res.json();
      const approvalsList = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
      return {
        count: approvalsList.length,
        approvals: approvalsList,
      };
    } catch {
      return { count: 0, approvals: [] };
    }
  }),

  /**
   * Resolve an approval (approve or reject) in AgentOS (:7777).
   */
  resolveApproval: protectedProcedure
    .input(
      z.object({
        approvalId: z.string(),
        status: z.enum(["approved", "rejected"]),
        resolvedBy: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const preferredOsUrl = process.env.AGENT_OS_URL;
      const osHealth = await checkAgentOsHealth(preferredOsUrl);
      if (!osHealth.online) {
        throw new TRPCError({ code: "BAD_GATEWAY", message: "AgentOS is offline" });
      }
      try {
        const res = await fetch(`${osHealth.url}/approvals/${input.approvalId}/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: input.status,
            resolved_by: input.resolvedBy || ctx.session?.user?.email || "marek@openvpm.sk",
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `AgentOS approval error: ${errText}`,
          });
        }
        return { success: true };
      } catch (err: any) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to resolve approval: ${err?.message || String(err)}`,
        });
      }
    }),
});
