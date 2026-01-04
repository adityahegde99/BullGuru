@echo off
echo ========================================
echo Bullpen Trainer Setup
echo ========================================
echo.

echo Activating baseball-site conda environment...
call conda activate baseball-site

echo.
echo Checking if model is trained...
if not exist "public\model_data.json" (
    echo Model not found. Training model...
    echo This may take a few minutes...
    python train_model.py
    echo.
) else (
    echo Model file found!
    echo.
)

echo Installing/updating npm dependencies...
call npm install

echo.
echo ========================================
echo Starting development server...
echo ========================================
echo.
echo The app will be available at: http://localhost:3000
echo Press Ctrl+C to stop the server
echo.

npm run dev

pause

