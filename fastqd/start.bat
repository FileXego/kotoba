@echo off
echo Starting Kotoba...

:: Open backend terminal
start "Kotoba - Backend" cmd /k "cd /d D:\my-app && bun run dev"

:: Open frontend terminal  
start "Kotoba - Frontend" cmd /k "cd /d D:\my-app\client && bun run dev"

:: Wait for servers to start, then open browser
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo Done! Backend :3000  Frontend :5173
