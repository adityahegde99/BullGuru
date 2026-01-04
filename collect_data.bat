@echo off
echo ========================================
echo Collecting Strikeout Pitch Data
echo ========================================
echo.
echo This will fetch data from 2019-2024
echo WARNING: This takes several hours!
echo.
pause

echo Activating baseball-site conda environment...
call conda activate baseball-site

echo.
echo Installing data collection dependencies...
pip install -r requirements_data_collection.txt

echo.
echo Starting data collection...
echo This may take several hours. Please be patient.
echo.

python collect_strikeout_data.py

echo.
echo ========================================
echo Data collection complete!
echo ========================================
pause

