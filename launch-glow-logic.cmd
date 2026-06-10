@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ╔══════════════════════════════════════════════════════════════════════╗
:: ║  GLOW LOGIC LAUNCHER v2.0                                            ║
:: ║  Système de contrôle de spectacle No-Code                             ║
:: ╚══════════════════════════════════════════════════════════════════════╝

set "ROOT_DIR=%~dp0"
set "ICO=%ROOT_DIR%assets\launcher-icon.ico"

title Glow Logic Launcher

:: Colors
set "c_reset= 0f"
set "c_cyan=   0b"
set "c_green=  0a"
set "c_yellow=0e"
set "c_red=   0c"
set "c_gray=  08"

color %c_cyan%
cls

echo.
echo    ██████╗ ██╗      ██╗      ██╗   ██╗     ██╗      ██████╗  ██████╗ ██╗ ██████╗
echo   ██╔════╝ ██║      ██║      ██║   ██║     ██║     ██╔═══██╗██╔════╝ ██║██╔════╝
echo   ██║  ███╗██║      ██║      ██║   ██║     ██║     ██║   ██║██║  ███╗██║██║     
echo   ██║   ██║██║      ██║      ██║   ██║     ██║     ██║   ██║██║   ██║██║██║     
echo   ╚██████╔╝███████╗ ███████╗ ╚██████╔╝     ███████╗╚██████╔╝╚██████╔╝██║╚██████╗
echo    ╚═════╝ ╚══════╝ ╚══════╝  ╚═════╝      ╚══════╝ ╚═════╝  ╚═════╝ ╚═╝ ╚═════╝
echo.
echo    ═════════════════════════════════════════════════════════════════════════════
echo.

:: Check if shortcut exists on desktop
set "DESKTOP=%USERPROFILE%\Desktop"
set "SHORTCUT=%DESKTOP%\Glow Logic.lnk"

if not exist "%SHORTCUT%" (
    color %c_yellow%
    echo    [INFO] Aucun raccourci bureau detecte.
    echo.
    echo    Options :
    echo      [1] Lancer maintenant (mode console - pour debug)
    echo      [2] Creer un raccourci bureau propre (RECOMMANDE)
    echo      [3] Lancer en mode silencieux (pas de console)
    echo.
    set /p choice="    Choix [1/2/3] : "

    if "!choice!"=="2" (
        echo.
        echo    Creation du raccourci...
        powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%scripts\Create-DesktopShortcut.ps1"
        echo.
        echo    Raccourci cree ! Tu peux maintenant fermer cette fenetre
        echo    et double-cliquer sur "Glow Logic" sur ton bureau.
        echo.
        pause
        exit /b 0
    )

    if "!choice!"=="3" (
        echo.
        echo    Lancement silencieux...
        start /b wscript.exe "%ROOT_DIR%launch-silent.vbs"
        timeout /t 2 /nobreak >nul
        exit /b 0
    )

    :: Default: continue with console mode
    echo.
    echo    Lancement en mode console...
    echo.
)

color %c_cyan%

:: Launch via PowerShell
echo    [Launch] Demarrage des services...
echo.

powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%scripts\Launch-GlowLogic.ps1"

if %errorlevel% neq 0 (
    color %c_red%
    echo.
    echo    [ERREUR] Le demarrage a echoue. Code: %errorlevel%
    echo.
    pause
)

exit /b %errorlevel%
