/**
 * TypeScript types that mirror the FastAPI schemas in api/schemas.py.
 *
 * Keeping these in one file makes it easy to compare frontend ↔ backend.
 */

/** One tool call the agent made (matches ToolStep in schemas.py). */
export type ToolStep = {
  tool: string;
  args: Record<string, unknown>;
  observation: string;
};

/** Body we send to POST /agent/run (matches AgentRunRequest). */
export type AgentRunRequest = {
  question: string;
  k: number;
  /** Optional model override — send null/omit if unused. */
  model?: string | null;
  /** Optional CSV path for score / compare tools. */
  csv_path?: string | null;
  max_rows: number;
  skip_rows: number;
};

/** JSON returned by POST /agent/run (matches AgentRunResponse). */
export type AgentRunResponse = {
  provider: string;
  model: string;
  tool_steps: ToolStep[];
  final_answer: string;
};
