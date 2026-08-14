@echo off
echo Releasing 3080...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3080 ^| findstr LISTENING') do (
  echo Killing PID %%a
  taskkill /F /PID %%a /T >nul 2>&1
)
echo Done. Check:
netstat -ano | findstr :3080 | findstr LISTENING
if errorlevel 1 echo 3080 is free.
pause
