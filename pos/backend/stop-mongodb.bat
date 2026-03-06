@echo off
echo ========================================
echo Stopping MongoDB for POS System...
echo ========================================

REM Stop all MongoDB processes
taskkill /F /IM mongod.exe 2>nul

if %ERRORLEVEL%==0 (
    echo MongoDB stopped successfully!
) else (
    echo MongoDB was not running or already stopped.
)

timeout /t 2 >nul
echo.

