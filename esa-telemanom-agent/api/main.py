#!/usr/bin/env python3
"""FastAPI entrypoint for the ESA Telemanom agent.

What this file does:
  1. Creates a small HTTP app
  2. Allows a browser/React app on localhost to call it (CORS)
  3. Exposes:
       GET  /health      → simple "is the server up?" check
       POST /agent/run   → run the existing CLI agent once, return JSON

What this file does NOT do:
  - It does not retrain Telemanom
  - It does not rebuild the FAISS index
  - It does not replace agent/llm.py — it only calls run_agent()

How to run (from the project root, conda env esa-agent):

  cd ~/ESA_ADB/esa-telemanom-agent
  pip install -r requirements.txt   # includes fastapi + uvicorn
  uvicorn api.main:app --reload --host 127.0.0.1 --port 8100

Then open:
  http://127.0.0.1:8100/docs     ← interactive Swagger UI (good for testing)
  http://127.0.0.1:8100/health

Note: we use port 8100 (not 8000) so this project can run beside
another local app that already uses 8000 / 5173.
"""
from __future__ import annotations

import sys
import traceback
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# ---------------------------------------------------------------------------
# Make sure we can import the existing agent code
# ---------------------------------------------------------------------------
#
# Layout reminder:
#   esa-telemanom-agent/          ← project root (ROOT)
#     agent/                      ← CLI agent (config, tools, llm, agent.py)
#     api/                        ← this FastAPI package
#     rag/, scoring/, model/, ...
#
# When uvicorn loads "api.main", the current working directory is usually ROOT,
# but we still set sys.path explicitly so imports stay reliable.

API_DIR = Path(__file__).resolve().parent
ROOT = API_DIR.parent
AGENT_DIR = ROOT / "agent"

# Project root → import rag, scoring, api
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Agent folder → import config, tools, llm  (same style as python agent.py)
if str(AGENT_DIR) not in sys.path:
    sys.path.insert(0, str(AGENT_DIR))

# Import config first: loads .env and sets TRANSFORMERS_NO_TF.
import config  # noqa: E402, F401

# The same function the CLI uses.
from llm import run_agent  # noqa: E402

from api.schemas import AgentRunRequest, AgentRunResponse, ToolStep  # noqa: E402


# ---------------------------------------------------------------------------
# Create the FastAPI application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="ESA Telemanom Agent API",
    description=(
        "HTTP wrapper around the ESA Telemanom single agent "
        "(RAG + score_telemetry + compare_alarms_to_labels)."
    ),
    version="0.1.0",
)


# ---------------------------------------------------------------------------
# CORS — so a React app on another localhost port can call this API
# ---------------------------------------------------------------------------
#
# Frontend for THIS project runs on Vite port 5180 (see frontend/vite.config.ts).
# We also keep 5173 in the list in case you temporarily use the default Vite port.

ALLOWED_ORIGINS = [
    "http://localhost:5180",
    "http://127.0.0.1:5180",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    # Allow common methods the React app will use.
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health")
def health() -> dict:
    """Return a tiny status payload so we know the server is alive.

    Example:
      curl http://127.0.0.1:8100/health
    """
    return {
        "status": "ok",
        "service": "esa-telemanom-agent-api",
    }


@app.post("/agent/run", response_model=AgentRunResponse)
def agent_run(body: AgentRunRequest) -> AgentRunResponse:
    """Run the Telemanom agent once and return the full result as JSON.

    Flow:
      1. Client sends JSON (question + optional csv / skip / max_rows / k)
      2. We call llm.run_agent(...) — same code path as the CLI
      3. We wrap the dict into AgentRunResponse and return it

    Example with curl (RAG-only question):

      curl -X POST http://127.0.0.1:8100/agent/run \\
        -H "Content-Type: application/json" \\
        -d '{"question": "What is the look-back window size?", "k": 3}'

    Example with a telemetry CSV (score + compare):

      curl -X POST http://127.0.0.1:8100/agent/run \\
        -H "Content-Type: application/json" \\
        -d '{
              "question": "Score the slice and compare alarms to labels. Summarize.",
              "csv_path": "/path/to/84_months.test.csv",
              "skip_rows": 33064,
              "max_rows": 3000
            }'

    Note:
      This is a normal (non-async) function on purpose.
      FastAPI will run it in a worker thread so the blocking LLM /
      TensorFlow work does not freeze the whole server process in a
      confusing way. Keep it simple — no custom thread pools here.
    """
    # Basic guard: empty / whitespace-only questions are not useful.
    question = body.question.strip()
    if not question:
        raise HTTPException(
            status_code=400,
            detail="question must not be empty",
        )

    try:
        # Call the existing agent loop. Returns a plain dict:
        #   {
        #     "provider": "Groq",
        #     "model": "...",
        #     "tool_steps": [ {"tool", "args", "observation"}, ... ],
        #     "final_answer": "..."
        #   }
        result = run_agent(
            question,
            k=body.k,
            model=body.model,
            csv_hint=body.csv_path,
            default_max_rows=body.max_rows,
            default_skip_rows=body.skip_rows,
        )
    except SystemExit as exc:
        # resolve_llm_config() raises SystemExit when no API key is set.
        # Turn that into a clear HTTP 503 for the frontend.
        raise HTTPException(
            status_code=503,
            detail=str(exc) if str(exc) else "LLM is not configured (missing API key in .env)",
        ) from exc
    except Exception as exc:
        # Unexpected errors: log the traceback to the server console,
        # return a short message to the client (no huge stack dumps in JSON).
        print("ERROR in /agent/run:")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Agent failed: {type(exc).__name__}: {exc}",
        ) from exc

    # Convert each tool step dict into the ToolStep model.
    # We do this in a plain loop so it is easy to read.
    tool_steps: list[ToolStep] = []
    for step in result.get("tool_steps", []):
        tool_steps.append(
            ToolStep(
                tool=step.get("tool", ""),
                args=step.get("args", {}),
                observation=step.get("observation", ""),
            )
        )

    return AgentRunResponse(
        provider=result.get("provider", ""),
        model=result.get("model", ""),
        tool_steps=tool_steps,
        final_answer=result.get("final_answer", ""),
    )
