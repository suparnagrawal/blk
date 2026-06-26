# Hybrid Consensus Protocol — Sharding Simulator

This project is an interactive, client-side web demonstration of a **network sharding algorithm** designed for blockchain systems. The goal of the algorithm is to partition a network of transacting accounts into smaller, parallel "shards" in a way that minimizes cross-shard communication, which is expensive and slow compared to local, intra-shard execution.

---

## 🧠 How the Algorithm Works (Visualized)

The core algorithm is an **Iterative Pairwise Swap**. It identifies accounts that frequently interact but are placed in different shards, and swaps them to bring them into the same shard, effectively turning expensive cross-shard traffic into cheap intra-shard traffic.

### 1. Initial State (Random Assignment)
Initially, accounts are randomly assigned to shards. Because strongly connected accounts might land in different shards, the network is flooded with expensive cross-shard transactions (red lines).

```mermaid
graph LR
    subgraph Shard_1[Shard 1]
        A((Account A))
        D((Account D))
    end
    subgraph Shard_2[Shard 2]
        B((Account B))
        C((Account C))
    end

    A <-->|Heavy Traffic| C
    B <-->|Heavy Traffic| D
    
    style A fill:#06b6d4,stroke:#fff,stroke-width:2px,color:#fff
    style D fill:#06b6d4,stroke:#fff,stroke-width:2px,color:#fff
    style B fill:#ec4899,stroke:#fff,stroke-width:2px,color:#fff
    style C fill:#ec4899,stroke:#fff,stroke-width:2px,color:#fff
    
    linkStyle 0 stroke:#ef4444,stroke-width:3px;
    linkStyle 1 stroke:#ef4444,stroke-width:3px;
```

### 2. Evaluating a Swap
The algorithm evaluates pairs of nodes in different shards. It asks: *"If we swap Account A and Account B, what is the net reduction (gain) in cross-shard traffic weight?"*

If the gain is positive (meaning the swap eliminates more cross-shard traffic than it creates), the swap is executed.

### 3. Final State (Optimized Clusters)
By trading `Account A` and `Account B`, their respective heavy transaction pathways are now completely localized within their own shards. The red cross-shard edges become green intra-shard edges.

```mermaid
graph LR
    subgraph Shard_1[Shard 1]
        B((Account B))
        D((Account D))
    end
    subgraph Shard_2[Shard 2]
        A((Account A))
        C((Account C))
    end

    A <-->|Now Intra-Shard| C
    B <-->|Now Intra-Shard| D
    
    style B fill:#06b6d4,stroke:#fff,stroke-width:2px,color:#fff
    style D fill:#06b6d4,stroke:#fff,stroke-width:2px,color:#fff
    style A fill:#ec4899,stroke:#fff,stroke-width:2px,color:#fff
    style C fill:#ec4899,stroke:#fff,stroke-width:2px,color:#fff
    
    linkStyle 0 stroke:#10b981,stroke-width:3px;
    linkStyle 1 stroke:#10b981,stroke-width:3px;
```

### 4. Two-Phase Commit Execution
Once the optimal mapping is found, transactions are executed. 
- **Intra-shard transactions** run in massive parallel instantly.
- **Cross-shard transactions** are bottlenecked by a Sequential Two-Phase Commit (2PC) between the two shards, inherently limiting network throughput and increasing latency. By minimizing these via our partition algorithm, overall network performance skyrockets.

```mermaid
sequenceDiagram
    participant S1 as Shard 1
    participant S2 as Shard 2
    
    Note over S1,S2: Cross-Shard Transaction
    S1->>S2: Prepare (Lock Funds)
    S2-->>S1: Prepare Acknowledged
    S1->>S2: Commit (Transfer Funds)
    S2-->>S1: Commit Acknowledged
```

---

## ⚡ The Evolution of Partitioning Algorithms

The simulator features a modular benchmarking engine that allows you to compare three distinct graph partitioning algorithms head-to-head on the exact same topology.

### Algorithm 1: Original (Brute Force)
The baseline method. It guarantees a highly optimized local minimum but is mathematically exhaustive.
- **Approach:** Evaluates **every possible cross-shard node pair** $\mathcal{O}(V^2)$. For each candidate pair, it scans **all** edges $\mathcal{O}(E)$ in the network to compute the exact net reduction in cross-shard traffic.
- **Complexity:** $\mathcal{O}(S \cdot V^2 \cdot E)$ (where $S$ is the number of successful swaps)

```mermaid
graph TD
    subgraph Shard 1
        A(Node A)
        B(Node B)
    end
    subgraph Shard 2
        C(Node C)
        D(Node D)
    end
    A -.Evaluate Swap.-> C
    A -.Evaluate Swap.-> D
    B -.Evaluate Swap.-> C
    B -.Evaluate Swap.-> D
    style A fill:#ef4444,stroke:#fff,color:#fff
    style C fill:#ef4444,stroke:#fff,color:#fff
```

### Algorithm 2: Optimization 1 (Adjacency List)
A mathematical optimization of the brute force method that yields the exact same deterministic results but exponentially faster.
- **Approach:** Instead of scanning all edges $\mathcal{O}(E)$ to calculate the gain of swapping $u$ and $v$, it relies on a pre-computed Adjacency List. It strictly computes the delta of the direct neighbors of $u$ and $v$, reducing the gain calculation to $\mathcal{O}(deg(u) + deg(v))$.
- **Complexity:** $\mathcal{O}(S \cdot V \cdot E)$

### Algorithm 3: Optimization 2 (Priority Queue + Smart Heuristics)
A blazing fast, state-driven local search algorithm designed for massive scale. Instead of evaluating all pairs, it maintains a **MaxHeap Priority Queue** of the network's most heavily congested nodes.

- **Destination-Aware Matchmaking:** When a bottleneck node is popped from the queue, the algorithm mathematically determines its "preferred destination shard" (the shard it sends the most traffic to). It then explicitly cross-references the Priority Queue to find *other* highly congested nodes residing in that target shard, executing a perfectly matched swap.
- **Deeper Tabu Tolerance:** Because it computes candidate swaps so quickly, it can afford to execute up to 15 successive *negative gain* swaps (Simulated Annealing / Tabu Search) to intentionally climb out of deep mathematical craters, often finding significantly better global optimums than Brute Force.
- **Complexity:** $\mathcal{O}(S \cdot E \log V)$

```mermaid
graph LR
    subgraph Priority_Queue[MaxHeap Priority Queue]
        direction TB
        Top1((Node U<br>Cross-Traffic: 150))
        Top2((Node V<br>Cross-Traffic: 140))
        Top3((Node W<br>Cross-Traffic: 110))
    end

    subgraph Shard_A[Shard A]
        U(Node U)
    end

    subgraph Shard_B[Shard B]
        V(Node V)
    end

    Top1 -.Popped.-> U
    U == "Preferred Destination = Shard B" ==> Shard_B
    Shard_B -. "Finds Top Node in Shard B" .-> Top2
    Top2 -. Matches .-> V
    U <== "Perfect Swap" ==> V

    style Top1 fill:#f59e0b,stroke:#fff,color:#fff
    style U fill:#ef4444,stroke:#fff,color:#fff
    style V fill:#ef4444,stroke:#fff,color:#fff
```

---

## ⚙️ Simulator Features & Architecture

The simulator goes beyond standard visualizations by exposing an advanced benchmarking suite to validate the algorithms mathematically.

### 1. Pure CPU Profiling vs. Animation Time
When running a single algorithm step-by-step, the simulator explicitly separates **CPU Runtime** (the raw mathematical execution of the optimization logic) from **Total Runtime** (the time elapsed including the artificial UI animation delays). This provides complete transparency, proving that the underlying math executes in a few milliseconds even while the React UI visualizes it over several seconds.

### 2. Topology Snapshotting (Undo System)
A core feature of the simulator is the ability to compare algorithms head-to-head on the *exact same graph topology*. Before any single partition algorithm runs, the application takes a deep clone snapshot of the current node-to-shard mapping. The **Undo Partitioning** button instantly rolls the graph back to this exact state, allowing you to test different optimizations back-to-back without regenerating or randomizing the network edges.

### 3. Mathematically Preserved Shard Balance
Many real-world algorithms forcefully balance shards at the end of their execution, which carelessly destroys optimized cross-shard pathways. This simulator takes a mathematically strict approach:
- The initial network generation uses a strict **Round-Robin** distribution, guaranteeing perfectly balanced shards from epoch 0.
- All three partitioning algorithms strictly execute 1-to-1 Node **Swaps**. 
- Because shards start perfectly balanced and nodes only ever trade places, the shard populations remain mathematically identical throughout the entire optimization process. This entirely eliminates the need for destructive post-execution rebalancing!

## 🚀 Running the Demo Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. Open your browser and watch the algorithm optimize the network live!
