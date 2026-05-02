@echo off
setlocal

set "ROOT_DIR=%~dp0"

powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%scripts\Launch-GlowLogic.ps1"

if %errorlevel% neq 0 (
    echo.
    echo  [ERREUR] Le launcher a quitte avec le code %errorlevel%
    echo  Verifiez que Node.js est installe et que le projet est intact.
    pause
)

exit /b %errorlevel%
