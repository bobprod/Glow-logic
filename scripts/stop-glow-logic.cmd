@echo off
setlocal EnableExtensions

set PORTS=3000 3005 9999 57121

echo.
echo   GLOW LOGIC - Stop services
echo   ==========================
echo.

for %%P in (%PORTS%) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr /R /C:":%%P .*LISTENING"') do (
    if not "%%A"=="0" (
      taskkill /PID %%A /T /F >nul 2>nul
      if not errorlevel 1 echo   [OK] Port %%P libere \(PID %%A\)
    )
  )
)

wmic process where "CommandLine like '%%dmx_bridge.py%%'" call terminate >nul 2>nul
if not errorlevel 1 echo   [OK] Pont DMX Python arrete

taskkill /IM qlcplus.exe /F >nul 2>nul
if not errorlevel 1 echo   [OK] QLC+ arrete

echo.
echo   Stop termine.
echo.

endlocal
