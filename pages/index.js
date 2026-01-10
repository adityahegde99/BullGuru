import { useState } from 'react';
import Head from 'next/head';

export default function Home() {
  const [setupComplete, setSetupComplete] = useState(false);
  const [session, setSession] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [count, setCount] = useState({ balls: 0, strikes: 0 });
  const [selectedPitch, setSelectedPitch] = useState('');
  const [selectedZone, setSelectedZone] = useState(null);
  const [result, setResult] = useState('');
  const [history, setHistory] = useState([]);
  const [pitcherThrows, setPitcherThrows] = useState('R');
  const [batterStand, setBatterStand] = useState('R');
  const [sessionData, setSessionData] = useState(null);
  const [pitchInventory, setPitchInventory] = useState(['FF']); // Default to fastball

  const pitchTypes = [
    { code: 'FF', name: '4-Seam Fastball' },
    { code: 'SI', name: 'Sinker' },
    { code: 'FC', name: 'Cutter' },
    { code: 'SL', name: 'Slider' },
    { code: 'CU', name: 'Curveball' },
    { code: 'CH', name: 'Changeup' },
    { code: 'FS', name: 'Splitter' },
    { code: 'ST', name: 'Sweeper' },
    { code: 'KC', name: 'Knuckle Curve' }
  ];

  const togglePitchInventory = (pitchCode) => {
    setPitchInventory(prev => {
      if (prev.includes(pitchCode)) {
        // Must have at least one pitch
        if (prev.length > 1) {
          return prev.filter(p => p !== pitchCode);
        }
        return prev;
      } else {
        return [...prev, pitchCode];
      }
    });
  };

  const startSession = async () => {
    if (pitchInventory.length === 0) {
      alert('Please select at least one pitch type');
      return;
    }

    try {
      const response = await fetch('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pitcher_throws: pitcherThrows,
          batter_stand: batterStand,
          pitch_inventory: pitchInventory
        })
      });
      const data = await response.json();
      setSession(data.session_id);
      setRecommendations(data.recommendations || []);
      setCount({ balls: 0, strikes: 0 });
      setHistory([]);
      setSessionData({ pitcher_throws: pitcherThrows, batter_stand: batterStand, pitch_inventory: pitchInventory });
      setSetupComplete(true);
    } catch (error) {
      console.error('Error starting session:', error);
      alert('Failed to start session');
    }
  };

  const submitPitch = async () => {
    if (!selectedPitch || !selectedZone || !result) {
      alert('Please select pitch type, zone, and result');
      return;
    }

    try {
      const response = await fetch('/api/pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session,
          pitch_type: selectedPitch,
          zone: selectedZone,
          result: result,
          current_count: count,
          pitch_history: history,
          pitcher_throws: sessionData?.pitcher_throws || pitcherThrows,
          batter_stand: sessionData?.batter_stand || batterStand,
          pitch_inventory: sessionData?.pitch_inventory || pitchInventory
        })
      });
      const data = await response.json();

      setHistory([...history, {
        pitch: selectedPitch,
        zone: selectedZone,
        result: result
      }]);

      if (data.atbat_over) {
        alert(`At-bat over: ${data.atbat_result.toUpperCase()}!`);
        setSession(null);
        setRecommendations([]);
        setCount({ balls: 0, strikes: 0 });
        setHistory([]);
        setSetupComplete(false);
      } else {
        setCount(data.count);
        setRecommendations(data.recommendations || []);
      }

      setSelectedPitch('');
      setSelectedZone(null);
      setResult('');
    } catch (error) {
      console.error('Error submitting pitch:', error);
      alert('Failed to submit pitch');
    }
  };

  const zones = [
    [10, 11, 12, 13, 14],
    [15, 1, 2, 3, 16],
    [17, 4, 5, 6, 18],
    [19, 7, 8, 9, 20],
    [21, 22, 23, 24, 25]
  ];

  const isStrikeZone = (zone) => zone >= 1 && zone <= 9;

  if (!setupComplete) {
    return (
      <>
        <Head>
          <title>Bullpen Trainer - Setup</title>
        </Head>
        <div className="setup-container">
          <header>
            <h1>BullGuru</h1>
            <p>AI-Powered Coaching for Young Pitchers</p>
          </header>

          <div className="setup-card">
            <h2>Setup Your Session</h2>
            
            <div className="form-group">
              <label>Pitcher Throws</label>
              <select value={pitcherThrows} onChange={(e) => setPitcherThrows(e.target.value)}>
                <option value="R">Right-Handed</option>
                <option value="L">Left-Handed</option>
              </select>
            </div>

            <div className="form-group">
              <label>Batter Stands</label>
              <select value={batterStand} onChange={(e) => setBatterStand(e.target.value)}>
                <option value="R">Right-Handed</option>
                <option value="L">Left-Handed</option>
              </select>
            </div>

            <div className="form-group">
              <label>Pitch Inventory (Select all pitches you can throw)</label>
              <div className="pitch-inventory-grid">
                {pitchTypes.map((pitch) => (
                  <label key={pitch.code} className="pitch-checkbox">
                    <input
                      type="checkbox"
                      checked={pitchInventory.includes(pitch.code)}
                      onChange={() => togglePitchInventory(pitch.code)}
                    />
                    <span>{pitch.name}</span>
                  </label>
                ))}
              </div>
              <p className="helper-text">Selected: {pitchInventory.length} pitch{pitchInventory.length !== 1 ? 'es' : ''}</p>
            </div>

            <button onClick={startSession} className="btn btn-primary">
              Start Training Session
            </button>
          </div>
        </div>

        <style jsx>{`
          .setup-container {
            min-height: 100vh;
            background: #000;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }

          header {
            text-align: center;
            color: #C0C0C0;
            margin-bottom: 40px;
          }

          header h1 {
            font-size: 3em;
            margin-bottom: 10px;
            color: #FFF;
            text-shadow: 0 0 10px rgba(192, 192, 192, 0.5);
          }

          header p {
            font-size: 1.2em;
            color: #C0C0C0;
          }

          .setup-card {
            background: #1a1a1a;
            border: 2px solid #C0C0C0;
            border-radius: 15px;
            padding: 30px;
            max-width: 600px;
            width: 100%;
            box-shadow: 0 0 20px rgba(192, 192, 192, 0.2);
          }

          .setup-card h2 {
            color: #C0C0C0;
            margin-bottom: 25px;
            text-align: center;
            font-size: 1.8em;
          }

          .form-group {
            margin-bottom: 25px;
          }

          .form-group label {
            display: block;
            margin-bottom: 10px;
            font-weight: 600;
            color: #C0C0C0;
            font-size: 16px;
          }

          select {
            width: 100%;
            padding: 12px;
            font-size: 16px;
            border: 2px solid #C0C0C0;
            border-radius: 8px;
            background: #000;
            color: #FFF;
          }

          select:focus {
            outline: none;
            border-color: #FFF;
            box-shadow: 0 0 10px rgba(192, 192, 192, 0.3);
          }

          .pitch-inventory-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            margin-top: 10px;
          }

          .pitch-checkbox {
            display: flex;
            align-items: center;
            padding: 12px;
            background: #000;
            border: 2px solid #C0C0C0;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .pitch-checkbox:hover {
            background: #1a1a1a;
            border-color: #FFF;
          }

          .pitch-checkbox input {
            margin-right: 10px;
            width: 20px;
            height: 20px;
            cursor: pointer;
          }

          .pitch-checkbox span {
            color: #C0C0C0;
            font-size: 14px;
          }

          .pitch-checkbox input:checked + span {
            color: #FFF;
            font-weight: 600;
          }

          .pitch-checkbox input:checked ~ span {
            border-color: #FFF;
            background: #1a1a1a;
          }
          
          .pitch-checkbox:has(input:checked) span {
            color: #FFF;
            font-weight: 600;
          }
          
          .pitch-checkbox:has(input:checked) {
            border-color: #FFF;
            background: #1a1a1a;
          }

          .helper-text {
            margin-top: 10px;
            color: #888;
            font-size: 14px;
          }

          .btn {
            padding: 15px 30px;
            font-size: 18px;
            font-weight: 600;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            width: 100%;
            transition: all 0.3s;
          }

          .btn-primary {
            background: #C0C0C0;
            color: #000;
            border: 2px solid #C0C0C0;
          }

          .btn-primary:hover {
            background: #FFF;
            border-color: #FFF;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(192, 192, 192, 0.4);
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Bullpen Trainer - Training Session</title>
      </Head>

      <div className="training-container">
        <div className="training-layout">
          <div className="recommendations-panel">
            <h2>🎯 AI Recommendations</h2>
            {recommendations.length > 0 ? (
              <div className="recommendations-list">
                {recommendations.map((rec, idx) => (
                  <div key={idx} className={`recommendation-item ${idx === 0 ? 'top' : ''}`}>
                    <strong>#{idx + 1} {rec.pitch_type}</strong>
                    <div className="zone-info">Zone {rec.zone}: {rec.zone_description}</div>
                    {rec.confidence && (
                      <div className="confidence">
                        {(rec.confidence * 100).toFixed(0)}% confidence
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p>Loading recommendations...</p>
            )}
          </div>

          <div className="training-main">
            <div className="count-display">
              <h2>Count</h2>
              <div className="count-value">{count.balls}-{count.strikes}</div>
            </div>

            <div className="top-section">
              <div className="controls-column">
                <div className="control-card">
                  <h3>Pitch Type</h3>
                  <select value={selectedPitch} onChange={(e) => setSelectedPitch(e.target.value)}>
                    <option value="">Choose pitch</option>
                    {pitchInventory.map(pt => {
                      const pitch = pitchTypes.find(p => p.code === pt);
                      return pitch ? (
                        <option key={pt} value={pt}>{pitch.name}</option>
                      ) : null;
                    })}
                  </select>
                </div>

                <div className="control-card">
                  <h3>Result</h3>
                  <select value={result} onChange={(e) => setResult(e.target.value)}>
                    <option value="">Select result</option>
                    <option value="called_strike">Called Strike</option>
                    <option value="swinging_strike">Swinging Strike</option>
                    <option value="ball">Ball</option>
                    <option value="foul">Foul</option>
                    <option value="foul_tip">Foul Tip</option>
                    <option value="hit_into_play">Hit Into Play</option>
                  </select>
                </div>
              
                {/* Flush pitch log under Result in the controls column */}
                <div className="history-card flush-history">
                  <h3>Pitch Log</h3>
                  <div className="history-list">
                    {history.length === 0 ? (
                      <div className="history-item">No pitches yet</div>
                    ) : (
                      history.map((pitch, idx) => (
                        <div key={idx} className="history-item">
                          {idx + 1}. {pitch.pitch} → Zone {pitch.zone} — {pitch.result}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="strike-zone-card">
                <h3>Select Location</h3>
                <div className="strike-zone">
                  {zones.map((row, rowIdx) => (
                    <div key={rowIdx} className="zone-row">
                      {row.map((zone) => (
                        <button
                          key={zone}
                          className={`zone-btn ${isStrikeZone(zone) ? 'strike' : 'ball'} ${selectedZone === zone ? 'selected' : ''} ${recommendations.some(r => r.zone === zone) ? 'recommended' : ''}`}
                          onClick={() => setSelectedZone(zone)}
                          title={`Zone ${zone}`}
                        >
                          {zone}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={submitPitch} className="btn btn-primary submit-btn">
              Submit Pitch
            </button>

            {/* History moved under Result for a flush design */}
          </div>
        </div>
      </div>

      <style jsx>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .training-container {
          min-height: 100vh;
          background: #000;
          padding: 15px;
          overflow: hidden;
        }

        .training-layout {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 20px;
          height: calc(100vh - 30px);
          max-width: 1600px;
          margin: 0 auto;
        }

        .recommendations-panel {
          background: #1a1a1a;
          border: 2px solid #C0C0C0;
          border-radius: 15px;
          padding: 20px;
          overflow-y: auto;
          height: 100%;
        }

        .recommendations-panel h2 {
          color: #C0C0C0;
          margin-bottom: 20px;
          text-align: center;
          font-size: 1.5em;
        }

        .recommendation-item {
          background: #000;
          border: 2px solid #C0C0C0;
          padding: 12px;
          margin-bottom: 10px;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .recommendation-item:hover {
          border-color: #FFF;
          transform: translateX(3px);
        }

        .recommendation-item.top {
          background: #1a1a1a;
          border-color: #FFF;
          box-shadow: 0 0 15px rgba(192, 192, 192, 0.3);
        }

        .recommendation-item strong {
          color: #FFF;
          font-size: 1.1em;
          display: block;
          margin-bottom: 5px;
        }

        .zone-info {
          color: #C0C0C0;
          font-size: 0.9em;
          margin-bottom: 5px;
        }

        .confidence {
          color: #888;
          font-size: 0.85em;
          font-weight: 600;
        }

        .count-display {
          text-align: center;
          padding: 15px;
          background: linear-gradient(135deg, #1a1a1a 0%, #000 100%);
          border: 2px solid #C0C0C0;
          color: #FFF;
          border-radius: 15px;
        }

        .count-display h2 {
          font-size: 1.2em;
          margin-bottom: 5px;
          color: #C0C0C0;
        }

        .count-value {
          font-size: 3.5em;
          font-weight: bold;
          letter-spacing: 8px;
          color: #FFF;
        }

        .top-section {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 15px;
          align-items: start;
        }

        .controls-column {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .control-card {
          background: #1a1a1a;
          border: 2px solid #C0C0C0;
          padding: 12px;
          border-radius: 10px;
        }

        .control-card h3 {
          color: #C0C0C0;
          margin-bottom: 10px;
          font-size: 1.1em;
        }

        select {
          width: 100%;
          padding: 10px;
          font-size: 16px;
          border: 2px solid #C0C0C0;
          border-radius: 8px;
          background: #000;
          color: #FFF;
        }

        select:focus {
          outline: none;
          border-color: #FFF;
          box-shadow: 0 0 10px rgba(192, 192, 192, 0.3);
        }

        .strike-zone-card {
          background: #1a1a1a;
          border: 2px solid #C0C0C0;
          padding: 12px;
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .strike-zone-card h3 {
          color: #C0C0C0;
          margin-bottom: 12px;
          text-align: center;
          font-size: 1.1em;
        }

        .strike-zone {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 4px;
          border: 3px solid #C0C0C0;
          background: #000;
          padding: 6px;
          border-radius: 5px;
          width: 100%;
          aspect-ratio: 5/5;
          margin: 0;
        }

        .zone-row {
          display: contents;
        }

        .zone-btn {
          aspect-ratio: 1;
          border: 2px solid #444;
          cursor: pointer;
          border-radius: 4px;
          font-weight: bold;
          font-size: 14px;
          transition: all 0.2s;
          color: #000;
          min-height: 0;
        }

        .zone-btn.strike {
          background: linear-gradient(135deg, #4a9 0%, #2a7 100%);
        }

        .zone-btn.ball {
          background: linear-gradient(135deg, #f66 0%, #c33 100%);
        }

        .zone-btn:hover {
          transform: scale(1.1);
          z-index: 10;
          border-color: #FFF;
        }

        .zone-btn.selected {
          transform: scale(1.15);
          border: 3px solid #FFF;
          box-shadow: 0 0 20px rgba(255, 255, 255, 0.8);
          z-index: 10;
        }

        .zone-btn.recommended {
          box-shadow: 0 0 15px #FFD700;
          border: 2px solid #FFD700;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 15px #FFD700; }
          50% { box-shadow: 0 0 25px #FFD700; }
        }

        .submit-btn {
          padding: 12px;
          font-size: 16px;
          font-weight: 600;
          background: #C0C0C0;
          color: #000;
          border: 2px solid #C0C0C0;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.3s;
        }

        .submit-btn:hover {
          background: #FFF;
          border-color: #FFF;
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(192, 192, 192, 0.4);
        }

        .history-card {
          background: #1a1a1a;
          border: 2px solid #C0C0C0;
          padding: 12px;
          border-radius: 10px;
          max-height: 200px;
          overflow-y: auto;
        }

        .flush-history {
          margin-top: 6px;
          padding: 10px;
          border-radius: 8px;
          max-height: 260px;
        }

        .history-card h3 {
          color: #C0C0C0;
          margin-bottom: 10px;
          font-size: 1em;
          text-align: center;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .history-item {
          padding: 8px;
          background: #000;
          border: 1px solid #444;
          border-radius: 5px;
          color: #C0C0C0;
          font-size: 13px;
        }

        .training-main {
          display: flex;
          flex-direction: column;
          gap: 12px;
          height: 100%;
          overflow-y: auto;
        }

        @media (max-width: 1400px) {
          .training-layout {
            grid-template-columns: 280px 1fr;
          }
          .count-value {
            font-size: 2.8em;
          }
          .strike-zone {
            max-width: 400px;
          }
        }
      `}</style>
    </>
  );
}
