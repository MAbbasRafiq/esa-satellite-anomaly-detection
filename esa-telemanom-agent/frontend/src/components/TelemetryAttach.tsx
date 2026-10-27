/**
 * Analyst file picker:
 *   - Upload your own CSV, or
 *   - Choose a prepared sample (friendly name only — no paths / row counts)
 */
import type { SampleInfo } from "../types";

type TelemetryAttachProps = {
  samples: SampleInfo[];
  /** Currently selected prepared sample id (or null). */
  sampleId: string | null;
  /** Browser File object if the user uploaded one. */
  uploadedFile: File | null;
  disabled?: boolean;
  onSelectSample: (id: string | null) => void;
  onUploadFile: (file: File | null) => void;
};

export default function TelemetryAttach({
  samples,
  sampleId,
  uploadedFile,
  disabled = false,
  onSelectSample,
  onUploadFile,
}: TelemetryAttachProps) {
  return (
    <div className="space-y-4">
      {/* Upload control */}
      <div className="rounded-2xl border border-dashed border-[var(--color-line)] bg-[var(--color-panel)] p-4">
        <p className="text-sm font-semibold text-[var(--color-ink)]">
          Attach telemetry (optional)
        </p>
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
          Upload a CSV window for anomaly checks, or skip this for general
          questions about the system.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-dark)]">
            Choose file
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={disabled}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files && e.target.files[0]
                  ? e.target.files[0]
                  : null;
                onUploadFile(file);
                // Uploading clears a prepared-sample selection.
                if (file) {
                  onSelectSample(null);
                }
              }}
            />
          </label>

          {uploadedFile && (
            <div className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
              <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-900">
                {uploadedFile.name}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onUploadFile(null)}
                className="text-xs text-[var(--color-ink-muted)] underline"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Prepared samples */}
      {samples.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--color-ink-muted)]">
            Or try a prepared sample
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {samples.map((sample) => {
              const selected = sampleId === sample.id && !uploadedFile;
              return (
                <button
                  key={sample.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onUploadFile(null);
                    onSelectSample(selected ? null : sample.id);
                  }}
                  className={
                    "rounded-2xl border p-4 text-left transition " +
                    (selected
                      ? "border-[var(--color-accent)] bg-teal-50/80"
                      : "border-[var(--color-line)] bg-[var(--color-panel)] hover:border-[var(--color-accent)]") +
                    " disabled:opacity-50"
                  }
                >
                  <p className="text-sm font-semibold text-[var(--color-ink)]">
                    {sample.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-muted)]">
                    {sample.description}
                  </p>
                  {selected && (
                    <p className="mt-2 text-[11px] font-medium text-[var(--color-accent-dark)]">
                      Selected
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
