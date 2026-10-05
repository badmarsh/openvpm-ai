---
name: mem0-session-handoff
description: Save and restore working context through the mem0 MCP memory server to preserve context across quota/usage-limit cutoffs and account switches. Use SAVE mode when the user mentions quota limits or account switches, and RESTORE mode when resuming work if mem0 is available.
---

# mem0 Session Handoff

Goal: before usage limits or account switches interrupt work, park the current context and findings in mem0; when starting a new session with mem0 configured, restore them to continue seamlessly.

## Setup

- **Project name:** `openvpm-ai`
- **User partition:** `marek`
- mem0 tools: `mem0_status`, `mem0_get_context`, `mem0_search`, `mem0_remember`, `mem0_list_memories`. If mem0 tools are unavailable, this skill is optional and can be skipped or printed as text in chat.
- **Never store secrets:** API keys, passwords, database credentials, or contents of `.env*` must never be stored in mem0.

## SAVE mode (before quota expires or session ends)

Save a checkpoint when the user signals a quota limit, when switching accounts, or after a major milestone:

1. Check `mem0_status`. If unreachable, print the summary in chat for the user to copy.
2. Collect context: `git branch --show-current`, `git status --short`, recent commits, uncommitted work, and active task status.
3. Save atomic memories using `mem0_remember` with tag `[HANDOFF][openvpm-ai][<YYYY-MM-DD>]`:
   - `GOAL` - concrete objective of the current task
   - `DONE` - completed milestones, changed files, committed hashes
   - `DECISIONS` - key architectural or domain decisions made
   - `FINDINGS` - discovered constraints, bugs, working commands
   - `STATE` - current branch and git state
   - `OPEN` - pending work or blockers
   - `NEXT` - immediate next step to execute
4. Confirm what was saved to the user.

## RESTORE mode (resuming a session)

Use when resuming work in a new session where mem0 is configured:

1. Check `mem0_status`. If unavailable, continue without handoff.
2. Query `mem0_get_context` or `mem0_search` with query `"[HANDOFF][openvpm-ai]"`.
3. Compare restored `STATE` against actual git status (`git status --short`, `git log -3 --oneline`).
4. Briefly summarize to the user: checkpoint date, finished work, open tasks, and proposed next step.
