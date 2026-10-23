#!/usr/bin/env python3
"""CLI for standalone Telemanom-ESA inference.

  python infer.py --self-check
  python infer.py --input telemetry.csv --output-dir ./out
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from telemanom_esa_infer.engine import TelemanomInferencer, write_outputs
from telemanom_esa_infer.report import write_html_report


def self_check(artifacts: Path) -> int:
    inf = TelemanomInferencer(artifacts)
    n_in = len(inf.contract["input_channels"])
    n_tgt = len(inf.contract["target_channels"])
    model_path = artifacts / "model.h5"
    magic = model_path.read_bytes()[:8]
    print(f"artifacts: {artifacts}")
    print(f"inputs: {n_in}  targets: {n_tgt}  window: {inf.contract['window_size']}")
    print(f"means: {inf.means.shape[0]}  stds: {inf.stds.shape[0]}")
    hdf5_ok = magic[:4] == b"\x89HDF"
    print(f"model.h5: {model_path.stat().st_size} bytes  hdf5={hdf5_ok}")

    import numpy as np
    import pandas as pd

    # Need >> window_size so Telemanom error smoothing can run (uses first 250 rows).
    t = 3000
    rng = np.random.default_rng(0)
    idx = pd.date_range("2007-01-01", periods=t, freq="30s")
    data = rng.normal(loc=inf.means, scale=np.maximum(inf.stds, 1e-6), size=(t, n_in)).astype(np.float32)
    frame = pd.DataFrame(data, index=idx, columns=inf.contract["input_channels"])
    tmp = artifacts.parent / "_selfcheck_input.csv"
    frame.to_csv(tmp, index_label="timestamp")
    windows = inf._windows(frame.values)
    print(f"windows: {windows.nb_samples} samples, {len(windows)} batches")
    if windows.nb_samples != t - inf.contract["window_size"]:
        print("FAIL: window count mismatch")
        return 1

    try:
        inf.load_model()
    except ImportError:
        print("OK: contract + windowing. TensorFlow not installed; skip model predict.")
        tmp.unlink(missing_ok=True)
        return 0

    result = inf.predict(tmp, threshold=True)
    tmp.unlink(missing_ok=True)
    print(f"scores shape: {result.scores.shape}  alarms shape: {result.alarms.shape}")
    if result.scores.shape != (t, n_tgt):
        print("FAIL: score shape mismatch")
        return 1
    print("OK: model loaded and inference ran on synthetic telemetry.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Telemanom-ESA inference (no TimeEval)")
    parser.add_argument("--artifacts", type=Path, default=ROOT / "artifacts")
    parser.add_argument("--input", type=Path, help="Telemetry CSV with timestamp + 87 input columns")
    parser.add_argument("--output-dir", type=Path, help="Folder for scores.csv, alarms.csv, report.html")
    parser.add_argument("--no-threshold", action="store_true", help="Write smoothed errors only")
    parser.add_argument("--max-rows", type=int, default=None, help="Optional row cap for a short test")
    parser.add_argument(
        "--skip-rows",
        type=int,
        default=0,
        help="Skip this many data rows after the header (use to land on a labelled region)",
    )
    parser.add_argument("--self-check", action="store_true", help="Validate artifacts without a dataset")
    parser.add_argument(
        "--report-only",
        action="store_true",
        help="Rebuild report.html from existing scores.csv/alarms.csv (needs --input and --output-dir)",
    )
    parser.add_argument(
        "--no-report",
        action="store_true",
        help="Skip HTML report generation after inference",
    )
    args = parser.parse_args()

    if args.self_check:
        return self_check(args.artifacts)

    if args.input is None or args.output_dir is None:
        parser.error("--input and --output-dir are required unless --self-check")

    if args.report_only:
        write_html_report(
            args.output_dir,
            args.input,
            max_rows=args.max_rows,
            skip_rows=args.skip_rows,
        )
        return 0

    inf = TelemanomInferencer(args.artifacts)
    result = inf.predict(
        args.input,
        threshold=not args.no_threshold,
        max_rows=args.max_rows,
        skip_rows=args.skip_rows,
    )
    write_outputs(result, args.output_dir)
    if not args.no_report and result.alarms is not None:
        write_html_report(
            args.output_dir,
            args.input,
            max_rows=args.max_rows,
            skip_rows=args.skip_rows,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
