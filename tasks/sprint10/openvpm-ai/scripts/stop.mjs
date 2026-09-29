#!/usr/bin/env node

/**
 * OpenVPM AI — Stop & Cleanup Script
 * Kills any hanging Node, Turbo, Next.js, or dev processes associated with OpenVPM AI
 * and frees up ports 3001, 3000, 3005, 4983, 5555.
 *
 * Safety: NEVER kills MCP servers, IDE processes, or the stop script itself.
 */

import { execSync, spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const ROOT_DIR_NORM = ROOT_DIR.toLowerCase().replace(/\\/g, "/");
const WORKSPACE_NAME = path.basename(ROOT_DIR).toLowerCase();

const TARGET_PORTS = [3001, 3000, 3005, 4983, 5555];

// Protected substrings: any process with these in its command line or path will NEVER be touched
const PROTECTED_PATTERNS = [
  "mcp",
  "antigravity",
  "agy",
  "gemini",
  "vscode",
  "cursor",
  "language-server",
  "stop.mjs",
  "scan-hardcoded-i18n",
];

function isProtected(commandLine, name) {
  if (!commandLine) return false;
  const lower = (commandLine + " " + (name || "")).toLowerCase();
  return PROTECTED_PATTERNS.some((p) => lower.includes(p));
}

function getProcessesHoldingPorts() {
  const pids = new Map(); // pid -> port

  if (process.platform === "win32") {
    try {
      const output = execSync("netstat -ano -p tcp", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      for (const line of output.split("\n")) {
        // Matches: TCP  0.0.0.0:3001  0.0.0.0:0  LISTENING  12345
        // or:      TCP  [::]:3001     [::]:0     LISTENING  12345
        const match = line.match(
          /\s*TCP\s+[\d.\[\]]+:(\d+)\s+[\d.\[\]*:]+\s+LISTENING\s+(\d+)/i
        );
        if (match) {
          const port = Number.parseInt(match[1], 10);
          const pid = Number.parseInt(match[2], 10);
          if (TARGET_PORTS.includes(port) && pid > 0 && pid !== process.pid) {
            pids.set(pid, port);
          }
        }
      }
    } catch {
      // Ignore netstat errors
    }
  } else {
    // POSIX
    try {
      const portArgs = TARGET_PORTS.join(",");
      const output = execSync(`lsof -iTCP:${portArgs} -sTCP:LISTEN -Fp`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      for (const line of output.split("\n")) {
        if (line.startsWith("p")) {
          const pid = Number.parseInt(line.slice(1), 10);
          if (pid > 0 && pid !== process.pid) {
            pids.set(pid, "dev-port");
          }
        }
      }
    } catch {
      // lsof returns 1 if nothing found
    }
  }

  return pids;
}

function getOpenVpmProcesses() {
  const processes = [];

  if (process.platform === "win32") {
    try {
      const psCommand = `Get-CimInstance Win32_Process -Filter "Name = 'node.exe' or Name = 'turbo.exe' or Name = 'next.exe' or Name = 'git.exe'" | Select-Object ProcessId, ParentProcessId, Name, CommandLine | ConvertTo-Json -Compress`;
      const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", psCommand], {
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
      });

      if (result.stdout) {
        const parsed = JSON.parse(result.stdout.trim());
        const list = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of list) {
          if (!item || !item.ProcessId) continue;
          processes.push({
            pid: item.ProcessId,
            ppid: item.ParentProcessId,
            name: item.Name,
            commandLine: item.CommandLine || "",
          });
        }
      }
    } catch {
      // Ignore CIM errors
    }
  } else {
    // POSIX
    try {
      const output = execSync("ps -eo pid,ppid,comm,args", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      for (const line of output.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("PID")) continue;
        const match = trimmed.match(/^(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/);
        if (match) {
          processes.push({
            pid: Number.parseInt(match[1], 10),
            ppid: Number.parseInt(match[2], 10),
            name: match[3],
            commandLine: match[4] || "",
          });
        }
      }
    } catch {
      // Ignore ps errors
    }
  }

  return processes;
}

function terminateProcess(pid) {
  if (process.platform === "win32") {
    try {
      execSync(`taskkill /F /T /PID ${pid}`, {
        stdio: ["ignore", "ignore", "ignore"],
      });
      return true;
    } catch {
      return false;
    }
  } else {
    try {
      process.kill(pid, "SIGTERM");
      return true;
    } catch {
      try {
        process.kill(pid, "SIGKILL");
        return true;
      } catch {
        return false;
      }
    }
  }
}

async function main() {
  console.log("\n==================================================");
  console.log("  🛑 OPENVPM AI — STOP & CLEANUP PROCESSES");
  console.log("==================================================\n");

  const portPids = getProcessesHoldingPorts();
  const allProcs = getOpenVpmProcesses();

  const toKill = new Map(); // pid -> { pid, name, reason }

  // 1. Target processes holding dev ports
  for (const [pid, port] of portPids) {
    if (pid === process.pid || pid === process.ppid) continue;
    const proc = allProcs.find((p) => p.pid === pid);
    const cmd = proc ? proc.commandLine : "";
    const name = proc ? proc.name : "unknown";

    if (isProtected(cmd, name)) {
      console.log(`[Safety Guard] Skipping protected process ${pid} (${name})`);
      continue;
    }

    toKill.set(pid, {
      pid,
      name,
      reason: `listening on port ${port}`,
    });
  }

  // 2. Target processes running from this workspace
  for (const proc of allProcs) {
    if (proc.pid === process.pid || proc.pid === process.ppid) continue;

    const cmd = proc.commandLine || "";
    const cmdNorm = cmd.toLowerCase().replace(/\\/g, "/");

    if (isProtected(cmd, proc.name)) continue;

    // Check if the command line references this workspace directory or name
    const isWorkspaceProc =
      cmdNorm.includes(ROOT_DIR_NORM) ||
      (cmdNorm.includes(WORKSPACE_NAME) &&
        (cmdNorm.includes("turbo") ||
          cmdNorm.includes("next") ||
          cmdNorm.includes("vitest") ||
          cmdNorm.includes("pnpm") ||
          cmdNorm.includes("tsx")));

    if (isWorkspaceProc) {
      if (!toKill.has(proc.pid)) {
        toKill.set(proc.pid, {
          pid: proc.pid,
          name: proc.name,
          reason: `workspace process (${proc.name})`,
        });
      }
    }
  }

  if (toKill.size === 0) {
    console.log("✓ No hanging OpenVPM AI processes found. All ports and services are clear.\n");
    return;
  }

  console.log(`Found ${toKill.size} process(es) to terminate:\n`);

  let killedCount = 0;
  for (const [pid, info] of toKill) {
    process.stdout.write(`  • Terminating PID ${pid} (${info.name}) [${info.reason}]... `);
    const success = terminateProcess(pid);
    if (success) {
      console.log("✓ Stopped");
      killedCount++;
    } else {
      console.log("⚠ Already exited or access denied");
    }
  }

  console.log(`\n✓ Cleanup complete! Terminated ${killedCount} process(es).\n`);
}

main().catch((err) => {
  console.error("Stop script failed:", err);
  process.exit(1);
});
