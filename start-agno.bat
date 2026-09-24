@echo off
title Agno Development Pipeline Team

echo [1/2] Verifying Linux Chrome CDP on 127.0.0.1:9222...
wsl -d Ubuntu -e bash -c "curl -s -m 2 http://127.0.0.1:9222/json/version >/dev/null && echo 'Linux Chrome CDP is ACTIVE on port 9222.' || echo 'WARNING: Linux Chrome CDP not responding on 9222. Start it with ag-chrome in WSL.'"

echo [2/2] Restarting Agno AgentOS Team in persistent WSL tmux session 'agno'...
wsl -d Ubuntu -e bash -c "tmux kill-session -t agno 2>/dev/null; tmux new-session -d -s agno 'cd /home/ubuntu/agno && .venv/bin/python pipeline_team_os.py 2>&1 | tee /tmp/agno_os.log'; echo 'Agno AgentOS is active in tmux session [agno] on http://127.0.0.1:7777'"

echo.
echo ============================================================
echo   Agno Pipeline Team is RUNNING (Hardened V2)!
echo   AgentOS UI: http://127.0.0.1:7777
echo   CDP Target: http://127.0.0.1:9222
echo   Logs: /tmp/agno_os.log
echo   To attach to tmux: wsl -d Ubuntu tmux attach -t agno
echo ============================================================
pause
