import pandas as pd
import os

file_path = "strikeout_pitches_2019_2024.parquet"

if os.path.exists(file_path):
    df = pd.read_parquet(file_path)
    print(f"File exists: {file_path}")
    print(f"Rows: {len(df):,}")
    print(f"Columns: {len(df.columns)}")
    print(f"\nColumns: {', '.join(df.columns.tolist()[:15])}...")
    
    if 'game_date' in df.columns:
        print(f"\nDate range: {df['game_date'].min()} to {df['game_date'].max()}")
    
    if 'pitch_type' in df.columns:
        print(f"\nPitch types: {df['pitch_type'].nunique()}")
        print(df['pitch_type'].value_counts().head(10))
    
    file_info = os.stat(file_path)
    print(f"\nFile size: {file_info.st_size / (1024*1024):.2f} MB")
    print(f"Last modified: {file_info.st_mtime}")
else:
    print(f"File does not exist: {file_path}")

