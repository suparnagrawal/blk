export function GenerateTransactions(nodes, minTxs, maxTxs) {
  const numTxs = Math.floor(Math.random() * (maxTxs - minTxs + 1)) + minTxs;
  const edgesMap = new Map();
  const txs = [];

  // Create clusters based on nodes for temporal locality
  const numClusters = Math.max(3, Math.floor(nodes.length / 15));
  const clusters = Array.from({ length: numClusters }, () => []);
  nodes.forEach((node, idx) => {
    clusters[idx % numClusters].push(node.id);
  });

  for (let i = 0; i < numTxs; i++) {
    // 80% chance to pick nodes from the same cluster
    const sameCluster = Math.random() < 0.8;
    let source, target;
    
    if (sameCluster) {
      const cluster = clusters[Math.floor(Math.random() * numClusters)];
      source = cluster[Math.floor(Math.random() * cluster.length)];
      target = cluster[Math.floor(Math.random() * cluster.length)];
      while (source === target && cluster.length > 1) {
        target = cluster[Math.floor(Math.random() * cluster.length)];
      }
    } else {
      source = nodes[Math.floor(Math.random() * nodes.length)].id;
      target = nodes[Math.floor(Math.random() * nodes.length)].id;
      while (source === target) {
        target = nodes[Math.floor(Math.random() * nodes.length)].id;
      }
    }

    const amt = Math.floor(Math.random() * 1000) + 1;
    txs.push({ source, target, amt });

    // Update edges
    const edgeId = source < target ? `${source}-${target}` : `${target}-${source}`;
    if (!edgesMap.has(edgeId)) {
      edgesMap.set(edgeId, { source, target, weight: 0 });
    }
    edgesMap.get(edgeId).weight += 1;
  }

  const edges = Array.from(edgesMap.values());
  
  // Reset and update node degrees
  nodes.forEach(n => n.degree = 0);
  edges.forEach(e => {
    const s = nodes.find(n => n.id === e.source);
    const t = nodes.find(n => n.id === e.target);
    if(s) s.degree += e.weight;
    if(t) t.degree += e.weight;
  });

  return { edges, txs };
}

export function BuildAccountGraph(numAccounts, minTxs, maxTxs) {
  const nodes = [];
  for (let i = 0; i < numAccounts; i++) {
    nodes.push({ id: `account_${i}`, degree: 0 });
  }

  const { edges, txs } = GenerateTransactions(nodes, minTxs, maxTxs);

  return { nodes, edges, txs };
}

export function InitializePartition(nodes, numShards) {
  const mapping = {};
  // Random assignment
  nodes.forEach(node => {
    mapping[node.id] = Math.floor(Math.random() * numShards);
  });
  return mapping;
}

export function GetCrossShardTraffic(edges, mapping) {
  let totalWeight = 0;
  let crossWeight = 0;
  edges.forEach(e => {
    totalWeight += e.weight;
    const sId = typeof e.source === 'object' ? e.source.id : e.source;
    const tId = typeof e.target === 'object' ? e.target.id : e.target;
    if (mapping[sId] !== mapping[tId]) {
      crossWeight += e.weight;
    }
  });
  return {
    totalWeight,
    crossWeight,
    percentage: totalWeight === 0 ? 0 : (crossWeight / totalWeight) * 100
  };
}

// Computes the gain (reduction in cross-shard edge weight) from swapping nodeA and nodeB
function computeSwapGain(nodeA, nodeB, edges, mapping) {
  const shardA = mapping[nodeA];
  const shardB = mapping[nodeB];
  
  if (shardA === shardB) return 0;

  let currentCost = 0;
  let swappedCost = 0;

  edges.forEach(e => {
    const sId = typeof e.source === 'object' ? e.source.id : e.source;
    const tId = typeof e.target === 'object' ? e.target.id : e.target;
    
    // Only care about edges connected to A or B
    const involvesA = sId === nodeA || tId === nodeA;
    const involvesB = sId === nodeB || tId === nodeB;

    if (!involvesA && !involvesB) return;

    let sShard = mapping[sId];
    let tShard = mapping[tId];

    // Current cross-shard cost
    if (sShard !== tShard) currentCost += e.weight;

    // Simulate swap
    if (sId === nodeA) sShard = shardB;
    else if (sId === nodeB) sShard = shardA;

    if (tId === nodeA) tShard = shardB;
    else if (tId === nodeB) tShard = shardA;

    if (sShard !== tShard) swappedCost += e.weight;
  });

  return currentCost - swappedCost;
}

// -------------------------------------------------------------
// Optimizations & Data Structures
// -------------------------------------------------------------

export function buildAdjacencyList(edges) {
  const adj = new Map();
  edges.forEach(e => {
    const s = typeof e.source === 'object' ? e.source.id : e.source;
    const t = typeof e.target === 'object' ? e.target.id : e.target;
    if (!adj.has(s)) adj.set(s, new Map());
    if (!adj.has(t)) adj.set(t, new Map());
    
    adj.get(s).set(t, (adj.get(s).get(t) || 0) + e.weight);
    adj.get(t).set(s, (adj.get(t).get(s) || 0) + e.weight);
  });
  return adj;
}

export function computeSwapGainOptimized(nodeA, nodeB, mapping, adj) {
  const shardA = mapping[nodeA];
  const shardB = mapping[nodeB];
  if (shardA === shardB) return 0;

  let gain = 0;

  const neighborsA = adj.get(nodeA);
  if (neighborsA) {
    for (const [neighbor, weight] of neighborsA.entries()) {
      const neighborShard = mapping[neighbor];
      if (neighborShard === shardB) gain += weight;
      if (neighborShard === shardA) gain -= weight;
    }
  }

  const neighborsB = adj.get(nodeB);
  if (neighborsB) {
    for (const [neighbor, weight] of neighborsB.entries()) {
      const neighborShard = mapping[neighbor];
      if (neighborShard === shardA) gain += weight;
      if (neighborShard === shardB) gain -= weight;
    }
  }

  // Correction for the edge between A and B
  if (neighborsA && neighborsA.has(nodeB)) {
    gain -= 2 * neighborsA.get(nodeB);
  }

  return gain;
}

export class MaxHeap {
  constructor(compareFn) {
    this.data = [];
    this.compare = compareFn;
    this.indexMap = new Map();
  }

  push(item) {
    this.data.push(item);
    this.indexMap.set(item.id, this.data.length - 1);
    this._bubbleUp(this.data.length - 1);
  }

  pop() {
    if (this.data.length === 0) return null;
    if (this.data.length === 1) {
      const item = this.data.pop();
      this.indexMap.delete(item.id);
      return item;
    }
    const top = this.data[0];
    this.indexMap.delete(top.id);
    this.data[0] = this.data.pop();
    this.indexMap.set(this.data[0].id, 0);
    this._sinkDown(0);
    return top;
  }

  update(item) {
    const idx = this.indexMap.get(item.id);
    if (idx !== undefined) {
      this.data[idx] = item;
      this._bubbleUp(idx);
      this._sinkDown(idx);
    } else {
      this.push(item);
    }
  }
  
  isEmpty() { return this.data.length === 0; }

  _bubbleUp(idx) {
    let currentIdx = idx;
    const item = this.data[currentIdx];
    while (currentIdx > 0) {
      const parentIdx = Math.floor((currentIdx - 1) / 2);
      const parent = this.data[parentIdx];
      if (this.compare(item, parent) <= 0) break;
      this.data[parentIdx] = item;
      this.data[currentIdx] = parent;
      this.indexMap.set(item.id, parentIdx);
      this.indexMap.set(parent.id, currentIdx);
      currentIdx = parentIdx;
    }
  }

  _sinkDown(idx) {
    let currentIdx = idx;
    const item = this.data[currentIdx];
    const length = this.data.length;
    while (true) {
      const leftIdx = 2 * currentIdx + 1;
      const rightIdx = 2 * currentIdx + 2;
      let swapIdx = null;

      if (leftIdx < length) {
        if (this.compare(this.data[leftIdx], item) > 0) swapIdx = leftIdx;
      }
      if (rightIdx < length) {
        if (this.compare(this.data[rightIdx], swapIdx === null ? item : this.data[leftIdx]) > 0) {
          swapIdx = rightIdx;
        }
      }

      if (swapIdx === null) break;

      const swapItem = this.data[swapIdx];
      this.data[currentIdx] = swapItem;
      this.data[swapIdx] = item;
      this.indexMap.set(swapItem.id, currentIdx);
      this.indexMap.set(item.id, swapIdx);
      currentIdx = swapIdx;
    }
  }
}

// -------------------------------------------------------------
// The Algorithms
// -------------------------------------------------------------

function processSwapState(nodes, edges, searchState, bestSwap, maxGain, mapping, algorithm = 'original') {
  let isDone = false;
  let newMapping = { ...mapping };

  if (bestSwap) {
    if (maxGain > 0 || searchState) {
      // Apply swap
      const temp = newMapping[bestSwap.u];
      newMapping[bestSwap.u] = newMapping[bestSwap.v];
      newMapping[bestSwap.v] = temp;
      
      if (searchState) {
        const currentTraffic = GetCrossShardTraffic(edges, newMapping).crossWeight;
        
        if (currentTraffic < searchState.bestCrossWeight) {
          searchState.bestCrossWeight = currentTraffic;
          searchState.bestMapping = { ...newMapping };
          searchState.stepsSinceImprovement = 0;
          searchState.tabuNodes.clear(); 
        } else {
          searchState.stepsSinceImprovement++;
          searchState.tabuNodes.add(bestSwap.u);
          searchState.tabuNodes.add(bestSwap.v);
        }
        
        const cutoff = algorithm === 'opt2' ? 15 : 5;
        if (searchState.stepsSinceImprovement >= cutoff) {
          isDone = true;
          newMapping = { ...searchState.bestMapping }; 
        }
      }
    } else {
      isDone = true; 
    }
  } else {
    isDone = true;
    if (searchState) newMapping = { ...searchState.bestMapping }; 
  }

  return { newMapping, maxGain, isDone, bestSwap };
}

function partitionOriginal(nodes, edges, mapping, searchState) {
  let bestSwap = null;
  let maxGain = -Infinity; 
  const tabu = searchState ? searchState.tabuNodes : new Set();

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const u = nodes[i].id;
      const v = nodes[j].id;
      if (mapping[u] === mapping[v]) continue;
      if (tabu.has(u) || tabu.has(v)) continue;

      const gain = computeSwapGain(u, v, edges, mapping);
      if (gain > maxGain) {
        maxGain = gain;
        bestSwap = { u, v };
      }
    }
  }
  return processSwapState(nodes, edges, searchState, bestSwap, maxGain, mapping);
}

function partitionAdjacencyOptimized(nodes, edges, mapping, searchState) {
  if (searchState && !searchState.adj) searchState.adj = buildAdjacencyList(edges);
  const adj = searchState ? searchState.adj : buildAdjacencyList(edges);

  let bestSwap = null;
  let maxGain = -Infinity; 
  const tabu = searchState ? searchState.tabuNodes : new Set();

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const u = nodes[i].id;
      const v = nodes[j].id;
      if (mapping[u] === mapping[v]) continue;
      if (tabu.has(u) || tabu.has(v)) continue;

      const gain = computeSwapGainOptimized(u, v, mapping, adj);
      if (gain > maxGain) {
        maxGain = gain;
        bestSwap = { u, v };
      }
    }
  }
  return processSwapState(nodes, edges, searchState, bestSwap, maxGain, mapping);
}

function partitionPriorityOptimized(nodes, edges, mapping, searchState) {
  if (searchState && !searchState.adj) {
    searchState.adj = buildAdjacencyList(edges);
    searchState.crossWeights = new Map();
    
    // Initialize cross shard weights
    for (const node of nodes) {
      let cw = 0;
      const neighbors = searchState.adj.get(node.id);
      if (neighbors) {
        for (const [neighbor, weight] of neighbors.entries()) {
          if (mapping[node.id] !== mapping[neighbor]) cw += weight;
        }
      }
      searchState.crossWeights.set(node.id, cw);
    }

    // Initialize MaxHeap
    searchState.pq = new MaxHeap((a, b) => a.weight - b.weight);
    for (const [id, weight] of searchState.crossWeights.entries()) {
      searchState.pq.push({ id, weight });
    }
  }

  const adj = searchState ? searchState.adj : buildAdjacencyList(edges);
  const tabu = searchState ? searchState.tabuNodes : new Set();
  
  let bestSwap = null;
  let maxGain = -Infinity;
  
  if (searchState && searchState.pq) {
    let attempts = 0;
    while (!searchState.pq.isEmpty() && attempts < 10) { 
      attempts++;

      let topNodes = [];
      for (let k = 0; k < 3; k++) {
        if (!searchState.pq.isEmpty()) {
          const node = searchState.pq.pop();
          if (!tabu.has(node.id)) {
            topNodes.push(node);
          }
        }
      }

      for (const topNode of topNodes) {
        const u = topNode.id;
        
        let candidates = [];
        if (adj.has(u)) {
          candidates = Array.from(adj.get(u).keys()).filter(n => mapping[n] !== mapping[u]);
          
          // Calculate preferred destination shard
          const shardTraffic = new Map();
          for (const [neighbor, weight] of adj.get(u).entries()) {
             const targetShard = mapping[neighbor];
             if (targetShard !== mapping[u]) {
                shardTraffic.set(targetShard, (shardTraffic.get(targetShard) || 0) + weight);
             }
          }
          
          let preferredDestination = null;
          let maxTraffic = 0;
          for (const [shard, traffic] of shardTraffic.entries()) {
             if (traffic > maxTraffic) {
                maxTraffic = traffic;
                preferredDestination = shard;
             }
          }
          
          // Destination-Aware Smart Fallback
          if (preferredDestination !== null) {
             const pqData = [...searchState.pq.data].sort((a, b) => b.weight - a.weight);
             let fallback = [];
             for (const item of pqData) {
                if (mapping[item.id] === preferredDestination && !tabu.has(item.id)) {
                   fallback.push(item.id);
                   if (fallback.length >= 10) break;
                }
             }
             candidates = [...new Set([...candidates, ...fallback])];
          }
        }
        
        if (candidates.length < 5) {
           const pqData = [...searchState.pq.data].sort((a, b) => b.weight - a.weight);
           let fallback = [];
           for (const item of pqData) {
              if (mapping[item.id] !== mapping[u] && !tabu.has(item.id)) {
                 fallback.push(item.id);
                 if (fallback.length >= 15) break;
              }
           }
           candidates = [...new Set([...candidates, ...fallback])];
        }

        for (const v of candidates) {
          if (mapping[u] === mapping[v]) continue;
          if (tabu.has(v)) continue;

          const gain = computeSwapGainOptimized(u, v, mapping, adj);
          if (gain > maxGain) {
            maxGain = gain;
            bestSwap = { u, v };
          }
        }
      }

      if (maxGain > 0) {
        for (const topNode of topNodes) {
          if (bestSwap && topNode.id !== bestSwap.u && topNode.id !== bestSwap.v) {
            searchState.pq.push(topNode);
          }
        }
        break;
      }
    }
  }

  const result = processSwapState(nodes, edges, searchState, bestSwap, maxGain, mapping, 'opt2');

  // If a swap occurred, update the Priority Queue for affected nodes only
  if (result.bestSwap && searchState && searchState.pq && !result.isDone) {
     const { u, v } = result.bestSwap;
     const newMapping = result.newMapping;
     
     const affected = new Set([u, v]);
     if (adj.has(u)) Array.from(adj.get(u).keys()).forEach(n => affected.add(n));
     if (adj.has(v)) Array.from(adj.get(v).keys()).forEach(n => affected.add(n));

     for (const id of affected) {
       let cw = 0;
       const neighbors = adj.get(id);
       if (neighbors) {
         for (const [neighbor, weight] of neighbors.entries()) {
           if (newMapping[id] !== newMapping[neighbor]) cw += weight;
         }
       }
       searchState.crossWeights.set(id, cw);
       searchState.pq.update({ id, weight: cw });
     }
  }

  return result;
}

export function PerformPartitionStep(nodes, edges, mapping, numShards, searchState, algorithm = 'original') {
  if (algorithm === 'opt1') {
    return partitionAdjacencyOptimized(nodes, edges, mapping, searchState);
  } else if (algorithm === 'opt2') {
    return partitionPriorityOptimized(nodes, edges, mapping, searchState);
  } else {
    return partitionOriginal(nodes, edges, mapping, searchState);
  }
}

export function RebalanceShards(nodes, mapping, numShards) {
  // Final rebalancing step: relocate low-degree nodes to even out shard sizes
  const shardCounts = Array.from({ length: numShards }, () => 0);
  nodes.forEach(n => shardCounts[mapping[n.id]]++);

  const targetSize = Math.floor(nodes.length / numShards);
  const newMapping = { ...mapping };
  
  // Sort nodes by degree ascending
  const sortedNodes = [...nodes].sort((a, b) => a.degree - b.degree);

  // Very naive rebalancing: move low degree nodes from overloaded shards to underloaded ones
  for (let s = 0; s < numShards; s++) {
    while (shardCounts[s] > targetSize + 1) {
      // Find a low degree node in shard s
      const nodeToMove = sortedNodes.find(n => newMapping[n.id] === s);
      if (!nodeToMove) break;
      
      // Find an underloaded shard
      const targetShard = shardCounts.findIndex(c => c < targetSize);
      if (targetShard === -1) break;

      newMapping[nodeToMove.id] = targetShard;
      shardCounts[s]--;
      shardCounts[targetShard]++;
    }
  }

  return newMapping;
}

export function ClassifyTransactions(txs, mapping) {
  const intra = [];
  const cross = [];
  
  txs.forEach(tx => {
    if (mapping[tx.source] === mapping[tx.target]) {
      intra.push(tx);
    } else {
      cross.push(tx);
    }
  });

  return { intra, cross };
}
