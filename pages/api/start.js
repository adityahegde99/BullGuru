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
      matchup_patterns: {},
      optimal_zones: {}
    };
  }
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pitcher_throws, batter_stand, pitch_inventory } = req.body;
    const session_id = `session_${Date.now()}`;

    const modelData = loadModelData();
  
  // Get 5 diverse first pitch recommendations with optimal zones
  // Filter to only include pitches from the pitcher's inventory
  const recommendations = getDiverseFirstPitchRecommendations(
    batter_stand, 
    pitcher_throws, 
    pitch_inventory || ['FF'], // Default to fastball if not provided
    modelData
  );

    res.status(200).json({
      session_id,
      recommendations,
      count: { balls: 0, strikes: 0 },
      pitcher_throws: pitcher_throws,
      batter_stand: batter_stand
    });
  } catch (error) {
    console.error('Error in start API:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

function getDiverseFirstPitchRecommendations(batter_stand, pitcher_throws, pitchInventory, modelData) {
  const matchup_key = `${batter_stand}-${pitcher_throws}`;
  const count_key = '0-0';
  const context_key = `${matchup_key}|${count_key}`;
  
  // Filter to only use pitches from the pitcher's inventory
  const availablePitchTypes = Array.isArray(pitchInventory) ? pitchInventory : [pitchInventory || 'FF'];
  
  // Get optimal zones for each pitch type (unbiased)
  const optimalZones = modelData.optimal_zones || {};
  const allPitchTypes = modelData.encoders?.pitch_types || ['FF', 'SI', 'FC', 'SL', 'CU', 'CH', 'FS', 'ST'];
  
  // Get first pitch patterns (if available)
  const firstPitchPatterns = modelData.first_pitch_patterns || {};
  const patterns = firstPitchPatterns[context_key] || {};
  
  // Build recommendations: one for each of 5 different pitch types
  const recommendations = [];
  const usedPitchTypes = new Set();
  
  // Priority order: common effective pitches first, but ensure diversity
  // Filter to only pitches in the inventory
  const priorityPitches = ['FF', 'SL', 'CH', 'CU', 'SI', 'FC', 'FS', 'ST', 'KC']
    .filter(pt => availablePitchTypes.includes(pt));
  
  // Strategy: Get optimal zone for each pitch type (unbiased by frequency)
  for (const pitchType of priorityPitches) {
    if (recommendations.length >= 5) break;
    if (usedPitchTypes.has(pitchType)) continue;
    if (!availablePitchTypes.includes(pitchType)) continue; // Only use inventory pitches
    
    // Find best zone for this pitch type from optimal zones
    const zonesForPitch = optimalZones[pitchType] || {};
    
    if (Object.keys(zonesForPitch).length > 0) {
      // Get zone with highest effectiveness score
      const sortedZones = Object.entries(zonesForPitch)
        .sort((a, b) => b[1] - a[1]);
      
      const bestZone = sortedZones[0];
      const zone = parseInt(bestZone[0]);
      const effectiveness = bestZone[1];
      
      // Check if this combo appears in actual first pitch data
      const combo = `${pitchType}-${zone}`;
      const actualCount = patterns[combo] || 0;
      const total = Object.values(patterns).reduce((a, b) => a + b, 0) || 1;
      
      // Confidence combines actual usage and effectiveness
      const confidence = actualCount > 0 
        ? (actualCount / total) * 0.7 + (effectiveness / 10) * 0.3
        : effectiveness / 10;
      
      recommendations.push({
        pitch_type: pitchType,
        zone: zone,
        zone_description: getZoneDescription(zone),
        confidence: Math.min(confidence, 0.95) // Cap at 95%
      });
      
      usedPitchTypes.add(pitchType);
    }
  }
  
  // If we don't have 5 yet, fill with strategic defaults (only from inventory)
  if (recommendations.length < 5) {
    const defaultPitches = [
      { type: 'FF', zone: 5, desc: 'Middle-Center (Strike)' },
      { type: 'SL', zone: 6, desc: 'Middle-Right (Strike)' },
      { type: 'CH', zone: 7, desc: 'Bottom-Left (Strike)' },
      { type: 'CU', zone: 9, desc: 'Bottom-Right (Strike)' },
      { type: 'SI', zone: 5, desc: 'Middle-Center (Strike)' },
      { type: 'FC', zone: 6, desc: 'Middle-Right (Strike)' },
      { type: 'FS', zone: 7, desc: 'Bottom-Left (Strike)' }
    ].filter(p => availablePitchTypes.includes(p.type)); // Only from inventory
    
    for (const pitch of defaultPitches) {
      if (recommendations.length >= 5) break;
      if (usedPitchTypes.has(pitch.type)) continue;
      
      recommendations.push({
        pitch_type: pitch.type,
        zone: pitch.zone,
        zone_description: pitch.desc,
        confidence: 0.3
      });
      
      usedPitchTypes.add(pitch.type);
    }
  }
  
  // Ensure we have exactly 5 different pitch types
  // If still not enough, add any remaining pitch types from inventory
  if (recommendations.length < 5) {
    for (const pitchType of availablePitchTypes) {
      if (recommendations.length >= 5) break;
      if (usedPitchTypes.has(pitchType)) continue;
      
      // Use a reasonable default zone for this pitch type
      const defaultZone = getDefaultZoneForPitchType(pitchType);
      recommendations.push({
        pitch_type: pitchType,
        zone: defaultZone,
        zone_description: getZoneDescription(defaultZone),
        confidence: 0.25
      });
      
      usedPitchTypes.add(pitchType);
    }
  }
  
  // Sort by confidence (best first)
  recommendations.sort((a, b) => b.confidence - a.confidence);
  
  return recommendations.slice(0, 5);
}

function getDefaultZoneForPitchType(pitchType) {
  // Strategic default zones for each pitch type
  const defaults = {
    'FF': 5,  // Fastball: middle-center
    'SI': 5,  // Sinker: middle-center
    'FC': 6,  // Cutter: middle-right
    'SL': 6,  // Slider: middle-right
    'CU': 9,  // Curveball: bottom-right
    'CH': 7,  // Changeup: bottom-left
    'FS': 7,  // Splitter: bottom-left
    'ST': 6,  // Sweeper: middle-right
    'KC': 9   // Knuckle curve: bottom-right
  };
  return defaults[pitchType] || 5;
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
