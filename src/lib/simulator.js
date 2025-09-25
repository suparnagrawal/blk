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

export function PerformPartitionStep(nodes, edges, mapping, numShards, searchState) {
  let bestSwap = null;
  let maxGain = -Infinity; // Allow finding the "least bad" negative swap
  
  const tabu = searchState ? searchState.tabuNodes : new Set();

  // Find the best pairwise swap
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const u = nodes[i].id;
      const v = nodes[j].id;
      
      if (mapping[u] === mapping[v]) continue;
      
      // Prevent reversing recent negative swaps
      if (tabu.has(u) || tabu.has(v)) continue;

      const gain = computeSwapGain(u, v, edges, mapping);
      if (gain > maxGain) {
        maxGain = gain;
        bestSwap = { u, v };
      }
    }
  }

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
          // Found a new global best!
          searchState.bestCrossWeight = currentTraffic;
          searchState.bestMapping = { ...newMapping };
          searchState.stepsSinceImprovement = 0;
          searchState.tabuNodes.clear(); // Reset tabu list since we found a new peak
        } else {
          // Worse or equal, increment steps
          searchState.stepsSinceImprovement++;
          // Add to tabu list so we don't immediately swap them back
          searchState.tabuNodes.add(bestSwap.u);
          searchState.tabuNodes.add(bestSwap.v);
        }
        
        // Give up if we haven't improved in 5 steps
        if (searchState.stepsSinceImprovement >= 5) {
          isDone = true;
          newMapping = { ...searchState.bestMapping }; // Revert to best
        }
      }
    } else {
      isDone = true; // No search state, and maxGain <= 0
    }
  } else {
    isDone = true;
    if (searchState) newMapping = { ...searchState.bestMapping }; // Revert if absolutely stuck
  }

  return { newMapping, maxGain, isDone, bestSwap };
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
