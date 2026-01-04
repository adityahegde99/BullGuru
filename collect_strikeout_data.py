"""
Collect all pitches from strikeout at-bats using pybaseball.
This script fetches comprehensive pitch data for training the ML model.
"""
import warnings
warnings.simplefilter(action='ignore', category=FutureWarning)

from pybaseball import statcast
import pandas as pd
from datetime import date, timedelta
import os

# -----------------------------
# ZONE MAPPING FUNCTION
# -----------------------------
def plate_coords_to_zone(plate_x, plate_z):
    """
    Convert plate_x and plate_z to zone number (1-25)
    
    Strike zone (9 squares):
    1  2  3     (top row)
    4  5  6     (middle row)
    7  8  9     (bottom row)
    
    Ball zones (16 squares around strike zone):
    10 11 12 13 14    (high)
    15          16    (left/right)
    17          18    (left/right)
    19          20    (left/right)
    21 22 23 24 25    (low)
    """
    # Handle missing values
    if pd.isna(plate_x) or pd.isna(plate_z):
        return None
    
    # Approximate strike zone boundaries
    sz_left = -0.83   # Left edge
    sz_right = 0.83   # Right edge
    sz_top = 3.5      # Top edge
    sz_bottom = 1.5   # Bottom edge
    
    # Determine if in strike zone
    in_strike_x = sz_left <= plate_x <= sz_right
    in_strike_z = sz_bottom <= plate_z <= sz_top
    
    if in_strike_x and in_strike_z:
        # STRIKE ZONE (1-9)
        # Divide into 3x3 grid
        x_third = (sz_right - sz_left) / 3
        z_third = (sz_top - sz_bottom) / 3
        
        # Column (0=left, 1=middle, 2=right)
        if plate_x < sz_left + x_third:
            col = 0
        elif plate_x < sz_left + 2*x_third:
            col = 1
        else:
            col = 2
        
        # Row (0=top, 1=middle, 2=bottom)
        if plate_z > sz_bottom + 2*z_third:
            row = 0
        elif plate_z > sz_bottom + z_third:
            row = 1
        else:
            row = 2
        
        return row * 3 + col + 1  # Returns 1-9
    
    else:
        # BALL ZONE (10-25)
        # High zone (10-14)
        if plate_z > sz_top:
            if plate_x < sz_left:
                return 10  # High-left
            elif plate_x < sz_left + (sz_right - sz_left) / 3:
                return 11  # High-left-center
            elif plate_x < sz_left + 2*(sz_right - sz_left) / 3:
                return 12  # High-center
            elif plate_x < sz_right:
                return 13  # High-right-center
            else:
                return 14  # High-right
        
        # Low zone (21-25)
        elif plate_z < sz_bottom:
            if plate_x < sz_left:
                return 21  # Low-left
            elif plate_x < sz_left + (sz_right - sz_left) / 3:
                return 22  # Low-left-center
            elif plate_x < sz_left + 2*(sz_right - sz_left) / 3:
                return 23  # Low-center
            elif plate_x < sz_right:
                return 24  # Low-right-center
            else:
                return 25  # Low-right
        
        # Left side (15, 17, 19)
        elif plate_x < sz_left:
            z_third = (sz_top - sz_bottom) / 3
            if plate_z > sz_bottom + 2*z_third:
                return 15  # Left-top
            elif plate_z > sz_bottom + z_third:
                return 17  # Left-middle
            else:
                return 19  # Left-bottom
        
        # Right side (16, 18, 20)
        else:  # plate_x > sz_right
            z_third = (sz_top - sz_bottom) / 3
            if plate_z > sz_bottom + 2*z_third:
                return 16  # Right-top
            elif plate_z > sz_bottom + z_third:
                return 18  # Right-middle
            else:
                return 20  # Right-bottom

# -----------------------------
# DATA COLLECTION
# -----------------------------
print("="*60)
print("COLLECTING STRIKEOUT PITCH DATA")
print("="*60)
print("\nThis script collects all pitches from at-bats that ended in strikeouts.")
print("It will fetch data from multiple seasons and may take a while.\n")

# Years to collect data from
years = ["2019", "2020", "2021", "2022", "2023", "2024"]
all_data = []

# Collect data year by year, month by month to avoid timeouts
for year in years:
    print(f"\n{'='*60}")
    print(f"Collecting {year} season data...")
    print(f"{'='*60}")
    
    # Collect full season (March to October)
    start_date = date(int(year), 3, 1)
    end_date = date(int(year), 10, 31)
    current = start_date
    
    month_count = 0
    while current <= end_date:
        chunk_end = current + timedelta(days=30)
        if chunk_end > end_date:
            chunk_end = end_date
        
        month_count += 1
        print(f"  Month {month_count}: {current.strftime('%Y-%m-%d')} to {chunk_end.strftime('%Y-%m-%d')}")
        
        try:
            chunk_data = statcast(current.strftime("%Y-%m-%d"), chunk_end.strftime("%Y-%m-%d"))
            
            if chunk_data is not None and len(chunk_data) > 0:
                all_data.append(chunk_data)
                print(f"    ✓ Collected {len(chunk_data):,} pitches")
            else:
                print(f"    ⚠ No data for this period")
                
        except Exception as e:
            print(f"    ✗ Error: {e}")
            print(f"    Continuing to next period...")
        
        current = chunk_end + timedelta(days=1)
        
        # Small delay to avoid rate limiting
        import time
        time.sleep(1)

# Combine all data
print(f"\n{'='*60}")
print("Processing collected data...")
print(f"{'='*60}")

if len(all_data) == 0:
    print("✗ No data collected. Please check your internet connection and try again.")
    exit(1)

df = pd.concat(all_data, ignore_index=True)
print(f"Total pitches collected: {len(df):,}")

# Filter to at-bats that ended in strikeout
print("\nFiltering to strikeout at-bats...")
strikeout_events = ['strikeout', 'strikeout_swinging', 'strikeout_looking', 'strikeout_double_play']
strikeout_atbats = df[df['events'].isin(strikeout_events)][
    ['game_date', 'pitcher', 'batter', 'at_bat_number']
].drop_duplicates()

print(f"Found {len(strikeout_atbats):,} strikeout at-bats")

# Merge to get all pitches in those strikeout at-bats
full_strikeout_pitches = df.merge(
    strikeout_atbats,
    on=['game_date', 'pitcher', 'batter', 'at_bat_number'],
    how='inner'
)

print(f"Total pitches in strikeout at-bats: {len(full_strikeout_pitches):,}")

# Sort by pitch sequence
full_strikeout_pitches.sort_values(
    ['game_date', 'pitcher', 'batter', 'at_bat_number', 'pitch_number'],
    inplace=True
)

# -----------------------------
# SELECT RELEVANT COLUMNS
# -----------------------------
print("\nSelecting relevant columns for training...")

# Core columns needed for training
columns_to_keep = [
    # Identification
    'game_date',
    'pitcher',
    'batter',
    'at_bat_number',
    'pitch_number',
    
    # Pitch characteristics
    'pitch_type',
    'pitch_name',
    'release_speed',
    'release_pos_x',
    'release_pos_z',
    'release_extension',
    'release_spin_rate',
    'release_spin_direction',
    
    # Location
    'plate_x',
    'plate_z',
    'sz_top',
    'sz_bot',
    
    # Batter/Pitcher info
    'stand',           # Batter stance (L/R)
    'p_throws',        # Pitcher throws (L/R)
    
    # Count
    'balls',
    'strikes',
    
    # Outcome
    'type',            # S (strike) or B (ball)
    'description',     # called_strike, swinging_strike, ball, etc.
    'events',          # strikeout, etc.
    
    # Additional metrics that might be useful
    'delta_home_win_exp',
    'delta_run_exp',
    'launch_speed',
    'launch_angle',
    'estimated_ba_using_speedangle',
    'estimated_slg_using_speedangle',
    'woba_value',
    'woba_denom',
    'babip_value',
    'iso_value',
    'launch_speed_angle',
    'at_bat_number',
    'pitch_name',
    'home_score',
    'away_score',
    'inning',
    'inning_topbot',
    'outs_when_up'
]

# Keep only columns that exist in the dataframe
available_columns = [col for col in columns_to_keep if col in full_strikeout_pitches.columns]
full_strikeout_pitches = full_strikeout_pitches[available_columns]

print(f"Keeping {len(available_columns)} columns")
print(f"Columns: {', '.join(available_columns[:10])}...")

# -----------------------------
# ADD ZONE COLUMN
# -----------------------------
print("\nCalculating pitch zones (1-25)...")
full_strikeout_pitches['zone'] = full_strikeout_pitches.apply(
    lambda row: plate_coords_to_zone(row['plate_x'], row['plate_z']), 
    axis=1
)

# Show zone distribution
print("\nZone distribution:")
zone_counts = full_strikeout_pitches['zone'].value_counts().sort_index()
print(zone_counts.head(15))

# Drop rows with missing zones
before_drop = len(full_strikeout_pitches)
full_strikeout_pitches = full_strikeout_pitches.dropna(subset=['zone'])
full_strikeout_pitches['zone'] = full_strikeout_pitches['zone'].astype(int)
after_drop = len(full_strikeout_pitches)
print(f"\nDropped {before_drop - after_drop} rows with missing location data")
print(f"Final dataset: {len(full_strikeout_pitches):,} pitches")

# -----------------------------
# DATA QUALITY CHECKS
# -----------------------------
print("\n" + "="*60)
print("DATA QUALITY SUMMARY")
print("="*60)

print(f"\nTotal pitches: {len(full_strikeout_pitches):,}")
print(f"Unique at-bats: {full_strikeout_pitches.groupby(['game_date', 'pitcher', 'at_bat_number']).ngroups:,}")
print(f"Date range: {full_strikeout_pitches['game_date'].min()} to {full_strikeout_pitches['game_date'].max()}")

print(f"\nPitch type distribution:")
pitch_dist = full_strikeout_pitches['pitch_type'].value_counts()
for pitch, count in pitch_dist.head(10).items():
    pct = (count / len(full_strikeout_pitches)) * 100
    print(f"  {pitch}: {count:,} ({pct:.1f}%)")

print(f"\nZone breakdown:")
strike_zones = full_strikeout_pitches[full_strikeout_pitches['zone'] <= 9]
ball_zones = full_strikeout_pitches[full_strikeout_pitches['zone'] > 9]
print(f"  Strike zones (1-9): {len(strike_zones):,} ({len(strike_zones)/len(full_strikeout_pitches)*100:.1f}%)")
print(f"  Ball zones (10-25): {len(ball_zones):,} ({len(ball_zones)/len(full_strikeout_pitches)*100:.1f}%)")

print(f"\nMatchup distribution:")
matchups = full_strikeout_pitches.groupby(['stand', 'p_throws']).size()
for (stand, p_throws), count in matchups.items():
    print(f"  {stand}B vs {p_throws}P: {count:,}")

# -----------------------------
# SAVE DATA
# -----------------------------
output_file = "strikeout_pitches_2019_2024.parquet"
print(f"\n{'='*60}")
print(f"Saving to {output_file}...")
print(f"{'='*60}")

full_strikeout_pitches.to_parquet(output_file, index=False, compression='snappy')

print(f"\n✓ Successfully saved {len(full_strikeout_pitches):,} pitches to {output_file}")
print(f"  File size: {os.path.getsize(output_file) / (1024*1024):.2f} MB")

print("\n" + "="*60)
print("DATA COLLECTION COMPLETE!")
print("="*60)
print(f"\nNext steps:")
print(f"  1. Run: python train_model.py")
print(f"  2. This will create the model for the web app")
print("="*60)

