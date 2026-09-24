@echo off
title Agno Development Pipeline Team

echo [1/3] Starting Windows Chrome CDP Bridge on port 9222...
powershell -Command "if (-not (Get-NetTCPConnection -LocalPort 9222 -ErrorAction SilentlyContinue)) { Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList 'C:\Users\marek\cdp-bridge.js' -WindowStyle Hidden; Write-Host 'CDP Bridge started on port 9222.' } else { Write-Host 'CDP Bridge is already running on port 9222.' }"

echo [2/3] Checking YesDev auto-approver for Chrome 144+...
powershell -Command "if (-not (Get-Process -Name powershell | Where-Object { $_.CommandLine -like '*yes-dev*' })) { Start-Process -FilePath powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File C:\Users\marek\yes-dev\watcher.ps1' -WindowStyle Hidden; Write-Host 'YesDev auto-approver started.' } else { Write-Host 'YesDev auto-approver is already running.' }"

echo [3/3] Starting Agno AgentOS Team in persistent WSL tmux session 'agno'...
wsl -d Ubuntu -e bash -c "tmux has-session -t agno 2>/dev/null || tmux new-session -d -s agno 'cd /home/ubuntu/agno && python3 pipeline_team_os.py'; echo 'Agno AgentOS is active in tmux session [agno] on http://127.0.0.1:7777'"

echo.
echo ============================================================
echo   Agno Pipeline Team is RUNNING!
echo   AgentOS UI: http://127.0.0.1:7777
echo   CDP Bridge: http://127.0.0.1:9222
echo   To attach to tmux: wsl -d Ubuntu tmux attach -t agno
echo ============================================================
pause
