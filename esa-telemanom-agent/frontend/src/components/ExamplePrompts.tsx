/**
 * Clickable example questions so a demo does not start from a blank box.
 */
type ExamplePromptsProps = {
  /** Called when the user clicks an example — parent fills the question field. */
  onSelect: (question: string) => void;
  /** Disable while a request is in flight. */
  disabled?: boolean;
};

const EXAMPLES: string[] = [
  "What is the look-back window size?",
  "How many input and target channels does the model use?",
  "Score the slice and compare alarms to ground-truth labels. Summarize true vs wrong vs miss.",
];

export default function ExamplePrompts({
  onSelect,
  disabled = false,
}: ExamplePromptsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {EXAMPLES.map((text) => (
        <button
          key={text}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(text)}
          className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-1.5 text-left text-xs text-[var(--color-ink-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent-dark)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
