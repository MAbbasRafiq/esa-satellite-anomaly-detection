/**
 * Main page for the ESA Telemanom Agent UI.
 *
 * Layout:
 *   - Header (brand + API health)
 *   - Left / top: question + run controls
 *   - Side settings: csv_path, skip_rows, max_rows, k
 *   - Results: final answer + expandable tool steps
 *
 * Data flow:
 *   form state → runAgent() in api.ts → POST FastAPI /agent/run → set result
 */
import { FormEvent, useEffect, useState } from "react";
import { checkHealth, getApiBase, runAgent } from "./api";
import ExamplePrompts from "./components/ExamplePrompts";
import ToolSteps from "./components/ToolSteps";
import type { AgentRunResponse } from "./types";

export default function App() {
  // ---- Form fields (same ideas as CLI flags / AgentRunRequest) ----
  const [question, setQuestion] = useState(
    "What is the look-back window size?",
  );
  const [csvPath, setCsvPath] = useState("");
  const [skipRows, setSkipRows] = useState(0);
  const [maxRows, setMaxRows] = useState(3000);
  const [k, setK] = useState(5);

  // ---- Request / response UI state ----
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentRunResponse | null>(null);

  // true / false / null (null = still checking on first load)
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  // On mount: ping GET /health once so the user knows if uvicorn is up.
  useEffect(() => {
    let cancelled = false;

    async function ping() {
      const ok = await checkHealth();
      if (!cancelled) {
        setApiOk(ok);
      }
    }

    ping();

    // Cleanup if the component unmounts before ping finishes.
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Submit handler for the main form.
   * Prevents full-page reload, then calls the FastAPI agent.
   */
  async function handleSubmit(event: FormEvent) {
    // Stop the browser from doing a normal HTML form post / page reload.
    event.preventDefault();

    const trimmed = question.trim();
    if (!trimmed) {
      setError("Please enter a question.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await runAgent({
        question: trimmed,
        k: k,
        // Empty string → send null so the backend treats CSV as "not set"
        csv_path: csvPath.trim() ? csvPath.trim() : null,
        max_rows: maxRows,
        skip_rows: skipRows,
      });
      setResult(data);
      // If we got a successful answer, mark API as healthy.
      setApiOk(true);
    } catch (err) {
      // Show a readable message in the UI.
      const message =
        err instanceof Error ? err.message : "Unknown error while calling the API";
      setError(message);
      setApiOk(false);
    } finally {
      // Always clear the loading flag, success or failure.
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* ---------- Header ---------- */}
      <header className="mb-8">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-dark)]">
          ESA-ADB · Telemanom
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl leading-tight text-[var(--color-ink)] sm:text-5xl">
          Telemanom Agent
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--color-ink-muted)] sm:text-base">
          Ask about the lab model via RAG, or score a telemetry CSV slice and
          compare alarms to ground-truth labels. This UI calls the FastAPI
          backend — the same tools as the CLI.
        </p>

        {/* API status chip */}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--color-ink-muted)]">
          <span
            className={
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 " +
              (apiOk === true
                ? "border-teal-200 bg-teal-50 text-teal-800"
                : apiOk === false
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-[var(--color-line)] bg-white")
            }
          >
            {/* Small status dot */}
            <span
              className={
                "h-2 w-2 rounded-full " +
                (apiOk === true
                  ? "bg-teal-500"
                  : apiOk === false
                    ? "bg-red-500"
                    : "bg-slate-300")
              }
            />
            {apiOk === null && "Checking API…"}
            {apiOk === true && "API connected"}
            {apiOk === false && "API unreachable — start uvicorn on :8100"}
          </span>
          <span className="font-mono text-[11px]">{getApiBase()}</span>
        </div>
      </header>

      {/* ---------- Main grid: settings + question ---------- */}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Settings panel (CSV slice + RAG k) */}
        <aside className="h-fit rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]/90 p-5 shadow-sm backdrop-blur">
          <h2 className="mb-4 text-sm font-semibold text-[var(--color-ink)]">
            Run settings
          </h2>

          <label className="mb-4 block text-xs font-medium text-[var(--color-ink-muted)]">
            CSV path (optional)
            <input
              type="text"
              value={csvPath}
              onChange={(e) => setCsvPath(e.target.value)}
              disabled={loading}
              placeholder="/path/to/84_months.test.csv"
              className="mt-1.5 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
            />
          </label>

          <label className="mb-4 block text-xs font-medium text-[var(--color-ink-muted)]">
            skip_rows
            <input
              type="number"
              min={0}
              value={skipRows}
              onChange={(e) => setSkipRows(Number(e.target.value) || 0)}
              disabled={loading}
              className="mt-1.5 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
          </label>

          <label className="mb-4 block text-xs font-medium text-[var(--color-ink-muted)]">
            max_rows
            <input
              type="number"
              min={1}
              value={maxRows}
              onChange={(e) => setMaxRows(Number(e.target.value) || 1)}
              disabled={loading}
              className="mt-1.5 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
          </label>

          <label className="block text-xs font-medium text-[var(--color-ink-muted)]">
            RAG k (1–8)
            <input
              type="number"
              min={1}
              max={8}
              value={k}
              onChange={(e) => {
                // Clamp into the same range the backend accepts.
                const value = Number(e.target.value) || 1;
                const clamped = Math.max(1, Math.min(8, value));
                setK(clamped);
              }}
              disabled={loading}
              className="mt-1.5 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
          </label>

          <p className="mt-4 text-[11px] leading-relaxed text-[var(--color-ink-muted)]">
            Leave CSV empty for RAG-only questions. For score / compare, set a
            path the <em>API server</em> can read (same machine as uvicorn).
          </p>
        </aside>

        {/* Question form + results */}
        <section className="space-y-6">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]/90 p-5 shadow-sm backdrop-blur sm:p-6"
          >
            <label className="mb-2 block text-sm font-semibold text-[var(--color-ink)]">
              Question
            </label>

            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={loading}
              rows={3}
              className="w-full resize-y rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm leading-relaxed text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
            />

            <div className="mt-3">
              <p className="mb-2 text-xs font-medium text-[var(--color-ink-muted)]">
                Examples
              </p>
              <ExamplePrompts
                disabled={loading}
                onSelect={(text) => setQuestion(text)}
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-dark)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {/* Button label changes while waiting for Groq + tools */}
                {loading ? "Running agent…" : "Run agent"}
              </button>

              {loading && (
                <span className="text-xs text-[var(--color-ink-muted)]">
                  This can take a while if scoring Telemanom…
                </span>
              )}
            </div>
          </form>

          {/* Error banner */}
          {error && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--color-danger)]"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Successful result */}
          {result && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 shadow-sm sm:p-6">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold text-[var(--color-ink)]">
                    Final answer
                  </h2>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    {result.provider} · {result.model}
                  </p>
                </div>
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--color-ink)]">
                  {result.final_answer}
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]/80 p-5 shadow-sm sm:p-6">
                <h2 className="mb-3 text-sm font-semibold text-[var(--color-ink)]">
                  Tool steps ({result.tool_steps.length})
                </h2>
                <ToolSteps steps={result.tool_steps} />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
