# GNN-Oriented Preprocessing Schema for ESA-Mission1

**Status:** research design note (not implemented in TimeEval yet)  
**Goal:** define a *minimal but concrete* way to turn ESA-Mission1 into graph / spatio-temporal samples for GNNs, while staying compatible with ESA-ADB evaluation ideas.  
**Baseline reference:** official tabular prep in `notebooks/data-prep/Mission1_semisupervised_prep_from_raw.py` (30s ZOH, 76 channels + 11 Priority≥3 telecommands, `is_anomaly_*` codes 0/1/2/3).

> This document proposes **your variant** of preprocessing for graph models. Results from this pipeline are **not** automatic reproductions of ESA-ADB paper tables unless you keep the official CSV path and only change the model.

---

## 1. Why a graph view fits Mission1

| Dataset fact (verified) | Graph interpretation |
|---|---|
| 76 channels in 18 Groups, 4 Subsystems | Natural node communities / edge priors |
| 58 Target / 18 Non-target | Supervised nodes vs context-only nodes |
| 164 multivariate annotated events | Multi-node anomalies (subgraph / multi-label) |
| 11 Priority-3 telecommands | Event nodes or intervention signals |
| Shared 30s time grid after prep | Snapshots or sliding windows on a fixed clock |

ESA-ADB public files do **not** provide a physical wiring diagram. Allowed inductive bias from metadata: **Group**, **Subsystem**, **Target**. Finer edges (correlation, TC→channel) are research assumptions and must be stated as such.

---

## 2. Design goals (minimal viable GNN dataset)

1. Reuse official time splits (3/10/21/42/84 months train, test after `2007-01-01`).
2. Keep ESA event scoring possible via original `labels.csv` + `anomaly_types.csv`.
3. Export tensors/graphs that PyTorch Geometric (PyG) or DGL can load.
4. Start with a **static** sensor graph; optional upgrades later (TC nodes, dynamic edges).
5. Never overwrite official `data/preprocessed/multivariate/ESA-Mission1-semi-supervised/`.

---

## 3. Recommended folder layout

```text
data/
├── ESA-Mission1/                          # raw (unchanged)
│   ├── channels/
│   ├── telecommands/
│   ├── channels.csv
│   ├── telecommands.csv
│   ├── labels.csv
│   └── anomaly_types.csv
│
└── preprocessed/
    ├── multivariate/ESA-Mission1-semi-supervised/   # official CSV (keep)
    │   ├── 3_months.train.csv
    │   ├── 84_months.test.csv
    │   └── ...
    │
    └── gnn/ESA-Mission1-stgnn-v1/                   # NEW — your GNN export
        ├── meta/
        │   ├── schema.json                 # this schema version + knobs
        │   ├── node_index.csv              # node_id ↔ channel name ↔ Target/Group/Subsystem
        │   ├── edge_index.pt               # LongTensor [2, E] (or .npz.npz)
        │   ├── edge_attr.pt                # optional [E, Fe]
        │   ├── adjacency_static.npz        # dense/sparse A for STGCN-style models
        │   └── scaler_train.json           # train-only norm stats (no test leakage)
        ├── windows/
        │   ├── 3_months/
        │   │   ├── train_index.parquet     # sample_id, t_start, t_end, split
        │   │   ├── X.npy                   # memmap-friendly [N_samples, T_win, N_nodes, F]
        │   │   ├── y_node.npy              # [N_samples, T_win, N_nodes] or [N_samples, N_nodes]
        │   │   ├── y_mask.npy              # 1 = Target node (loss allowed), 0 = context
        │   │   └── gap_mask.npy            # 1 = Communication Gap / unreliable
        │   ├── 10_months/
        │   └── ...
        └── test/
            └── 84_months/
                ├── test_index.parquet
                ├── X.npy
                ├── y_node.npy
                ├── y_mask.npy
                └── gap_mask.npy
```

**Alternative (PyG-native):** store `torch_geometric.data.Data` / `HeteroData` lists as `train_graphs.pt` instead of `X.npy`. For first implementation, **numpy windows + static edge_index** is simpler and easier to debug.

---

## 4. Concrete schema (v1 — minimal)

### 4.1 Nodes

| Field | Value |
|---|---|
| `N_nodes` | **76** (all channels) — recommended v1 |
| Optional ablation | **58** Target-only nodes |
| Lightweight ablation | **6** Group-8 nodes (`channel_41`…`channel_46`) |
| Node order | sorted channel names or fixed list in `node_index.csv` |

`node_index.csv` columns:

```text
node_id,channel,subsystem,group,target,physical_unit
0,channel_1,subsystem_1,1,0,physical_unit_1
...
40,channel_41,subsystem_5,8,1,physical_unit_4
```

- `target`: 1 if `Target=YES`, else 0  
- Telecommands are **not** nodes in v1 (they are features / optional later)

### 4.2 Static edges (metadata prior)

**Default rule (v1):** undirected clique within each **Group** (18 groups).

```text
for each group G:
  for every pair (i, j) of channels in G, i < j:
      add edge i—j
```

Optional additions (ablations):

| Variant | Extra edges |
|---|---|
| `group_only` | default |
| `group+subsystem` | also connect different groups in same subsystem (or connect group hubs) |
| `target_context` | within subsystem, connect each Target to Non-target neighbors |
| `corr_topk` | from **train only**, add top-k correlation edges |

Store:

- `edge_index`: `int64` shape `[2, E]` (PyG COO, bidirectional if undirected)  
- `edge_attr` (optional): e.g. `[same_group, same_subsystem, corr_weight]`

**Do not** invent a detailed physical TC→channel wiring without labeling it as a hypothesis.

### 4.3 Time axis

| Setting | v1 default | Notes |
|---|---|---|
| Grid | **30 seconds** | match official prep |
| Source values | official resampled CSV **or** re-run ZOH yourself | prefer one source of truth |
| Window length `T_win` | **64** steps (= 32 minutes) | tune later (32/128/256) |
| Stride train | **16** | overlap OK |
| Stride test | **16** or **1** | stride 1 = denser scores, heavier I/O |
| Horizon | predict / score at window end (or full window labels) | pick one and keep fixed |

### 4.4 Node feature vector `F` (per node, per timestep)

Minimal `F = 3` (good start):

| Index | Feature | Definition |
|---:|---|---|
| 0 | `value_norm` | channel value after train-only z-score (or robust scale) |
| 1 | `is_target` | 1/0 constant per node (or omit and use mask only) |
| 2 | `tc_activity` | max of 11 Priority-3 TC peaks at this timestep (0/1), broadcast to all nodes **or** per-subsystem |

Stronger `F` (v1.1):

| Feature | Why |
|---|---|
| `delta_1` | value(t) − value(t−1) |
| `roll_std_16` | local volatility |
| `time_since_tc` | steps since last any Priority-3 TC (capped) |
| `gap_flag` | 1 if label code 3 / gap mask |

Channels 4–11 should remain **differenced** like official prep if you start from raw; if you start from official CSV, they already are.

### 4.5 Labels

| Array | Shape | Content |
|---|---|---|
| `y_node` | `[S, T_win, N]` or `[S, N]` | from `is_anomaly_<channel>` |
| Training target (suggested) | binary | map `{1,2}→1`, `{0,3}→0` **or** fault-only `{1}→1`, `{0,2,3}→0` |
| `y_mask` | same spatial shape | `1` on Target nodes only (no loss on context) |
| `gap_mask` | same | `1` where Category was Communication Gap / code 3 |

Keep original multi-class codes in an optional `y_node_raw` if you want Anomaly vs Rare analysis later.

**Evaluation:** still prefer ESA metrics on `labels.csv` intervals (event-wise), not only point-F1 on windows.

### 4.6 Normalization (no leakage)

Fit on **train split only**:

```text
for each channel c:
  mean_c, std_c from train timestamps where gap_mask==0
save to meta/scaler_train.json
apply same transform to val/test
```

---

## 5. Tensor shapes (cheat sheet)

Assume:

- `N = 76` nodes  
- `T_win = 64`  
- `F = 3`  
- `S` = number of windows  

| Name | Shape | Dtype |
|---|---|---|
| `X` | `[S, T_win, N, F]` | float32 |
| `y_node` | `[S, T_win, N]` | uint8 / float32 |
| `y_mask` | `[S, T_win, N]` | uint8 |
| `gap_mask` | `[S, T_win, N]` | uint8 |
| `edge_index` | `[2, E]` | int64 |
| `A` (optional) | `[N, N]` sparse/dense | float32 |

**PyG single-window example:**

```text
Data(
  x = X[s].reshape(T_win * N, F)   # or use Batch of T graphs / STGCN path
  edge_index = edge_index
  y = y_node[s]
  train_mask = y_mask[s].bool()
)
```

For STGCN / Graph WaveNet style models, keep `X` as `[B, F, N, T]` after loader collation (common convention — document your permute once).

---

## 6. `schema.json` example

```json
{
  "name": "ESA-Mission1-stgnn-v1",
  "version": "1.0",
  "grid_seconds": 30,
  "nodes": "all_76_channels",
  "edges": "undirected_group_cliques",
  "telecommands": {
    "mode": "feature_broadcast_max_priority3",
    "priority_min": 3,
    "count": 11
  },
  "window": {"T_win": 64, "stride_train": 16, "stride_test": 16},
  "features": ["value_norm", "is_target", "tc_activity"],
  "label_mapping": {"0": 0, "1": 1, "2": 1, "3": 0},
  "loss_on": "target_nodes_only",
  "splits": {
    "3_months": "2000-04-01",
    "10_months": "2000-11-01",
    "21_months": "2001-10-01",
    "42_months": "2003-07-01",
    "84_months": "2007-01-01",
    "test_after": "2007-01-01"
  },
  "compatible_official_csv": "data/preprocessed/multivariate/ESA-Mission1-semi-supervised/"
}
```

---

## 7. Minimal build pipeline (steps)

1. Load official `*.train.csv` / `84_months.test.csv` (or regenerate with same rules).  
2. Build `node_index.csv` from `channels.csv`.  
3. Build `edge_index` from Group cliques.  
4. Stack channel columns → `[T, N]`; stack TC columns → derive `tc_activity`.  
5. Build `y_node` from `is_anomaly_channel_*`; build `y_mask` from Target; `gap_mask` from code 3.  
6. Fit scaler on train; transform all splits.  
7. Slice windows with stride; drop or down-weight windows with >X% gap if desired.  
8. Save memmap `X.npy` + index parquet + `schema.json`.  
9. Unit checks: shapes, no NaNs after fill, edge endpoints in `[0, N)`, Target count = 58, TC count = 11.

---

## 8. Model families this schema supports

| Model family | How to use v1 export |
|---|---|
| GCN / GAT on pooled window | mean/max pool time → node features → node anomaly scores |
| STGCN / Graph WaveNet / MTGNN | `X` as spatio-temporal tensor + static `A` |
| Graph autoencoder | reconstruct `X`; score = recon error on Target nodes |
| TGN / EvolveGCN (later) | needs snapshot sequence export (v2) |
| Hetero GNN (later) | add TC nodes + typed edges (v2) |

---

## 9. Pros

1. **Uses real Mission1 structure** (Group/Subsystem/Target) instead of pretending sensors are independent.  
2. **Matches multivariate events** — GNNs can share information across co-affected channels.  
3. **Context channels still help** without requiring labels on them (`y_mask`).  
4. **Compatible with ESA metrics** if you map window scores back to timestamps and compare to `labels.csv`.  
5. **Clean ablations:** group graph vs correlation graph vs no edges; 76 vs 58 vs 6 nodes.  
6. **Separates research prep from official CSV** — Telemanom reproduction stays intact.  
7. **TC as feature** avoids inventing unverified TC→channel edges in v1.  
8. **Windowing** controls RAM better than feeding multi-year full graphs at once.

---

## 10. Cons

1. **No official physical graph** — Group cliques are a prior, not ground-truth causality.  
2. **Wrong edges can hurt** (over-smoothing, false alarm coupling).  
3. **Extra complexity** vs tabular Telemanom/IForest baselines.  
4. **Storage blow-up** if stride is small (`X.npy` can be huge).  
5. **Label alignment ambiguity** — window label vs event interval metrics may disagree.  
6. **Rare Event policy** (`2→1` vs `2→0`) changes learning meaning; must document.  
7. **Not paper-comparable** unless you also report official-prep baselines.  
8. **Message passing + long horizons** may be slower than channel-wise LSTM (Telemanom).

---

## 11. Issues you are likely to face

### 11.1 Scale / engineering

| Issue | Why it happens | Mitigation |
|---|---|---|
| RAM explosion | `S × 64 × 76 × F` windows | memmap, smaller `T_win`, larger stride, Target-58 or Group-8 subset |
| Disk explosion | overlapping windows duplicate data | store full `[T,N,F]` once + index windows by `(start,end)` |
| Slow epoch I/O | reading huge CSV repeatedly | build GNN export once from CSV; train only on `X.npy` |
| Sparse TC signal | only 11 TCs, rare peaks | use `time_since_tc`, longer windows, or hetero TC nodes later |

### 11.2 Graph / learning

| Issue | Why | Mitigation |
|---|---|---|
| Over-smoothing | deep GCN on cliques | shallow GNN (2 layers), residual/GAT, edge dropout |
| Hub dominance | large groups (e.g. group 2 has 8 context channels) | degree normalization, separate context edges |
| Spurious correlation edges | train corr ≠ causal | prefer metadata edges first; use corr only as ablation |
| Context leakage into scoring | predicting on Non-target | hard `y_mask`; score only Target channels |
| Gap filled as “normal” | official ffill | `gap_mask` zero-out loss / features |

### 11.3 Labels / evaluation

| Issue | Why | Mitigation |
|---|---|---|
| Point-F1 looks good, ESA event-F1 bad | different objectives | optimize/validate with ESAScores-style event metrics |
| Rare Event confusion | unusual but nominal | report both Anomaly-only and Rare+Anomaly |
| Multivariate partial detect | only 1 of 10 channels flagged | node loss + graph-level auxiliary loss |
| Train contamination | semi-supervised reality | optional cleaned-train ablation |

### 11.4 Scientific / reporting

| Issue | Mitigation |
|---|---|
| “We improved ESA-ADB” overclaim | say “GNN variant on Mission1 with custom graph prep” |
| Irreproducible edges | freeze `edge_index` file + seed + `schema.json` |
| Hidden hyperparams | log `T_win`, stride, label mapping, graph variant |

---

## 12. Suggested ablations (publishable)

1. **No graph** (MLP/LSTM per channel) vs **group graph GNN**  
2. Nodes: **6 (Group 8)** vs **58 Target** vs **76 all**  
3. Edges: **group** vs **group+subsystem** vs **corr top-k**  
4. Labels: **fault-only** vs **fault+rare**  
5. TC: **off** vs **broadcast feature** vs **hetero TC nodes (v2)**  
6. Gaps: **ignore mask** vs **mask loss**  
7. Same model on **3_months** vs **84_months** train horizon  

---

## 13. Version roadmap

| Version | Add |
|---|---|
| **v1 (this doc)** | 76 channel nodes, group cliques, window tensor, TC as feature, Target loss mask |
| **v2** | Heterogeneous graph: TC nodes; optional dynamic corr edges; snapshot list for TGN |
| **v3** | Hierarchical subsystem→group→channel pooling; event-subgraph supervision from `labels.csv` IDs |

---

## 14. What stays metadata (not node features unless you choose)

Keep these in side files / eval code (same philosophy as official prep):

- `Class`, `Subclass`, `Dimensionality`, `Locality`, `Length` from `anomaly_types.csv`  
- Full Priority-0/1/2 telecommand archives  
- Raw irregular timestamps (replaced by 30s grid)  
- Event IDs (use at evaluation / subgraph labeling in v3)

---

## 15. Compatibility with current repo work

| Existing artifact | Role beside GNN prep |
|---|---|
| `Mission1_semisupervised_prep_from_raw.py` | source of aligned values/labels |
| `mission1_telemanom_esa_subset.py` | strong tabular baseline (Group 8) |
| `labels.csv` + ESA metrics | final reporting |
| Official 175-col CSV | do not delete; GNN export is additive |

---

## 16. Minimal success criteria for v1 implementation

1. `edge_index.max() < 76` and undirected edges within groups only.  
2. Exactly **58** nodes with `y_mask==1`.  
3. Windows for `3_months` train load in ≤ available RAM (or memmap works).  
4. A 2-layer GAT/GCN trains one epoch without NaN loss.  
5. Timestamped scores can be exported and scored with existing ESA metric codepaths.  
6. `schema.json` committed so the experiment is reproducible.

---

## 17. One-page summary

```text
OFFICIAL PREP          →   wide CSV (T × 87 values + 87 labels)
YOUR GNN PREP (v1)     →   windows X[S,T_win,76,F]
                           + static group-graph edges
                           + labels/masks on Target nodes
                           + TC activity as a feature
                           + same calendar splits as ESA-ADB

Pros: structure, multivariate events, clean ablations
Cons: assumed edges, complexity, storage, metric mismatch risk
```

---

## 18. References inside this repo

- Raw layout: `data/ESA-Mission1/`  
- Official prep: `notebooks/data-prep/Mission1_semisupervised_prep_from_raw.py`  
- Label codes: `notebooks/data-prep/utils.py` (`AnnotationLabel`)  
- Channel metadata: `data/ESA-Mission1/channels.csv`  
- Event taxonomy: `data/ESA-Mission1/anomaly_types.csv`  
- Experiment splits / Target lists: `mission1_experiments.py`, `mission1_telemanom_esa_subset.py`

---

*Document version: 1.0 — schema for `ESA-Mission1-stgnn-v1`.*
