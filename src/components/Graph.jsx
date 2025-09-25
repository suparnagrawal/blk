import React, { useEffect, useMemo, useState, useRef } from 'react';
import * as d3 from 'd3';

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

export default function Graph({ nodes, edges, mapping, activeTxs = [] }) {
  const [, setTick] = useState(0);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Handle resizing
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { width, height } = dimensions;

  const simulation = useMemo(() => {
    // Only initialize force with default center, we will update it dynamically
    return d3.forceSimulation()
      .force('link', d3.forceLink().id(d => d.id).distance(50).strength(0.1))
      .force('charge', d3.forceManyBody().strength(-150));
  }, []);

  // Update forces dynamically when dimensions change
  useEffect(() => {
    if (width === 0 || height === 0) return;
    simulation
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05));
    
    simulation.alpha(0.3).restart(); // gentle nudge to re-center
  }, [width, height, simulation]);

  useEffect(() => {
    if (!nodes.length || !edges.length || width === 0) return;

    // Reset coordinates if missing (e.g. initial load)
    nodes.forEach(n => {
      if (n.x === undefined) {
        n.x = width / 2 + (Math.random() - 0.5) * 100;
        n.y = height / 2 + (Math.random() - 0.5) * 100;
      }
    });

    simulation.nodes(nodes);
    simulation.force('link').links(edges);

    simulation.on('tick', () => {
      // Force React re-render to update positions
      setTick(t => t + 1);
    });

    simulation.alpha(1).restart();

    return () => {
      simulation.on('tick', null);
      simulation.stop();
    };
  }, [nodes, edges, simulation]); // deliberately omitted width/height to avoid full restart on resize

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
      {width > 0 && height > 0 && (
        <svg width={width} height={height} style={{ display: 'block' }}>
          <g>
            {edges.map((d, i) => {
              const s = d.source;
              const t = d.target;
              const sourceId = typeof s === 'object' ? s.id : s;
              const targetId = typeof t === 'object' ? t.id : t;
              const sourceShard = mapping[sourceId];
              const targetShard = mapping[targetId];
              const isIntra = sourceShard === targetShard;
              
              const isActive = activeTxs.some(tx => 
                (tx.source === sourceId && tx.target === targetId) || 
                (tx.source === targetId && tx.target === sourceId)
              );
              
              return (
                <line
                  key={`${sourceId}-${targetId}-${i}`}
                  x1={s.x || 0}
                  y1={s.y || 0}
                  x2={t.x || 0}
                  y2={t.y || 0}
                  className="edge-transition"
                  style={{
                    stroke: isActive ? (isIntra ? '#4ade80' : '#fb923c') : isIntra ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
                    strokeWidth: isActive ? Math.max(3, Math.sqrt(d.weight) * 2) : Math.sqrt(d.weight),
                  }}
                />
              );
            })}
          </g>
          <g>
            {nodes.map(d => {
              const shard = mapping[d.id] ?? 0;
              return (
                <circle
                  key={d.id}
                  cx={Math.max(10, Math.min(width - 10, d.x || width/2))}
                  cy={Math.max(10, Math.min(height - 10, d.y || height/2))}
                  r={5 + Math.sqrt(d.degree || 0)}
                  className="node-transition"
                  style={{
                    fill: SHARD_COLORS[shard % SHARD_COLORS.length],
                    stroke: '#fff',
                    strokeWidth: 1.5,
                  }}
                />
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}
