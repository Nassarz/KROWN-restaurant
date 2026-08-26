@echo off
title KROWN ERP - Print Bridge Daemon
echo =============================================
echo   KROWN ERP - Thermal Printer Bridge
echo =============================================
echo.
echo Starting print bridge daemon...
echo Receipt Printer : USB (auto-detected)
echo Kitchen Printer : 192.168.1.34:9100 (LAN)
echo.

node "%~dp0krown-print-bridge.mjs" ^
  --url https://pvtyioofmwucykctbohc.supabase.co ^
  --key eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2dHlpb29mbXd1Y3lrY3Rib2hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyODQyNiwiZXhwIjoyMTAxMDA0NDI2fQ.Aas5U-VWuAe2ooTR35sekveIXj4-EPUyZyJvs1-yicc ^
  --receipt-usb ^
  --kitchen-ip 192.168.1.34 ^
  --kitchen-port 9100

echo.
echo [ERROR] Print bridge stopped unexpectedly. Restarting in 5 seconds...
timeout /t 5
goto :start
