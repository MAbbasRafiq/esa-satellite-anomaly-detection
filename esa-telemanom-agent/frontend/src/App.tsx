/**
 * Analyst UI — question + optional telemetry attach.
 *
 * No API URLs, ports, skip_rows, or CSV paths on screen.
 * Prepared samples are small copies of the lab test file (original untouched).
 */
import { FormEvent, useEffect, useState } from "react";
import { checkHealth, fetchSamples, runAgentUpload } from "./api";
import IntentActions from "./components/IntentActions";
import TelemetryAttach from "./components/TelemetryAttach";
import ToolSteps from "./components/ToolSteps";
import { INTENTS, type Intent } from "./intents";
import type { AgentRunResponse, SampleInfo } from "./types";

export default function App() {
  const [question, setQuestion] = useState(
    "What is the look-back window size?",
  );
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [samples, setSamples] = useState<SampleInfo[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentRunResponse | null>(null);

  // Load prepared sample cards once (failures stay silent — upload still works).
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const list = await fetchSamples();
      if (!cancelled) {
        setSamples(list);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  /** True when the user has either uploaded a file or picked a sample. */
  function hasTelemetry(): boolean {
    return uploadedFile !== null || (sampleId !== null && sampleId.length > 0);
  }

  /**
   * Run the assistant with the current question + optional telemetry.
   */
  async function runCurrent(questionText: string) {
    const trimmed = questionText.trim();
    if (!trimmed) {
      setError("Please enter a question, or choose a quick action.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Soft check so we can show a calm message if the service is down.
      const ok = await checkHealth();
      if (!ok) {
        throw new Error(
          "The assistant is not available right now. Please try again in a moment.",
        );
      }

      const data = await runAgentUpload({
        question: trimmed,
        file: uploadedFile,
        sampleId: uploadedFile ? null : sampleId,
      });
      setResult(data);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await runCurrent(question);
  }

  async function handleIntent(intent: Intent) {
    setQuestion(intent.question);

    if (intent.needsTelemetry && !hasTelemetry()) {
      setError(
        "This check needs a telemetry file. Upload a CSV or choose a prepared sample first.",
      );
      return;
    }

    await runCurrent(intent.question);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-dark)]">
          ESA-ADB · Telemanom
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl leading-tight text-[var(--color-ink)] sm:text-5xl">
          Telemanom Assistant
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--color-ink-muted)] sm:text-base">
          Ask about the detection system, or attach a telemetry window to check
          for anomalies and compare with known events.
        </p>
      </header>

      <div className="space-y-8">
        {/* Quick actions */}
        <section>
          <h2 className="mb-1 text-sm font-semibold text-[var(--color-ink)]">
            Quick actions
          </h2>
          <p className="mb-3 text-xs text-[var(--color-ink-muted)]">
            One click starts a common task. Anomaly checks need a file attached
            below.
          </p>
          <IntentActions
            intents={INTENTS}
            disabled={loading}
            onChoose={handleIntent}
          />
        </section>

        {/* File attach + samples */}
        <section>
          <TelemetryAttach
            samples={samples}
            sampleId={sampleId}
            uploadedFile={uploadedFile}
            disabled={loading}
            onSelectSample={setSampleId}
            onUploadFile={setUploadedFile}
          />
        </section>

        {/* Question */}
        <section>
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]/90 p-5 shadow-sm sm:p-6"
          >
            <label className="mb-2 block text-sm font-semibold text-[var(--color-ink)]">
              Your question
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={loading}
              rows={3}
              placeholder="e.g. How many channels does the model watch?"
              className="w-full resize-y rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm leading-relaxed outline-none focus:border-[var(--color-accent)]"
            />

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-dark)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Working…" : "Ask assistant"}
              </button>
              {loading && (
                <span className="text-xs text-[var(--color-ink-muted)]">
                  Anomaly checks can take a minute…
                </span>
              )}
            </div>
          </form>
        </section>

        {error && (
          <div
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--color-danger)]"
            role="alert"
          >
            {error}
          </div>
        )}

        {result && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 shadow-sm sm:p-6">
              <h2 className="mb-3 text-sm font-semibold text-[var(--color-ink)]">
                Answer
              </h2>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--color-ink)]">
                {result.final_answer}
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]/80 p-5 shadow-sm sm:p-6">
              <h2 className="mb-3 text-sm font-semibold text-[var(--color-ink)]">
                What the system did
              </h2>
              <ToolSteps steps={result.tool_steps} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
