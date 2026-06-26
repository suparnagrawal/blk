import { useState, useEffect, useCallback, useRef } from 'react';
import { BuildAccountGraph, InitializePartition, PerformPartitionStep, RebalanceShards, GetCrossShardTraffic, ClassifyTransactions, GenerateTransactions } from '../lib/simulator';

export function useSimulator({
  numNodes = 80,
  minTxs = 400,
  maxTxs = 500,
  initialShards = 4,
  isAutoRunMaster = false,
  onNarrativeChange = () => {}
}) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [txs, setTxs] = useState([]);
  const [mapping, setMapping] = useState({});
  const [numShards, setNumShards] = useState(initialShards);
  
  const [epoch, setEpoch] = useState(1);
  const [epochHistory, setEpochHistory] = useState([]);
  
  const [isPartitioning, setIsPartitioning] = useState(false);
  const [partitionSpeed, setPartitionSpeed] = useState(150); // ms per step for better visibility
  const [partitionStats, setPartitionStats] = useState({ initialCross: 0, currentCross: 0, reduction: 0 });
  const [partitionProgress, setPartitionProgress] = useState(0);

  const [txStats, setTxStats] = useState({ intra: 0, cross: 0, throughput: 0, avgLatency: 0 });
  const [isExecuting, setIsExecuting] = useState(false);
  const [execProgress, setExecProgress] = useState(0);
  const [execLogs, setExecLogs] = useState([]);
  const [activeTxs, setActiveTxs] = useState([]);

  const [narrative, setNarrative] = useState("Initializing...");
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const autoRunRef = useRef(false);

  const swapCountRef = useRef(0);
  const searchStateRef = useRef(null);

  // Demo state
  const [demoResults, setDemoResults] = useState(null);
  const [demoPhase, setDemoPhase] = useState('idle'); // 'idle' | 'awaiting_baseline' | 'baseline_starting' | 'partitioning' | 'epoch_adv' | 'awaiting_optimized' | 'optimized_starting'

  // Algorithm Benchmarking
  const [algorithm, setAlgorithm] = useState('original');
  const [algorithmStats, setAlgorithmStats] = useState(null);
  const [comparisonStats, setComparisonStats] = useState(null);
  const partitionStartTimeRef = useRef(0);

  // Initialize graph
  useEffect(() => {
    const { nodes: n, edges: e, txs: t } = BuildAccountGraph(numNodes, minTxs, maxTxs);
    
    // Make sure we have completely fresh object references so React detects changes
    setNodes([...n]);
    setEdges([...e]);
    setTxs([...t]);
    
    const initialMap = InitializePartition(n, numShards);
    setMapping({...initialMap});
    
    const traffic = GetCrossShardTraffic(e, initialMap);
    setPartitionStats({
      initialCross: traffic.percentage,
      currentCross: traffic.percentage,
      reduction: 0
    });

  }, [numNodes, minTxs, maxTxs]); // Run once on mount per config

  useEffect(() => {
    onNarrativeChange(narrative);
  }, [narrative, onNarrativeChange]);

  // Handle shard count changes (reset partition)
  useEffect(() => {
    if (nodes.length === 0 || isAutoRunning) return;
    const initialMap = InitializePartition(nodes, numShards);
    setMapping({...initialMap});
    const traffic = GetCrossShardTraffic(edges, initialMap);
    setPartitionStats({
      initialCross: traffic.percentage,
      currentCross: traffic.percentage,
      reduction: 0
    });
  }, [numShards]);

  // Update Tx Stats when mapping changes
  useEffect(() => {
    if (txs.length === 0) return;
    const { intra, cross } = ClassifyTransactions(txs, mapping);
    setTxStats(prev => ({
      ...prev,
      intra: intra.length,
      cross: cross.length,
    }));
  }, [mapping, txs]);

  // Partitioning Loop
  useEffect(() => {
    let timer;
    if (isPartitioning) {
      if (partitionSpeed === 0) {
        // Instant
        let currentMap = { ...mapping };
        let done = false;
        let localSwaps = 0;
        
        // Setup local search state for instant calculation
        const initialTraffic = GetCrossShardTraffic(edges, currentMap).crossWeight;
        const localSearchState = {
          bestMapping: { ...currentMap },
          bestCrossWeight: initialTraffic,
          stepsSinceImprovement: 0,
          tabuNodes: new Set()
        };

        while (!done) {
          const result = PerformPartitionStep(nodes, edges, currentMap, numShards, localSearchState, algorithm);
          if (result.isDone) done = true;
          else {
            currentMap = result.newMapping;
            localSwaps++;
          }
        }
        
        currentMap = localSearchState.bestMapping; // ensure we use the best map found
        currentMap = RebalanceShards(nodes, currentMap, numShards);
        setMapping({...currentMap});
        setIsPartitioning(false);
        searchStateRef.current = null;
        
        const traffic = GetCrossShardTraffic(edges, currentMap);
        const endTime = performance.now();
        setAlgorithmStats({
          algorithm: algorithm === 'original' ? 'Original (Brute Force)' : algorithm === 'opt1' ? 'Optimization 1 (Adj List)' : 'Optimization 2 (PQ)',
          complexity: algorithm === 'original' ? 'O(SV²E)' : algorithm === 'opt1' ? 'O(SVE)' : 'O(SE log V)',
          runtimeMs: Math.round(endTime - partitionStartTimeRef.current),
          swaps: localSwaps,
          initialCross: partitionStats.initialCross,
          finalCross: traffic.percentage,
          reduction: partitionStats.initialCross - traffic.percentage
        });

        setPartitionStats(prev => ({
          ...prev,
          currentCross: traffic.percentage,
          reduction: prev.initialCross - traffic.percentage
        }));
        
        if (isAutoRunMaster) {
          if (autoRunRef.current) {
            setNarrative(`Step 2 Complete: Ran ${localSwaps} swaps. Preparing for execution...`);
          } else {
            setNarrative(`Partitioning Complete.`);
          }
        }
      } else {
        // Step-by-step
        timer = setTimeout(() => {
          const MAX_SWAPS = 200;
          const result = PerformPartitionStep(nodes, edges, mapping, numShards, searchStateRef.current, algorithm);
          if (result.isDone || swapCountRef.current >= MAX_SWAPS) {
            // Revert mapping to the best one found before rebalancing
            const finalMap = RebalanceShards(nodes, searchStateRef.current.bestMapping, numShards);
            setMapping({...finalMap});
            setIsPartitioning(false);
            setPartitionProgress(100);
            searchStateRef.current = null;
            
            const endTime = performance.now();
            const finalTraffic = GetCrossShardTraffic(edges, finalMap);
            setAlgorithmStats({
              algorithm: algorithm === 'original' ? 'Original (Brute Force)' : algorithm === 'opt1' ? 'Optimization 1 (Adj List)' : 'Optimization 2 (PQ)',
              complexity: algorithm === 'original' ? 'O(SV²E)' : algorithm === 'opt1' ? 'O(SVE)' : 'O(SE log V)',
              runtimeMs: Math.round(endTime - partitionStartTimeRef.current),
              swaps: swapCountRef.current,
              initialCross: partitionStats.initialCross,
              finalCross: finalTraffic.percentage,
              reduction: partitionStats.initialCross - finalTraffic.percentage
            });

            if (isAutoRunMaster) {
              if (autoRunRef.current) {
                setNarrative(`Step 2 Complete: Partitioning optimized for Epoch ${epoch}. Preparing for execution...`);
              } else {
                setNarrative(`Partitioning optimized for Epoch ${epoch}.`);
              }
            }
          } else {
            swapCountRef.current += 1;
            setPartitionProgress((swapCountRef.current / MAX_SWAPS) * 100);
            setMapping({...result.newMapping}); // Crucial: explicitly spread to ensure new reference!
            
            if (isAutoRunMaster) {
              if (autoRunRef.current) {
                setNarrative(`Step 2: Running partition refinement — swap ${swapCountRef.current}...`);
              } else {
                setNarrative(`Partitioning — swap ${swapCountRef.current}...`);
              }
            }
          }
          
          const traffic = GetCrossShardTraffic(edges, result.isDone ? RebalanceShards(nodes, searchStateRef.current.bestMapping, numShards) : result.newMapping);
          setPartitionStats(prev => ({
            ...prev,
            currentCross: traffic.percentage,
            reduction: prev.initialCross - traffic.percentage
          }));
        }, partitionSpeed);
      }
    }
    return () => clearTimeout(timer);
  }, [isPartitioning, mapping, nodes, edges, numShards, partitionSpeed, isAutoRunMaster]);

  const runPartitioning = () => {
    swapCountRef.current = 0;
    setPartitionProgress(0);
    
    // Initialize search state for Tabu-like local minima escape
    const currentTraffic = GetCrossShardTraffic(edges, mapping).crossWeight;
    searchStateRef.current = {
      bestMapping: { ...mapping },
      bestCrossWeight: currentTraffic,
      stepsSinceImprovement: 0,
      tabuNodes: new Set()
    };
    
    setIsPartitioning(true);
    setTxStats(prev => ({ ...prev, throughput: 0, avgLatency: 0 }));
  };

  const runComparisonBenchmark = () => {
    if (isPartitioning || isExecuting || isAutoRunning) return;
    
    const initialTraffic = GetCrossShardTraffic(edges, mapping);
    const algorithms = [
      { id: 'original', name: 'Original (Brute Force)', complexity: 'O(SV²E)' },
      { id: 'opt1', name: 'Opt 1 (Adj List)', complexity: 'O(SVE)' },
      { id: 'opt2', name: 'Opt 2 (PQ Incremental)', complexity: 'O(SE log V)' }
    ];

    const results = algorithms.map(alg => {
      let currentMap = { ...mapping };
      let done = false;
      let localSwaps = 0;
      
      const localSearchState = {
        bestMapping: { ...currentMap },
        bestCrossWeight: initialTraffic.crossWeight,
        stepsSinceImprovement: 0,
        tabuNodes: new Set()
      };

      const startTime = performance.now();
      while (!done) {
        const result = PerformPartitionStep(nodes, edges, currentMap, numShards, localSearchState, alg.id);
        if (result.isDone) done = true;
        else {
          currentMap = result.newMapping;
          localSwaps++;
        }
      }
      const finalMap = RebalanceShards(nodes, localSearchState.bestMapping, numShards);
      const endTime = performance.now();
      
      const finalTraffic = GetCrossShardTraffic(edges, finalMap);
      return {
        ...alg,
        runtimeMs: Math.round(endTime - startTime),
        swaps: localSwaps,
        finalCross: finalTraffic.percentage
      };
    });

    setComparisonStats({
      initialCross: initialTraffic.percentage,
      results
    });
    setNarrative("Comparison Benchmark Complete! View results on the left.");
  };

  const executeTransactions = (onCompleteCallback) => {
    if (isExecuting) return;
    setIsExecuting(true);
    setExecProgress(0);
    setExecLogs([]);
    
    const { intra, cross } = ClassifyTransactions(txs, mapping);
    
    if (isAutoRunMaster) {
      if (autoRunRef.current) {
        setNarrative(`Step 3: Classifying transactions: ${intra.length} intra-shard, ${cross.length} cross-shard.`);
      } else {
        setNarrative(`Classifying transactions: ${intra.length} intra-shard, ${cross.length} cross-shard.`);
      }
    }
    
    let currentProgress = 0;
    const totalTxs = txs.length;
    
    setTimeout(() => {
      setExecLogs(prev => ['[SYSTEM] Starting Parallel Intra-shard Execution...', ...prev]);
      
      let intraIdx = 0;
      const batchSize = Math.max(1, Math.ceil(intra.length / 10));
      
      let intraTimer = setInterval(() => {
        const batch = intra.slice(intraIdx, intraIdx + batchSize);
        setActiveTxs(prev => [...prev, ...batch]);
        
        intraIdx += batch.length;
        currentProgress += batch.length;
        
        if (intraIdx >= intra.length) {
          clearInterval(intraTimer);
          setExecProgress((currentProgress / totalTxs) * 100);
          
          setExecLogs(prev => ['[SYSTEM] Starting Sequential Cross-shard 2PC...', ...prev]);
          simulateCrossShard();
        } else {
          setExecProgress((currentProgress / totalTxs) * 100);
        }
      }, 100);

      const simulateCrossShard = () => {
        let crossIdx = 0;
        let crossTimer = setInterval(() => {
          if (crossIdx >= cross.length) {
            clearInterval(crossTimer);
            setIsExecuting(false);
            setActiveTxs([]);
            setExecProgress(100);
            
            // Realistic throughput modeling:
            const maxIntraTpsPerShard = 10000;
            const maxTotalIntraTps = maxIntraTpsPerShard * numShards;
            
            const crossShardCostMultiplier = 50;
            const totalWorkloadCost = intra.length * 1 + cross.length * crossShardCostMultiplier;
            
            const effectiveThroughput = (totalTxs / totalWorkloadCost) * maxTotalIntraTps;
            const jitter = 0.95 + Math.random() * 0.1; // +/- 5% variance
            const throughput = Math.floor(effectiveThroughput * jitter);

            // Latency modeling
            const avgLat = (intra.length * 10 + cross.length * 250) / totalTxs;
            const avgLatency = (avgLat * jitter).toFixed(1);
            
            setTxStats({ intra: intra.length, cross: cross.length, throughput, avgLatency });
            
            if (isAutoRunMaster) {
              if (demoPhase === 'baseline_starting') {
                setNarrative("Baseline Execution Complete.");
              } else if (demoPhase === 'optimized_starting') {
                setNarrative("Optimized Execution Complete.");
              }
            }
            if (onCompleteCallback) onCompleteCallback({ intra: intra.length, cross: cross.length, throughput, avgLatency });
            return;
          }

          const tx = cross[crossIdx];
          setActiveTxs(prev => [...prev, tx]);
          const sShard = mapping[tx.source];
          const tShard = mapping[tx.target];
          
          if (isAutoRunMaster && autoRunRef.current) {
            setNarrative(`Executing — cross-shard tx ${crossIdx+1}/${cross.length}, Prepare(Shard ${sShard}) → Prepare(Shard ${tShard}) → Commit`);
          }
          
          if (crossIdx % Math.max(1, Math.floor(cross.length / 10)) === 0) {
            setExecLogs(prev => [
              `Tx ${tx.source} -> ${tx.target}: Prepare(Shard ${sShard}) -> Prepare(Shard ${tShard}) -> Commit`,
              ...prev
            ].slice(0, 15));
          }

          crossIdx++;
          currentProgress++;
          setExecProgress((currentProgress / totalTxs) * 100);
        }, 30);
      };
    }, 1000); // 1s pause to read step 3
  };

  const advanceEpochs = (count = 1) => { // Default changed to 1 for generic advancing
    let currentMap = { ...mapping };
    let currentEpoch = epoch;
    const newHistory = [];
    
    let newEdges = [...edges];
    let newTxs = [...txs];
    
    for (let j = 0; j < count; j++) {
      // Record history before drifting this epoch
      const traffic = GetCrossShardTraffic(newEdges, currentMap);
      newHistory.push({ epoch: currentEpoch, crossTraffic: traffic.percentage });
      currentEpoch++;
      
      // No longer shuffling shard mapping of existing nodes.
      // The new epoch simply generates entirely new transactions on the existing topology.
      
      // Generate new transactions for the new epoch
      const generated = GenerateTransactions(nodes, minTxs, maxTxs);
      newEdges = generated.edges;
      newTxs = generated.txs;
    }
    
    setEpochHistory(prev => [...prev, ...newHistory]);
    setEpoch(currentEpoch);
    setMapping({...currentMap});
    setEdges(newEdges);
    setTxs(newTxs);
    
    // Reset partition stats for the new epoch
    const finalTraffic = GetCrossShardTraffic(newEdges, currentMap);
    setPartitionStats({
      initialCross: finalTraffic.percentage,
      currentCross: finalTraffic.percentage,
      reduction: 0
    });
    
    setExecProgress(0);
    setExecLogs([]);
    setTxStats(prev => ({ ...prev, throughput: 0, avgLatency: 0 }));

    if (isAutoRunMaster && !autoRunRef.current) {
      setNarrative(`Advanced to Epoch ${currentEpoch}. New real-world transactions have arrived based on the updated topology.`);
    }
  };

  const resetSimulation = () => {
    setEpoch(1);
    setEpochHistory([]);
    setTxStats({ intra: 0, cross: 0, throughput: 0, avgLatency: 0 });
    setExecProgress(0);
    setExecLogs([]);
    setDemoResults(null);
    setDemoPhase('idle');
    
    const { nodes: n, edges: e, txs: t } = BuildAccountGraph(numNodes, minTxs, maxTxs);
    setNodes([...n]);
    setEdges([...e]);
    setTxs([...t]);
    
    const initialMap = InitializePartition(n, numShards);
    setMapping({...initialMap});
    
    const traffic = GetCrossShardTraffic(e, initialMap);
    setPartitionStats({
      initialCross: traffic.percentage,
      currentCross: traffic.percentage,
      reduction: 0
    });
  };

  const startAutoRunSequence = () => {
    if (isAutoRunning) return;
    setIsAutoRunning(true);
    autoRunRef.current = true;
    
    // Step 1: Reset graph completely
    setNarrative("Step 1: Generating a completely new randomized network...");
    resetSimulation();
    setDemoPhase('awaiting_baseline');
  };

  // Orchestrator Effect
  useEffect(() => {
    if (!isAutoRunMaster || !autoRunRef.current) return;

    if (demoPhase === 'awaiting_baseline') {
      setDemoPhase('baseline_starting');
      setTimeout(() => {
        setNarrative("Step 2: Establishing baseline performance (Classify & Execute)...");
        executeTransactions((baselineStats) => {
          setDemoResults({ before: baselineStats, after: null });
          
          setTimeout(() => {
            setNarrative("Step 3: Partitioning the network to minimize cross-shard traffic...");
            setDemoPhase('partitioning');
            runPartitioning();
          }, 2000);
        });
      }, 1500);
    }
    else if (demoPhase === 'partitioning' && !isPartitioning && narrative.includes("Step 2 Complete")) {
      setDemoPhase('epoch_adv');
      setTimeout(() => {
        setNarrative("Step 4: Advancing to Epoch 2 (Spawning new transactions on optimized topology)...");
        advanceEpochs(1);
        setDemoPhase('awaiting_optimized');
      }, 1500);
    }
    else if (demoPhase === 'awaiting_optimized') {
      setDemoPhase('optimized_starting');
      setTimeout(() => {
        setNarrative("Step 5: Executing transactions on the fully optimized network...");
        executeTransactions((optimizedStats) => {
          setDemoResults(prev => ({ ...prev, after: optimizedStats }));
          setNarrative("Demo Complete! Look at the performance gains in the top left!");
          setIsAutoRunning(false);
          autoRunRef.current = false;
          setDemoPhase('idle');
        });
      }, 2000);
    }
  }, [demoPhase, isPartitioning, isAutoRunMaster, txs]);

  return {
    nodes, edges, txs, mapping, numShards, setNumShards,
    epoch, epochHistory, advanceEpochs,
    isPartitioning, partitionSpeed, setPartitionSpeed, runPartitioning, partitionStats, partitionProgress,
    txStats, isExecuting, execProgress, execLogs, executeTransactions, activeTxs,
    narrative, isAutoRunning, startAutoRunSequence,
    setIsAutoRunning, autoRunRef, demoResults,
    algorithm, setAlgorithm, algorithmStats, setAlgorithmStats,
    runComparisonBenchmark, comparisonStats, setComparisonStats,
    resetSimulation
  };
}
