import React, { useState, useMemo, useRef } from 'react';
import { Activity, Zap, Play, Clock, Layers, RotateCcw, Info, X } from 'lucide-react';
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
  const [showPqVisualizer, setShowPqVisualizer] = useState(true);
  const [showPqInfo, setShowPqInfo] = useState(false);
  
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


        {/* Floating Benchmarking Results Box */}
        {sim.algorithmStats && !sim.isAutoRunning && !sim.comparisonStats && (
          <div className="floating-box demo-results-box" style={{ top: '80px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)', fontWeight: 'bold' }}>Partitioning Benchmark</h3>
              <button className="btn" style={{ padding: '2px 6px', fontSize: '0.75rem' }} onClick={() => sim.setAlgorithmStats(null)}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
              <span>Algorithm: <span style={{ color: 'var(--accent-cyan)' }}>{sim.algorithmStats.algorithm}</span></span>
              <span>Theoretical: <span style={{ fontFamily: 'var(--font-mono)' }}>{sim.algorithmStats.complexity}</span></span>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
              <span>CPU Runtime: <span style={{ color: '#fb923c', fontWeight: 'bold' }}>{sim.algorithmStats.cpuRuntimeMs} ms</span></span>
              <span>Total Runtime (incl. Animation): <span style={{ color: 'var(--text-muted)' }}>{sim.algorithmStats.runtimeMs} ms</span></span>
              <span>Swaps Evaluated: {sim.algorithmStats.swaps}</span>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
              <span>Initial Cross: {sim.algorithmStats.initialCross.toFixed(1)}%</span>
              <span>Final Cross: <span style={{ color: '#4ade80', fontWeight: 'bold' }}>{sim.algorithmStats.finalCross.toFixed(1)}%</span></span>
              <span>Reduction: {sim.algorithmStats.reduction.toFixed(1)}%</span>
            </div>

            <button 
              className="btn" 
              style={{ marginTop: '12px', width: '100%', padding: '6px', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.5)', cursor: 'pointer', borderRadius: '4px' }}
              onClick={sim.revertPartitioning}
            >
              Undo Partitioning
            </button>
          </div>
        )}

        {/* Floating Compare All Box */}
        {sim.comparisonStats && !sim.isAutoRunning && (
          <div className="floating-box compare-results-box" style={{ zIndex: 50 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 'bold' }}>Algorithm Comparison</h3>
              <button className="btn" style={{ padding: '2px 8px', fontSize: '0.85rem' }} onClick={() => sim.setComparisonStats(null)}>✕</button>
            </div>

            <table style={{ width: '100%', fontSize: '0.85rem', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                  <th style={{ padding: '8px 4px' }}>Algorithm</th>
                  <th style={{ padding: '8px 4px' }}>Complexity</th>
                  <th style={{ padding: '8px 4px' }}>Runtime</th>
                  <th style={{ padding: '8px 4px' }}>Swaps</th>
                  <th style={{ padding: '8px 4px' }}>Final Cross</th>
                  {sim.comparisonStats.isDemo && <th style={{ padding: '8px 4px' }}>Final TPS</th>}
                  {sim.comparisonStats.isDemo && <th style={{ padding: '8px 4px' }}>Gain</th>}
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                   <td style={{ padding: '8px 4px', color: 'var(--text-main)', fontWeight: 'bold' }}>Initial Network</td>
                   <td style={{ padding: '8px 4px', color: 'var(--text-muted)' }}>-</td>
                   <td style={{ padding: '8px 4px', color: 'var(--text-muted)' }}>-</td>
                   <td style={{ padding: '8px 4px', color: 'var(--text-muted)' }}>0</td>
                   <td style={{ padding: '8px 4px', color: '#fb923c', fontWeight: 'bold' }}>{sim.comparisonStats.initialCross.toFixed(1)}%</td>
                   {sim.comparisonStats.isDemo && <td style={{ padding: '8px 4px', color: 'var(--text-main)', fontWeight: 'bold' }}>{sim.comparisonStats.initialTps?.toLocaleString()}</td>}
                   {sim.comparisonStats.isDemo && <td style={{ padding: '8px 4px', color: 'var(--text-muted)' }}>-</td>}
                </tr>
                {sim.comparisonStats.results.map((res, i) => {
                  const gain = sim.comparisonStats.initialTps ? ((res.finalTps - sim.comparisonStats.initialTps) / sim.comparisonStats.initialTps) * 100 : 0;
                  return (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '8px 4px', color: 'var(--accent-cyan)' }}>{res.name}</td>
                    <td style={{ padding: '8px 4px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{res.complexity}</td>
                    <td style={{ padding: '8px 4px', color: '#fb923c', fontWeight: 'bold' }}>{res.runtimeMs} ms</td>
                    <td style={{ padding: '8px 4px' }}>{res.swaps}</td>
                    <td style={{ padding: '8px 4px', color: '#4ade80', fontWeight: 'bold' }}>{res.finalCross.toFixed(1)}%</td>
                    {sim.comparisonStats.isDemo && <td style={{ padding: '8px 4px', color: 'var(--accent-green)', fontWeight: 'bold' }}>{res.finalTps?.toLocaleString()}</td>}
                    {sim.comparisonStats.isDemo && <td style={{ padding: '8px 4px', color: 'var(--accent-green)', fontWeight: 'bold' }}>+{gain.toFixed(0)}%</td>}
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}

        {/* Floating Controls Bar */}
        <div className="floating-controls-bar">
          <div className="control-group">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginRight: '16px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Partitioning Algorithm</label>
              <select 
                value={sim.algorithm}
                onChange={(e) => sim.setAlgorithm(e.target.value)}
                disabled={sim.isPartitioning || sim.isExecuting || sim.isAutoRunning}
                style={{
                  background: 'rgba(0,0,0,0.5)', 
                  color: 'var(--text-main)', 
                  border: '1px solid var(--border-light)', 
                  borderRadius: '6px', 
                  padding: '4px 8px',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              >
                <option value="original">1. Original (Brute Force)</option>
                <option value="opt1">2. Opt 1 (Adjacency List)</option>
                <option value="opt2">3. Opt 2 (PQ Incremental)</option>
              </select>
            </div>

            <button 
              className="btn btn-primary"
              onClick={sim.runPartitioning}
              disabled={sim.isPartitioning || sim.isExecuting || sim.isAutoRunning}
              title="Run Single Partition Step"
              style={{ padding: '8px' }}
            >
              <Activity size={18} />
            </button>

            <button 
              className="btn"
              onClick={sim.runComparisonBenchmark}
              disabled={sim.isPartitioning || sim.isExecuting || sim.isAutoRunning}
              title="Compare All Algorithms"
              style={{ background: 'rgba(139, 92, 246, 0.2)', borderColor: '#8b5cf6', color: '#c4b5fd', padding: '8px' }}
            >
              <Layers size={18} />
            </button>
            
            <button 
              className="btn"
              onClick={() => sim.executeTransactions()}
              disabled={sim.isPartitioning || sim.isExecuting || sim.isAutoRunning}
              title="Classify & Execute"
              style={{ padding: '8px' }}
            >
              <Zap size={18} />
            </button>

            <button 
              className="btn"
              onClick={() => sim.advanceEpochs(1)}
              disabled={sim.isPartitioning || sim.isExecuting || sim.isAutoRunning}
              title="Advance 1 Epoch"
              style={{ padding: '8px' }}
            >
              <Clock size={18} />
            </button>
            
            <button 
              className={`btn ${sim.isAutoRunning ? 'active' : ''}`}
              onClick={sim.startAutoRunSequence}
              disabled={sim.isAutoRunning || sim.isPartitioning || sim.isExecuting}
              title="Start Demo"
              style={{ borderColor: sim.isAutoRunning ? 'var(--accent-purple)' : undefined, padding: '8px' }}
            >
              <Play size={18} />
            </button>
            
            <div className="divider-vertical"></div>

            <button 
              className="btn"
              onClick={sim.resetSimulation}
              disabled={sim.isPartitioning || sim.isExecuting || sim.isAutoRunning}
              title="Reset Network"
              style={{ padding: '8px', color: '#f87171' }}
            >
              <RotateCcw size={18} />
            </button>
          </div>

          <div className="divider-vertical"></div>

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
      
      {/* Priority Queue Visualizer */}
      {sim.algorithm === 'opt2' && sim.pqVisualState && showPqVisualizer && (
        <div className="floating-box pq-visualizer-box" style={{ top: '200px', right: '24px', width: '300px', zIndex: 45 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)', fontWeight: 'bold' }}>Priority Queue</h3>
               <button className="btn" style={{ padding: '2px', background: 'transparent', border: 'none', cursor: 'pointer' }} onClick={() => setShowPqInfo(true)} title="How it works">
                  <Info size={16} color="var(--accent-cyan)" />
               </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                 Tabu Sleeping: {sim.pqVisualState.tabuCount}
               </div>
               <button className="btn" style={{ padding: '2px', background: 'transparent', border: 'none', cursor: 'pointer' }} onClick={() => setShowPqVisualizer(false)}>
                  <X size={16} color="var(--text-muted)" />
               </button>
            </div>
          </div>
          
          {/* Annealing Thermometer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>Simulated Annealing Temp</span>
              <span>{Math.round((sim.pqVisualState.steps / 15) * 100)}%</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'var(--bg-card)', borderRadius: '3px', overflow: 'hidden' }}>
               <div style={{ 
                  height: '100%', 
                  width: `${(sim.pqVisualState.steps / 15) * 100}%`,
                  background: sim.pqVisualState.steps > 10 ? 'var(--accent-red)' : 'var(--accent-yellow)',
                  transition: 'width 0.1s linear, background-color 0.3s ease'
               }} />
            </div>
          </div>
          
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
            Top Congested Nodes (Live)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '250px', overflowY: 'hidden' }}>
            {sim.pqVisualState.topNodes.map((node, i) => (
              <div key={node.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '4px', background: i === 0 ? 'rgba(245, 158, 11, 0.15)' : 'transparent', borderRadius: '4px' }}>
                 <span style={{ color: i === 0 ? 'var(--accent-yellow)' : 'var(--text-main)' }}>Node {node.id}</span>
                 <span style={{ fontFamily: 'var(--font-mono)', color: '#fb923c' }}>{node.weight} cross</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* PQ Info Diagram */}
      {showPqInfo && (
        <div className="floating-box" style={{ top: '200px', right: '340px', width: '400px', zIndex: 46 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)', fontWeight: 'bold' }}>Destination-Aware Matchmaking</h3>
            <button className="btn" style={{ padding: '2px', background: 'transparent', border: 'none', cursor: 'pointer' }} onClick={() => setShowPqInfo(false)}><X size={16} color="var(--text-muted)"/></button>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            When a bottleneck node is popped, the algorithm mathematically determines its "preferred destination shard". It then explicitly cross-references the Priority Queue to find <em>other</em> highly congested nodes residing in that exact destination shard for a perfect swap.
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px' }}>
             <div style={{ border: '1px dashed var(--accent-yellow)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--accent-yellow)', marginBottom: '4px' }}>MaxHeap PQ</div>
                <div style={{ background: 'var(--accent-red)', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', marginBottom: '4px' }}>Node U (150)</div>
                <div style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>Node V (140)</div>
             </div>

             <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, alignItems: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)' }}>→ Target Shard →</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--accent-green)' }}>← Match Found ←</div>
             </div>

             <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ border: '1px solid var(--border-light)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                   <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Shard A</div>
                   <div style={{ background: 'var(--accent-red)', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>Node U</div>
                </div>
                <div style={{ border: '1px solid var(--border-light)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                   <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Shard B</div>
                   <div style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>Node V</div>
                </div>
             </div>
          </div>
        </div>
      )}
      
      {/* Narrative Banner floating near bottom */}
      <div className="narrative-banner-box">
        <h2 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, lineHeight: 1.4 }}>
          {globalNarrative}
        </h2>
      </div>

    </div>
  );
}
