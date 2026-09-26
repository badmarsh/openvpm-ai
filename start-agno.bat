@echo off
title Agno Development Pipeline Team
rem Delegates to start-agno.ps1 (the real launcher: probe, configure, sync, verify).
rem Usage: start-agno.bat [-SkipTunnelCheck] [-HealthTimeoutSec 60] ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-agno.ps1" %*
echo.
pause
