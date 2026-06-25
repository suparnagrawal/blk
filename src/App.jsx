import React, { useState, useMemo, useRef } from 'react';
import { Activity, Zap, Play, Clock } from 'lucide-react';
import Graph from './components/Graph';
import { useSimulator } from './hooks/useSimulator';
import './index.css';

const SHARD_COLORS = [
  '#FF0000', // Pure Red
  '#00FF00', // Pure Green
  '#0088FF', // Bright Blue
  '#FFFF00', // Pure Yellow
  '#FF00FF', // Pure Magenta
  '#00FFFF', // Pure Cyan
  '#FF8800', // Orange
  '#FFFFFF', // White
];

export default function App() {
  const [globalNarrative, setGlobalNarrative] = useState("Initializing...");
  
  const mainViewRef = useRef(null);

  const config = useMemo(() => {
    return { numNodes: 80, minTxs: 400, maxTxs: 500, initialShards: 4 };
  }, []);

  const sim = useSimulator({ 
    ...config,
    isAutoRunMaster: true,
    onNarrativeChange: setGlobalNarrative
  });

  return (
    <div className="app-container">
      {/* Background Graph */}
      <main className="main-view" ref={mainViewRef}>
        <Graph
          nodes={sim.nodes}
          edges={sim.edges}
          mapping={sim.mapping}
          activeTxs={sim.activeTxs}
        />
        
        {/* Floating Epoch Badge */}
        <div className="epoch-badge">
          Epoch {sim.epoch}
        </div>

        {/* Floating Demo Results Box */}
        {sim.demoResults && (
          <div className="floating-box demo-results-box">
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)', fontWeight: 'bold' }}>Demo Results</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Before Optimization (Epoch 1)</span>
              {sim.demoResults.before ? (
                <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '2px', background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '8px' }}>
                  <span>Cross-Shard: <span style={{ color: '#fb923c' }}>{Math.floor((sim.demoResults.before.cross / (sim.demoResults.before.cross + sim.demoResults.before.intra)) * 100)}%</span></span>
                  <span>Throughput: <span style={{ fontWeight: 'bold' }}>{sim.demoResults.before.throughput} TPS</span></span>
                  <span>Avg Latency: {sim.demoResults.before.avgLatency}ms</span>
                </div>
              ) : (
                <span style={{ fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>Executing baseline...</span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>After Optimization (Epoch 2)</span>
              {sim.demoResults.after ? (
                <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '2px', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid var(--accent-cyan)', padding: '8px', borderRadius: '8px' }}>
                  <span>Cross-Shard: <span style={{ color: '#4ade80' }}>{Math.floor((sim.demoResults.after.cross / (sim.demoResults.after.cross + sim.demoResults.after.intra)) * 100)}%</span></span>
                  <span>Throughput: <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>{sim.demoResults.after.throughput} TPS</span></span>
                  <span>Avg Latency: {sim.demoResults.after.avgLatency}ms</span>
                </div>
              ) : (
                <span style={{ fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>Awaiting partitioning...</span>
              )}
            </div>

            {sim.demoResults.before && sim.demoResults.after && (
              <div style={{ marginTop: '8px', textAlign: 'center', color: 'var(--accent-green)', fontWeight: 'bold', fontSize: '0.95rem' }}>
                Net Gain: {(sim.demoResults.after.throughput / sim.demoResults.before.throughput).toFixed(1)}x TPS!
              </div>
            )}
          </div>
        )}

        {/* Floating Caption */}
        {(sim.isPartitioning || sim.isExecuting || sim.txStats.throughput > 0) && (
          <div className="graph-caption">
            {sim.isPartitioning ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center' }}>
                <span>Partitioning... {Math.floor(sim.partitionProgress)}%</span>
                <div className="progress-bar-container" style={{ width: '200px', margin: 0 }}>
                  <div className="progress-bar-fill" style={{ width: `${sim.partitionProgress}%` }} />
                </div>
              </div>
            ) : sim.isExecuting ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center' }}>
                <span>Executing Transactions... {Math.floor(sim.execProgress)}%</span>
                <div className="progress-bar-container" style={{ width: '200px', margin: 0 }}>
                  <div className="progress-bar-fill" style={{ width: `${sim.execProgress}%` }} />
                </div>
              </div>
            ) : (
              <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>
                Execution Complete! Network Throughput: {sim.txStats.throughput} tx/s | Avg Latency: {sim.txStats.avgLatency} ms
              </span>
            )}
          </div>
        )}

        {/* Floating Controls Bar */}
        <div className="floating-controls-bar">
          <div className="control-group">
            <button 
              className="btn btn-primary"
              onClick={sim.runPartitioning}
              disabled={sim.isPartitioning || sim.isExecuting || sim.isAutoRunning}
            >
              <Activity size={16} /> Run Partitioning
            </button>
            
            <button 
              className="btn"
              onClick={() => sim.executeTransactions()}
              disabled={sim.isPartitioning || sim.isExecuting || sim.isAutoRunning}
            >
              <Zap size={16} /> Classify & Execute
            </button>

            <button 
              className="btn"
              onClick={() => sim.advanceEpochs(1)}
              disabled={sim.isPartitioning || sim.isExecuting || sim.isAutoRunning}
            >
              <Clock size={16} /> Advance 1 Epoch
            </button>
            
            <button 
              className={`btn ${sim.isAutoRunning ? 'active' : ''}`}
              onClick={sim.startAutoRunSequence}
              disabled={sim.isAutoRunning || sim.isPartitioning || sim.isExecuting}
              style={{ borderColor: sim.isAutoRunning ? 'var(--accent-purple)' : undefined }}
            >
              <Play size={16} /> Start Demo
            </button>
          </div>

          <div style={{ width: '1px', height: '32px', background: 'var(--border-light)' }}></div>

          <div className="control-group">
            <div className="slider-container" style={{ width: '120px' }}>
              <div className="slider-label">
                <span>Shards</span>
                <span className="font-mono">{sim.numShards}</span>
              </div>
              <input 
                type="range" 
                min="2" max="8" step="1" 
                value={sim.numShards} 
                onChange={e => sim.setNumShards(parseInt(e.target.value))}
                disabled={sim.isPartitioning || sim.isExecuting || sim.isAutoRunning}
                style={{ width: '100%' }}
              />
            </div>
            <div className="slider-container" style={{ width: '120px' }}>
              <div className="slider-label">
                <span>Speed</span>
                <span className="font-mono">{sim.partitionSpeed === 0 ? 'Instant' : `${sim.partitionSpeed}ms`}</span>
              </div>
              <input 
                type="range" 
                min="0" max="500" step="50" 
                value={sim.partitionSpeed} 
                onChange={e => sim.setPartitionSpeed(parseInt(e.target.value))}
                disabled={sim.isPartitioning || sim.isExecuting || sim.isAutoRunning}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Floating Legend */}
      <div className="floating-box floating-legend-box">
        <h3 style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Simulation Legend</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Array.from({ length: sim.numShards }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: SHARD_COLORS[i % SHARD_COLORS.length] }}></div>
              <span>Shard {i} Nodes</span>
            </div>
          ))}
        </div>

        <hr style={{ borderColor: 'var(--border-light)', margin: '4px 0' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '16px', height: '4px', backgroundColor: '#4ade80' }}></div>
              <span>Intra-Shard</span>
            </div>
            <span style={{ fontWeight: 'bold' }}>{(100 - sim.partitionStats.currentCross).toFixed(1)}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '16px', height: '4px', backgroundColor: '#fb923c' }}></div>
              <span>Cross-Shard</span>
            </div>
            <span style={{ fontWeight: 'bold' }}>{sim.partitionStats.currentCross.toFixed(1)}%</span>
          </div>
        </div>
      </div>
      
      {/* Narrative Banner floating near bottom */}
      <div className="narrative-banner-box">
        <h2 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, lineHeight: 1.4 }}>
          {globalNarrative}
        </h2>
      </div>

    </div>
  );
}
