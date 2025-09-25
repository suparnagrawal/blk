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

## ⏱️ Time Complexity Breakdown

Let **$V$** be the number of nodes (accounts), **$E$** be the number of unique transaction edges, and **$T$** be the total number of transactions.

| Phase | Complexity | Description |
| :--- | :--- | :--- |
| **Graph Generation** | $\mathcal{O}(V + T)$ | Accounts and highly clustered synthetic transaction flows are generated into a hash map. |
| **Traffic Calculation** | $\mathcal{O}(E)$ | Iterates through unique edges to calculate total initial vs. cross-shard traffic weight. |
| **Iterative Swap (Per Step)** | $\mathcal{O}(V^2 \cdot E)$ | Evaluates every possible cross-shard node pair $\mathcal{O}(V^2)$. For each pair, it iterates through edges $\mathcal{O}(E)$ to calculate the exact traffic reduction gain. *(Note: In a production environment, checking only adjacency lists would optimize this to $\mathcal{O}(V \cdot E)$).* |
| **Total Partition Runtime** | $\mathcal{O}(S \cdot V^2 \cdot E)$ | The loop repeats for $S$ successful swaps until the network converges and no further positive-gain swaps can be found. |
| **Shard Rebalancing** | $\mathcal{O}(V \log V + V^2)$ | Nodes are sorted by degree to seamlessly pull low-activity nodes from overloaded shards to underloaded shards to maintain size fairness. |
| **Classification** | $\mathcal{O}(T)$ | Separates transactions into `Intra` vs `Cross` queues via $\mathcal{O}(1)$ shard mapping lookups. |

---

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
