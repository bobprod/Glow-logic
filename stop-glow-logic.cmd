@echo off
setlocal

set "ROOT_DIR=%~dp0"
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%scripts\Stop-GlowLogic.ps1"

exit /b %errorlevel%
