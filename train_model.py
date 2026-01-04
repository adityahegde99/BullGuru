"""
Train a lightweight ML model for pitch recommendations.
This creates a model optimized for Vercel serverless functions.
Enhanced to remove pitch bias and find optimal locations.
"""
import numpy as np
import pandas as pd
import json
from collections import defaultdict, Counter
from sklearn.preprocessing import LabelEncoder
import os

print("="*60)
print("TRAINING BULLPEN TRAINING MODEL")
print("Enhanced for Diverse, Unbiased Recommendations")
print("="*60)

# Load data
print("\nLoading strikeout pitches data...")
df = pd.read_parquet("strikeout_pitches_2019_2024.parquet")
print(f"Loaded {len(df):,} pitches")

# Clean data
required_cols = ['pitch_type', 'description', 'stand', 'p_throws', 'type', 
                 'balls', 'strikes', 'pitch_number', 'zone']
df = df.dropna(subset=required_cols)
df['pitch_number'] = pd.to_numeric(df['pitch_number'], errors='coerce').fillna(1).astype(int)
df['zone'] = df['zone'].astype(int)

print(f"After cleaning: {len(df):,} pitches")

# Create encoders
le_pitch = LabelEncoder()
le_pitch.fit(df['pitch_type'])

le_desc = LabelEncoder()
le_desc.fit(df['description'])

# Calculate pitch type frequencies for normalization
print("\nCalculating pitch type frequencies for bias removal...")
pitch_type_counts = df['pitch_type'].value_counts().to_dict()
total_pitches = len(df)
pitch_type_freq = {pt: count / total_pitches for pt, count in pitch_type_counts.items()}
print(f"Pitch type distribution:")
for pt, count in sorted(pitch_type_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
    freq = pitch_type_freq.get(pt, 0)
    print(f"  {pt}: {count:,} ({freq*100:.1f}%)")

# Build recommendation patterns from successful sequences
print("\nAnalyzing successful pitch sequences...")
success_patterns = defaultdict(lambda: defaultdict(int))

# First pitch patterns - track by pitch type and find optimal zones
first_pitch_by_type = defaultdict(lambda: defaultdict(int))  # pitch_type -> zone -> count
first_pitch_patterns = defaultdict(lambda: Counter())

# Optimal zones for each pitch type (where they're most effective)
optimal_zones_by_pitch = defaultdict(lambda: defaultdict(float))  # pitch_type -> zone -> effectiveness_score

# Count patterns by situation for fallback
count_patterns = defaultdict(lambda: defaultdict(int))
matchup_patterns = defaultdict(lambda: defaultdict(int))

grouped = df.groupby(['game_date', 'pitcher', 'at_bat_number'])

atbat_count = 0
for _, atbat in grouped:
    atbat = atbat.sort_values('pitch_number')
    if len(atbat) < 1:
        continue
    
    atbat_count += 1
    
    for i, row in atbat.iterrows():
        count_key = f"{int(row['balls'])}-{int(row['strikes'])}"
        matchup_key = f"{row['stand']}-{row['p_throws']}"
        pitch_num = int(row['pitch_number'])
        pitch_type = row['pitch_type']
        zone = int(row['zone'])
        pitch_zone = f"{pitch_type}-{zone}"
        
        # First pitch patterns - track by pitch type for optimal zone finding
        if pitch_num == 1:
            first_pitch_context = f"{matchup_key}|{count_key}"
            first_pitch_patterns[first_pitch_context][pitch_zone] += 1
            first_pitch_by_type[pitch_type][zone] += 1
        
        # Build context for sequence-based patterns
        if pitch_num > 1:
            prev_pitches = atbat[atbat['pitch_number'] < pitch_num]['pitch_type'].tolist()
            sequence_key = '-'.join(prev_pitches[-2:])
        else:
            sequence_key = 'first'
        
        context_key = f"{matchup_key}|{count_key}|{sequence_key}|p{pitch_num}"
        success_patterns[context_key][pitch_zone] += 1
        
        # Store count and matchup patterns for fallbacks
        count_patterns[count_key][pitch_zone] += 1
        matchup_patterns[matchup_key][pitch_zone] += 1

print(f"Processed {atbat_count:,} strikeout at-bats")
print(f"Created {len(success_patterns):,} context patterns")
print(f"Created {len(first_pitch_patterns):,} first pitch patterns")

# Calculate optimal zones for each pitch type (normalized by frequency)
print("\nCalculating optimal zones for each pitch type...")
for pitch_type, zone_counts in first_pitch_by_type.items():
    total_for_pitch = sum(zone_counts.values())
    if total_for_pitch > 0:
        # Calculate effectiveness: normalized by pitch frequency to remove bias
        base_freq = pitch_type_freq.get(pitch_type, 0.01)  # Avoid division by zero
        for zone, count in zone_counts.items():
            # Effectiveness = (usage in successful sequences) / (overall frequency)
            # Higher score = more effective relative to how common the pitch is
            effectiveness = (count / total_for_pitch) / max(base_freq, 0.01)
            optimal_zones_by_pitch[pitch_type][zone] = effectiveness

# Convert to JSON-serializable format
patterns_dict = {}
for context, pitches in success_patterns.items():
    patterns_dict[context] = {k: int(v) for k, v in dict(pitches).items()}

# Convert first pitch patterns
first_pitch_dict = {}
for context, counter in first_pitch_patterns.items():
    first_pitch_dict[context] = {k: int(v) for k, v in dict(counter).items()}

# Convert optimal zones (normalized effectiveness scores)
optimal_zones_dict = {}
for pitch_type, zones in optimal_zones_by_pitch.items():
    optimal_zones_dict[pitch_type] = {str(k): float(v) for k, v in zones.items()}

# Convert fallback patterns
count_patterns_dict = {}
for count_key, pitches in count_patterns.items():
    count_patterns_dict[count_key] = {k: int(v) for k, v in dict(pitches).items()}

matchup_patterns_dict = {}
for matchup_key, pitches in matchup_patterns.items():
    matchup_patterns_dict[matchup_key] = {k: int(v) for k, v in dict(pitches).items()}

# Save model files
print("\nSaving model files...")

# Save encoders
encoders = {
    'pitch_types': [str(x) for x in le_pitch.classes_.tolist()],
    'descriptions': [str(x) for x in le_desc.classes_.tolist()],
    'pitch_encoder': {str(k): int(v) for k, v in zip(le_pitch.classes_, le_pitch.transform(le_pitch.classes_))},
    'desc_encoder': {str(k): int(v) for k, v in zip(le_desc.classes_, le_desc.transform(le_desc.classes_))},
    'pitch_frequencies': {str(k): float(v) for k, v in pitch_type_freq.items()}
}

# Ensure public directory exists
os.makedirs('public', exist_ok=True)

# Save as JSON for easy loading in serverless functions
with open('public/model_data.json', 'w') as f:
    json.dump({
        'encoders': encoders,
        'patterns': patterns_dict,
        'first_pitch_patterns': first_pitch_dict,
        'count_patterns': count_patterns_dict,
        'matchup_patterns': matchup_patterns_dict,
        'optimal_zones': optimal_zones_dict  # New: optimal zones by pitch type
    }, f, indent=2)

print("Model saved to public/model_data.json")
print(f"  - {len(encoders['pitch_types'])} pitch types")
print(f"  - {len(patterns_dict):,} sequence patterns")
print(f"  - {len(first_pitch_dict):,} first pitch patterns")
print(f"  - {len(count_patterns_dict):,} count-based patterns")
print(f"  - {len(optimal_zones_dict)} pitch types with optimal zones")
print("\n" + "="*60)
print("Training complete! Ready for Vercel deployment.")
print("="*60)
