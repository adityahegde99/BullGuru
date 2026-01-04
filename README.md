# ⚾ Bullpen Trainer

AI-powered bullpen training app for young pitchers. Get real-time pitch recommendations based on professional strikeout sequences.

## Features

- 🤖 **AI Recommendations**: Learn from thousands of successful strikeout sequences
- 📊 **Real-time Coaching**: Get pitch suggestions based on count and situation
- 🎯 **Visual Strike Zone**: Interactive zone selection
- 📱 **Mobile-Friendly**: Works on any device
- ☁️ **Vercel Ready**: Deploy instantly to Vercel

## Quick Start

### 1. Collect Data (Optional - if you need fresh data)

If you need to collect new strikeout data:

```bash
conda activate baseball-site
pip install -r requirements_data_collection.txt
python collect_strikeout_data.py
```

This will fetch all strikeout at-bats from 2019-2024 and save to `strikeout_pitches_2019_2024.parquet`.

**Note:** This takes a long time (hours) as it fetches data from multiple seasons. You can skip this if you already have the parquet file.

### 2. Train the Model

After data collection is complete:

```bash
conda activate baseball-site
python train_model.py
```

Or use the batch file:
```bash
train_model_after_data.bat
```

This creates `public/model_data.json` with the trained patterns.

**Enhanced Features:**
- **Diverse First Pitches**: Ensures 3-5 different pitch types for the first pitch
- **Reactive Recommendations**: Avoids repetitive suggestions, adapts to pitch history
- **Strategic Selection**: Considers count situation (ahead/behind/even)
- **Multiple Pattern Sources**: Uses sequence, count, and matchup patterns for better recommendations

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Locally

```bash
npm run dev
```

Visit `http://localhost:3000`

### 4. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Or connect your GitHub repo to Vercel for automatic deployments.

## Project Structure

```
├── pages/
│   ├── index.js          # Main training interface
│   └── api/
│       ├── start.js      # Start new session
│       └── pitch.js      # Submit pitch & get recommendations
├── public/
│   └── model_data.json   # Trained model (generated)
├── train_model.py        # Model training script
└── package.json          # Dependencies
```

## How It Works

1. **Training**: Analyzes strikeout sequences from MLB data to learn optimal pitch patterns
2. **Recommendations**: Suggests pitches based on:
   - Current count (balls/strikes)
   - Pitch sequence
   - Batter/pitcher matchup
3. **Learning**: Young pitchers practice with AI guidance, learning what works in different situations

## Requirements

- Node.js 18+
- Python 3.9+ (for training)
- pandas, numpy (for training)

## License

Educational use only.

