@echo off
:: ============================================================
:: KROWN ERP - Register Print Bridge as Windows Startup Task
:: Run this ONCE as Administrator on the Cashier PC
:: ============================================================

echo [KROWN SETUP] Registering print bridge as Windows startup task...

:: Get the directory where this script lives
set SCRIPT_DIR=%~dp0
set BAT_FILE=%SCRIPT_DIR%start-print-bridge.bat

:: Delete old task if it exists
schtasks /delete /tn "KROWN-PrintBridge" /f >nul 2>&1

:: Create new task: runs at logon, hidden window, as current user
schtasks /create ^
  /tn "KROWN-PrintBridge" ^
  /tr "cmd.exe /c \"%BAT_FILE%\"" ^
  /sc ONLOGON ^
  /rl HIGHEST ^
  /f

if %errorlevel% == 0 (
  echo.
  echo [SUCCESS] KROWN Print Bridge will now start automatically on login!
  echo.
  echo Starting it now for this session...
  start "" /min cmd.exe /c "%BAT_FILE%"
  echo [DONE] Daemon started in background.
) else (
  echo [ERROR] Failed to register task. Make sure you ran this as Administrator.
)

pause
