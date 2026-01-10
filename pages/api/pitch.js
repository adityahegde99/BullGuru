import fs from 'fs';
import path from 'path';

function loadModelData() {
  const filePath = path.join(process.cwd(), 'public', 'model_data.json');
  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    console.error('Error loading model data:', error);
    return {
      encoders: {
        pitch_types: ['FF', 'SI', 'FC', 'SL', 'CU', 'CH', 'FS', 'ST']
      },
      patterns: {},
      first_pitch_patterns: {},
      count_patterns: {},
      matchup_patterns: {}
    };
  }
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { session_id, pitch_type, zone, result, current_count, pitch_history, pitcher_throws, batter_stand, pitch_inventory } = req.body;

  // Update count based on result
  let balls = current_count?.balls || 0;
  let strikes = current_count?.strikes || 0;

  if (result.includes('strike') || result === 'foul_tip') {
    strikes += 1;
  } else if (result === 'ball') {
    balls += 1;
  } else if (result === 'foul' && strikes < 2) {
    strikes += 1; // Foul counts as strike unless 2 strikes
  }

  // Check if at-bat is over
  const atbat_over = strikes >= 3 || balls >= 4 || result.includes('in_play');
  const atbat_result = strikes >= 3 ? 'strikeout' : 
                      balls >= 4 ? 'walk' : 
                      'in_play';

    if (atbat_over) {
      return res.status(200).json({
        atbat_over: true,
        atbat_result,
        count: { balls: 0, strikes: 0 }
      });
    }

  const modelData = loadModelData();
  
  // Get reactive, diverse recommendations (filtered to pitch inventory)
  const recommendations = getReactiveRecommendations(
    balls, 
    strikes, 
    pitch_history, 
    pitcher_throws, 
    batter_stand, 
    pitch_inventory || ['FF'],
    modelData
  );

    res.status(200).json({
      atbat_over: false,
      count: { balls, strikes },
      recommendations
    });
  } catch (error) {
    console.error('Error in pitch API:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

function getReactiveRecommendations(balls, strikes, pitchHistory, pitcherThrows, batterStand, pitchInventory, modelData) {
  // Filter to only pitches in the inventory
  const availablePitchTypes = Array.isArray(pitchInventory) ? pitchInventory : [pitchInventory || 'FF'];
  const matchup_key = `${batterStand || 'R'}-${pitcherThrows || 'R'}`;
  const count_key = `${balls}-${strikes}`;
  
  // Build sequence from history (last 2 pitches)
  let sequence_key = 'first';
  const recentPitches = [];
  if (pitchHistory && pitchHistory.length > 0) {
    recentPitches.push(...pitchHistory.slice(-2).map(p => p.pitch_type || p.pitch));
    sequence_key = recentPitches.join('-');
  }
  
  const pitch_num = (pitchHistory?.length || 0) + 2;
  const context_key = `${matchup_key}|${count_key}|${sequence_key}|p${pitch_num}`;
  
  // Get patterns in priority order
  const patterns = modelData.patterns || {};
  let contextPatterns = patterns[context_key] || {};
  
  // Fallback to count-based patterns if sequence-specific not available
  if (Object.keys(contextPatterns).length < 3) {
    const countPatterns = modelData.count_patterns || {};
    const countBased = countPatterns[count_key] || {};
    
    // Merge with lower weight
    for (const [key, value] of Object.entries(countBased)) {
      contextPatterns[key] = (contextPatterns[key] || 0) + value * 0.5;
    }
  }
  
  // Further fallback to matchup patterns
  if (Object.keys(contextPatterns).length < 3) {
    const matchupPatterns = modelData.matchup_patterns || {};
    const matchupBased = matchupPatterns[matchup_key] || {};
    
    for (const [key, value] of Object.entries(matchupBased)) {
      contextPatterns[key] = (contextPatterns[key] || 0) + value * 0.3;
    }
  }
  
  // Get all candidates sorted by frequency
  const sorted = Object.entries(contextPatterns)
    .sort((a, b) => b[1] - a[1]);
  
  const total = Object.values(contextPatterns).reduce((a, b) => a + b, 0) || 1;
  
  // Build diverse recommendations (avoid repetition)
  const recommendations = [];
  const usedPitchTypes = new Set();
  const usedCombos = new Set();
  
  // Avoid immediately repeating the last pitch type (unless it's the only option)
  const lastPitchType = recentPitches.length > 0 ? recentPitches[recentPitches.length - 1] : null;
  
  // First pass: prioritize different pitch types from recent history
  for (const [pitch_zone, count] of sorted) {
    const [pitch_type, zone] = pitch_zone.split('-');
    
    // Only use pitches from the pitcher's inventory
    if (!availablePitchTypes.includes(pitch_type)) continue;
    
    const combo = `${pitch_type}-${zone}`;
    
    // Skip exact duplicates
    if (usedCombos.has(combo)) continue;
    
    // Calculate priority (penalize repetition, boost diversity)
    let priority = count;
    if (lastPitchType && pitch_type === lastPitchType && recommendations.length < 3) {
      priority = count * 0.7; // Reduce priority for repetition but don't eliminate
    }
    
    // Prefer diversity in pitch types
    const isNewPitchType = !usedPitchTypes.has(pitch_type);
    if (isNewPitchType) {
      priority *= 1.2; // Boost new pitch types
    }
    
    recommendations.push({
      pitch_type,
      zone: parseInt(zone),
      zone_description: getZoneDescription(parseInt(zone)),
      confidence: count / total,
      priority: priority
    });
    
    usedPitchTypes.add(pitch_type);
    usedCombos.add(combo);
    
    if (recommendations.length >= 10) break; // Get more candidates for diversity
  }
  
  // Sort by priority
  recommendations.sort((a, b) => b.priority - a.priority);
  
  // Select diverse final recommendations (3-5)
  const finalRecommendations = [];
  const finalUsedPitchTypes = new Set();
  
  for (const rec of recommendations) {
    // Prioritize diverse pitch types
    if (finalUsedPitchTypes.has(rec.pitch_type) && finalRecommendations.length >= 3) {
      continue;
    }
    
    finalUsedPitchTypes.add(rec.pitch_type);
    finalRecommendations.push({
      pitch_type: rec.pitch_type,
      zone: rec.zone,
      zone_description: rec.zone_description,
      confidence: rec.confidence
    });
    
    if (finalRecommendations.length >= 5) break;
  }
  
  // Fill remaining slots if needed
  if (finalRecommendations.length < 3) {
    for (const rec of recommendations) {
      if (finalRecommendations.length >= 5) break;
      
      const exists = finalRecommendations.some(r => 
        r.pitch_type === rec.pitch_type && r.zone === rec.zone
      );
      
      if (!exists) {
        finalRecommendations.push({
          pitch_type: rec.pitch_type,
          zone: rec.zone,
          zone_description: rec.zone_description,
          confidence: rec.confidence
        });
      }
    }
  }
  
  // Strategic fallback based on count (only from inventory)
  if (finalRecommendations.length < 3) {
    const fallbacks = getStrategicFallbacks(balls, strikes, matchup_key, availablePitchTypes);
    for (const fb of fallbacks) {
      if (finalRecommendations.length >= 5) break;
      const exists = finalRecommendations.some(r => 
        r.pitch_type === fb.pitch_type && r.zone === fb.zone
      );
      if (!exists) {
        finalRecommendations.push(fb);
      }
    }
  }
  
  return finalRecommendations.slice(0, 5);
}

function getStrategicFallbacks(balls, strikes, matchup, availablePitchTypes) {
  // Strategic pitch selection based on count (only from inventory)
  const fallbacks = [];
  
  // Behind in count (more balls than strikes) - throw strikes
  if (balls > strikes) {
    const options = [
      { pitch_type: 'FF', zone: 5, zone_description: 'Middle-Center (Strike)', confidence: 0.3 },
      { pitch_type: 'FF', zone: 8, zone_description: 'Bottom-Center (Strike)', confidence: 0.25 },
      { pitch_type: 'SI', zone: 6, zone_description: 'Middle-Right (Strike)', confidence: 0.2 },
      { pitch_type: 'FC', zone: 5, zone_description: 'Middle-Center (Strike)', confidence: 0.2 }
    ].filter(p => availablePitchTypes.includes(p.pitch_type));
    fallbacks.push(...options);
  }
  // Ahead in count (more strikes) - put away pitch
  else if (strikes > balls) {
    const options = [
      { pitch_type: 'SL', zone: 6, zone_description: 'Middle-Right (Strike)', confidence: 0.3 },
      { pitch_type: 'CU', zone: 9, zone_description: 'Bottom-Right (Strike)', confidence: 0.25 },
      { pitch_type: 'CH', zone: 7, zone_description: 'Bottom-Left (Strike)', confidence: 0.2 },
      { pitch_type: 'FS', zone: 7, zone_description: 'Bottom-Left (Strike)', confidence: 0.2 }
    ].filter(p => availablePitchTypes.includes(p.pitch_type));
    fallbacks.push(...options);
  }
  // Even count
  else {
    const options = [
      { pitch_type: 'FF', zone: 5, zone_description: 'Middle-Center (Strike)', confidence: 0.3 },
      { pitch_type: 'SL', zone: 6, zone_description: 'Middle-Right (Strike)', confidence: 0.25 },
      { pitch_type: 'CH', zone: 8, zone_description: 'Bottom-Center (Strike)', confidence: 0.2 },
      { pitch_type: 'SI', zone: 5, zone_description: 'Middle-Center (Strike)', confidence: 0.2 }
    ].filter(p => availablePitchTypes.includes(p.pitch_type));
    fallbacks.push(...options);
  }
  
  return fallbacks;
}

function getZoneDescription(zone) {
  const descriptions = {
    1: 'Top-Left (Strike)', 2: 'Top-Center (Strike)', 3: 'Top-Right (Strike)',
    4: 'Middle-Left (Strike)', 5: 'Middle-Center (Strike)', 6: 'Middle-Right (Strike)',
    7: 'Bottom-Left (Strike)', 8: 'Bottom-Center (Strike)', 9: 'Bottom-Right (Strike)',
    10: 'High-Left (Ball)', 11: 'High-Left-Center (Ball)', 12: 'High-Center (Ball)',
    13: 'High-Right-Center (Ball)', 14: 'High-Right (Ball)',
    15: 'Left-Top (Ball)', 16: 'Right-Top (Ball)',
    17: 'Left-Middle (Ball)', 18: 'Right-Middle (Ball)',
    19: 'Left-Bottom (Ball)', 20: 'Right-Bottom (Ball)',
    21: 'Low-Left (Ball)', 22: 'Low-Left-Center (Ball)', 23: 'Low-Center (Ball)',
    24: 'Low-Right-Center (Ball)', 25: 'Low-Right (Ball)'
  };
  return descriptions[zone] || 'Unknown Zone';
}
