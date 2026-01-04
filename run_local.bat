@echo off
echo Activating baseball-site conda environment...
call conda activate baseball-site

echo.
echo Starting Bullpen Trainer development server...
echo.
echo The app will be available at: http://localhost:3000
echo Press Ctrl+C to stop the server
echo.

cd /d %~dp0
npm run dev

pause

