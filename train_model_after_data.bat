@echo off
echo ========================================
echo Training Model with New Data
echo ========================================
echo.

echo Activating baseball-site conda environment...
call conda activate baseball-site

echo.
echo Training model with enhanced diversity features...
echo This will create diverse, reactive recommendations.
echo.

python train_model.py

echo.
echo ========================================
echo Model training complete!
echo ========================================
echo.
echo The model now ensures:
echo   - 3-5 diverse first pitch recommendations
echo   - Reactive suggestions that avoid repetition
echo   - Strategic recommendations based on count
echo.
pause

