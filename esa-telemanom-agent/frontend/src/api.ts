/**
 * Small HTTP helpers for talking to the FastAPI backend.
 *
 * No axios — fetch is enough and keeps dependencies low.
 */
import type { AgentRunRequest, AgentRunResponse } from "./types";

/**
 * Base URL of the FastAPI server.
 *
 * Priority:
 *   1. VITE_API_BASE from a .env file (optional)
 *   2. Default local uvicorn address for THIS project (port 8100)
 */
export function getApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE;
  if (fromEnv && fromEnv.trim().length > 0) {
    // Remove a trailing slash so we can safely join paths.
    return fromEnv.replace(/\/$/, "");
  }
  // Not 8000 — that port is often used by other local projects.
  return "http://127.0.0.1:8100";
}

/**
 * Call GET /health to check if the API is reachable.
 * Returns true on success, false on network / non-OK response.
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${getApiBase()}/health`);
    if (!response.ok) {
      return false;
    }
    const data = (await response.json()) as { status?: string };
    return data.status === "ok";
  } catch {
    // Network error (server down, CORS blocked, etc.)
    return false;
  }
}

/**
 * Call POST /agent/run with the form values.
 * Throws an Error with a readable message if the API returns an error.
 */
export async function runAgent(
  body: AgentRunRequest,
): Promise<AgentRunResponse> {
  const response = await fetch(`${getApiBase()}/agent/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  // FastAPI returns { detail: "..." } on HTTPException.
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const errBody = (await response.json()) as { detail?: string };
      if (errBody.detail) {
        message = errBody.detail;
      }
    } catch {
      // Response was not JSON — keep the generic message.
    }
    throw new Error(message);
  }

  const data = (await response.json()) as AgentRunResponse;
  return data;
}
