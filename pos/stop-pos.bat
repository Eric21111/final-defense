@echo off
echo Stopping POS System...
taskkill /F /IM node.exe /T
echo.
echo All POS servers have been stopped.
timeout /t 3
