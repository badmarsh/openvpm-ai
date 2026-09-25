@echo off
title Agno Development Pipeline Team
setlocal

REM Repository-side source of truth for the Agno runtime.
set "REPO_AGNO=%~dp0.agents\agno"
set "WSL_AGNO=/home/ubuntu/agno"

echo ============================================================
echo   Agno Pipeline Team - launcher
echo ============================================================
echo.

echo [1/4] Verifying Linux Chrome CDP on 127.0.0.1:9222...
wsl -d Ubuntu -e bash -c "curl -s -m 2 http://127.0.0.1:9222/json/version >/dev/null && echo '  Linux Chrome CDP is ACTIVE on port 9222.' || echo '  WARNING: Linux Chrome CDP not responding on 9222. Start it with ag-chrome in WSL.'"

echo.
echo [2/4] Syncing repository Agno sources into WSL...
echo       repo: %REPO_AGNO%
echo       wsl:  %WSL_AGNO%
REM IMPORTANT: the runtime executes WSL:%WSL_AGNO%/pipeline_team_os.py, which is a
REM SEPARATE COPY from the one in this repository. Without this step, patching the
REM repo changes nothing about behaviour. That is how the two copies previously
REM drifted (see commit deae63e "chore(agno): sync pipeline_tools.py").
wsl -d Ubuntu -e bash -c "SRC=$(wslpath -a '%REPO_AGNO%' 2>/dev/null); if [ ! -d \"$SRC\" ]; then echo '  ERROR: source not found:' \"$SRC\"; exit 1; fi; mkdir -p %WSL_AGNO%; cp -fv \"$SRC\"/*.py %WSL_AGNO%/ 2>/dev/null; cp -fv \"$SRC\"/*.ts %WSL_AGNO%/ 2>/dev/null; echo '  sync done'"

echo.
echo [3/4] Restarting Agno AgentOS Team in persistent WSL tmux session 'agno'...
wsl -d Ubuntu -e bash -c "tmux kill-session -t agno 2>/dev/null; tmux new-session -d -s agno 'cd /home/ubuntu/agno && .venv/bin/python pipeline_team_os.py 2>&1 | tee /tmp/agno_os.log'; echo '  started in tmux session [agno]'"

echo.
echo [4/4] Health check (loopback)...
wsl -d Ubuntu -e bash -c "sleep 4; curl -s -m 3 http://127.0.0.1:7777/health || echo '  (no response yet - check WSL:/tmp/agno_os.log)'"
echo.

echo ============================================================
echo   Agno Pipeline Team is RUNNING
echo.
echo   AgentOS UI:  http://127.0.0.1:7777
echo   CDP target:  http://127.0.0.1:9222
echo   Logs:        WSL:/tmp/agno_os.log
echo   tmux:        wsl -d Ubuntu tmux attach -t agno
echo.
echo   TUNNEL - start in a separate terminal:
echo     cloudflared tunnel --config C:\Users\marek\.cloudflared\tunnels\agentos-tunnel.yml run agentos-tunnel
echo.
echo   Verify ingress BEFORE starting (must say http://127.0.0.1:7777):
echo     cloudflared tunnel ingress validate
echo     cloudflared tunnel ingress rule https://agentos-tunnel.significa.sk/health
echo.
echo   REMINDER: 0.0.0.0 is a BIND address (correct for OPENVPM_AGENTOS_HOST),
echo   never a DIAL target. See CLOUDFLARE_TUNNEL.md.
echo ============================================================
endlocal
pause
