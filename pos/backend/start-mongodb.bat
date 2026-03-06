@echo off
echo ========================================
echo Starting MongoDB for POS System...
echo ========================================

REM MongoDB location - adjust if you moved it
set MONGODB_PATH=%USERPROFILE%\Downloads\mongodb-windows-x86_64-8.2.1\mongodb-win32-x86_64-windows-8.2.1

REM Create data directory if it doesn't exist
if not exist "%MONGODB_PATH%\data\db" (
    echo Creating data directory...
    mkdir "%MONGODB_PATH%\data\db"
)

REM Create logs directory if it doesn't exist
if not exist "%MONGODB_PATH%\logs" (
    echo Creating logs directory...
    mkdir "%MONGODB_PATH%\logs"
)

echo Starting MongoDB on port 27017...
echo.

REM Start MongoDB
cd /d "%MONGODB_PATH%\bin"
mongod.exe --dbpath "%MONGODB_PATH%\data\db" --logpath "%MONGODB_PATH%\logs\mongodb.log" --logappend --journal

pause

