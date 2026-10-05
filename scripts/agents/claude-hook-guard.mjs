#!/usr/bin/env node
// Guard hook for Claude Code PreToolUse and developer safety checks
import fs from 'node:fs';

let input = '';
try {
  input = fs.readFileSync(0, 'utf8');
} catch {
  process.exit(0);
}

if (!input || !input.trim()) {
  process.exit(0);
}

try {
  const data = JSON.parse(input);
  const tool = data.tool || data.name || '';
  const toolInput = data.input || data.parameters || {};

  if (tool === 'Bash') {
    const cmd = toolInput.command || '';
    // 1. Block staging of env files, local agent secrets, or mcp config
    if (/\bgit\s+add\b.*(\.env|AGENTS\.local|\.mcp\.json)/i.test(cmd)) {
      console.error('BLOCKED by claude-hook-guard: Never stage .env*, AGENTS.local.md, or .mcp.json');
      process.exit(1);
    }
    // 2. Block psql to template database openpims
    if (/psql.*-d\s+openpims\b/i.test(cmd) && !/openvpm_ai/i.test(cmd)) {
      console.error('BLOCKED by claude-hook-guard: Never query template DB "openpims". Use "-d openvpm_ai".');
      process.exit(1);
    }
    // 3. Block unreviewed destructive commands on staging or production
    if (/dokploy|production|staging/i.test(cmd) && /(drop\s+database|drop\s+table|truncate)/i.test(cmd)) {
      console.error('BLOCKED by claude-hook-guard: Destructive database operation on remote target requires explicit authorization.');
      process.exit(1);
    }
  }

  if (tool === 'FileEdit' || tool === 'FileWrite') {
    const filePath = toolInput.path || toolInput.file_path || '';
    if (filePath.replace(/\\/g, '/').includes('packages/db/drizzle/')) {
      console.error('BLOCKED by claude-hook-guard: Direct edits under packages/db/drizzle/ are forbidden. Use pnpm db:generate.');
      process.exit(1);
    }
  }
} catch {
  // Safely continue if payload cannot be parsed
}

process.exit(0);
