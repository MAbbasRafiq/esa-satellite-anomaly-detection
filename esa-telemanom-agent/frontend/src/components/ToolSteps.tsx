/**
 * Shows each tool the agent called (name, args, observation).
 * Uses <details> so the page stays readable when observations are long.
 */
import type { ToolStep } from "../types";

type ToolStepsProps = {
  steps: ToolStep[];
};

export default function ToolSteps({ steps }: ToolStepsProps) {
  // Nothing to show yet (before the first successful run).
  if (steps.length === 0) {
    return (
      <p className="text-sm text-[var(--color-ink-muted)]">
        Tool steps will appear here after you run the agent.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {steps.map((step, index) => {
        // Pretty-print args as JSON for debugging / understanding.
        const argsText = JSON.stringify(step.args, null, 2);

        return (
          <details
            key={`${step.tool}-${index}`}
            className="rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] open:shadow-sm"
            // First step open by default so the user sees something immediately.
            open={index === 0}
          >
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-[var(--color-ink)]">
              {/* Step number + tool name */}
              <span className="mr-2 text-[var(--color-ink-muted)]">
                {index + 1}.
              </span>
              <span className="font-semibold text-[var(--color-accent-dark)]">
                {step.tool}
              </span>
            </summary>

            <div className="space-y-3 border-t border-[var(--color-line)] px-4 py-3">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
                  Arguments
                </p>
                <pre className="overflow-x-auto rounded-md bg-[var(--color-surface)] p-3 text-xs leading-relaxed text-[var(--color-ink)]">
                  {argsText}
                </pre>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
                  Observation
                </p>
                {/* whitespace-pre-wrap keeps line breaks from the tool string */}
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-[var(--color-surface)] p-3 text-xs leading-relaxed text-[var(--color-ink)]">
                  {step.observation}
                </pre>
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
