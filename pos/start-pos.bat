@echo off
title Starting POS System...

:: 1. Start MongoDB (Silent check)
net start MongoDB >nul 2>&1

:: 2. Start Backend (Minimized)
cd backend
IF NOT EXIST "node_modules" (
    echo First time run detected. Installing backend dependencies...
    call npm install --legacy-peer-deps
)
start /min "POS Backend Server" cmd /k "npm start"
cd ..

:: 3. Start Frontend (Minimized)
cd frontend
IF NOT EXIST "node_modules" (
    echo First time run detected. Installing frontend dependencies...
    call npm install --legacy-peer-deps
)
start /min "POS Frontend Server" cmd /k "npm run dev"
cd ..

:: 4. Open Browser
timeout /t 4 >nul
start http://localhost:5173

:: 5. Close this launcher window immediately
exit
