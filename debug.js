import { BuildAccountGraph, InitializePartition, GetCrossShardTraffic, PerformPartitionStep } from './src/lib/simulator.js';

const { nodes, edges, txs } = BuildAccountGraph(80, 400, 500);
console.log("Edges:", edges.length);
let mapping = InitializePartition(nodes, 4);
let traffic = GetCrossShardTraffic(edges, mapping);
console.log("Initial Traffic:", traffic.percentage);

// Mock D3 mutating edges
edges.forEach(e => {
  e.source = nodes.find(n => n.id === e.source);
  e.target = nodes.find(n => n.id === e.target);
});

let trafficAfterD3 = GetCrossShardTraffic(edges, mapping);
console.log("Traffic after D3 mock:", trafficAfterD3.percentage);

let step = PerformPartitionStep(nodes, edges, mapping, 4);
console.log("Gain:", step.maxGain);
console.log("Is Done:", step.isDone);
