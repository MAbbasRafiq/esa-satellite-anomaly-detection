# ESA Telemanom Agent

Single LLM agent over **RAG** + **Telemanom scoring** + **label compare**.  
CLI + **FastAPI** + **React** UI. One conda env: `esa-agent` (Python).  
Frontend needs Node.js (also installable into `esa-agent` via conda-forge).

## Layout

```text
esa-telemanom-agent/
  knowledge/     ← RAG corpus
  model/         ← lab weights + contract
  rag/           ← FAISS build + retrieve
  scoring/       ← Telemanom infer + ESAScores
  agent/         ← CLI agent (3 tools)
    config.py    ← paths + .env
    tools.py     ← retrieve / score / compare
    llm.py       ← provider + tool-calling loop
    agent.py     ← terminal entrypoint
  api/           ← FastAPI HTTP wrapper
    schemas.py   ← request / response models
    main.py      ← routes: /health, /agent/run
  frontend/      ← React + Vite + Tailwind
    src/App.tsx  ← main UI
    src/api.ts   ← calls FastAPI
```

## Setup

```bash
conda activate esa-agent
cd ~/ESA_ADB/esa-telemanom-agent
pip install -r requirements.txt
cp .env.example .env   # set GROQ_API_KEY=...
```

Prefer Python 3.9–3.11 so TensorFlow can load lab `model.h5`.

Build the FAISS index once (or after changing `knowledge/`):

```bash
python -m rag.build_index
```

## RAG only (no LLM)

```bash
python -m rag.query "What is the look-back window size?"
```

## Agent (CLI)

```bash
cd agent

# Facts from knowledge/
python agent.py "What is the window size?"

# Score + compare to ground truth
python agent.py "Score the slice and compare alarms to ground-truth labels. Summarize." \
  --csv ../../data/preprocessed/multivariate/ESA-Mission1-semi-supervised/84_months.test.csv \
  --skip-rows 33064 --max-rows 3000
```

Outputs (scores / alarms) go to `agent/out/`.

## FastAPI (HTTP)

From the **project root** (not `agent/`):

```bash
conda activate esa-agent
cd ~/ESA_ADB/esa-telemanom-agent
uvicorn api.main:app --reload --host 127.0.0.1 --port 8100
```

Ports for **this** project (so it can sit beside another app on 8000 / 5173):

| Service | Port |
|---------|------|
| FastAPI | **8100** |
| React (Vite) | **5180** |

- Docs: http://127.0.0.1:8100/docs  
- Health: http://127.0.0.1:8100/health  

Example:

```bash
curl -X POST http://127.0.0.1:8100/agent/run \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the look-back window size?", "k": 3}'
```

CORS allows the React origin on port 5180.

## React UI

Needs **two terminals**: API + Vite.

```bash
# Terminal 1 — FastAPI
conda activate esa-agent
cd ~/ESA_ADB/esa-telemanom-agent
uvicorn api.main:app --reload --host 127.0.0.1 --port 8100

# Terminal 2 — React (Node required)
conda activate esa-agent   # if node was installed into this env
cd ~/ESA_ADB/esa-telemanom-agent/frontend
npm install
npm run dev
```

Open http://127.0.0.1:5180 — the UI calls `POST /agent/run` on port 8100.

Optional: copy `frontend/.env.example` → `frontend/.env` and set `VITE_API_BASE`.

## Tools

| Tool | Uses |
|------|------|
| `retrieve_knowledge` | FAISS + `knowledge/` |
| `score_telemetry` | `model/` + `scoring/` |
| `compare_alarms_to_labels` | alarms vs `is_anomaly_*` (+ ESAScores) |

No LangChain / LangGraph — custom tool-calling loop in `agent/llm.py`.
