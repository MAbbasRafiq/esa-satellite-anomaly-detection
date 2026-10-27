/**
 * Big one-click actions for common analyst tasks.
 * Clicking fills the question + picks a preset; parent may also auto-run.
 */
import type { Intent } from "../intents";

type IntentActionsProps = {
  intents: Intent[];
  disabled?: boolean;
  onChoose: (intent: Intent) => void;
};

export default function IntentActions({
  intents,
  disabled = false,
  onChoose,
}: IntentActionsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {intents.map((intent) => (
        <button
          key={intent.id}
          type="button"
          disabled={disabled}
          onClick={() => onChoose(intent)}
          className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4 text-left transition hover:border-[var(--color-accent)] hover:bg-teal-50/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <p className="text-sm font-semibold text-[var(--color-ink)]">
            {intent.title}
          </p>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
            {intent.hint}
          </p>
        </button>
      ))}
    </div>
  );
}
