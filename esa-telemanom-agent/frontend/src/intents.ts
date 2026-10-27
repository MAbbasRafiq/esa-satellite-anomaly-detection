/**
 * One-click analyst actions.
 * Some need a telemetry file; some are facts-only (RAG).
 */
export type Intent = {
  id: string;
  title: string;
  hint: string;
  question: string;
  /** If true, the UI should require an attached / sample file. */
  needsTelemetry: boolean;
};

export const INTENTS: Intent[] = [
  {
    id: "ask_model",
    title: "Ask about the model",
    hint: "No file needed",
    question:
      "What is the look-back window size, and how many input and target channels does the model use?",
    needsTelemetry: false,
  },
  {
    id: "find_anomalies",
    title: "Check for anomalies",
    hint: "Uses your attached file or sample",
    question:
      "Score the attached telemetry and summarize which channels show alarms.",
    needsTelemetry: true,
  },
  {
    id: "compare_events",
    title: "Compare to known events",
    hint: "Uses your attached file or sample",
    question:
      "Score the attached telemetry and compare alarms to ground-truth labels. Summarize how well detections match known events.",
    needsTelemetry: true,
  },
];
