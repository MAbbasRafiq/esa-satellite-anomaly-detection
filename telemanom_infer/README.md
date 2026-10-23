# Telemanom-ESA inference

Standalone scoring for the lab **84-month Mission1** Telemanom-ESA model.
Does **not** use TimeEval, Docker, or the rest of ESA-ADB.

## What it does

```text
telemetry CSV  →  load model.h5  →  window 250  →  LSTM forecast
               →  |pred − actual|  →  EWMA  →  Telemanom threshold
               →  scores.csv + alarms.csv + report.html
```

No training. Reuses the lab weights.

`report.html` opens in a browser: score + telemetry, labels, and alarm intervals marked **true** / **wrong** / **miss** (simple overlap check — not final ESA precision/recall).

## Setup

```bash
cd telemanom_infer
pip install -r requirements.txt
python infer.py --self-check
```

The lab container was TensorFlow **2.5.1**. If `load_model` fails, install that version (or 2.8–2.11).

## Run

CSV must have a `timestamp` column and the **87** channels listed in `artifacts/contract.json` (76 telemetry + 11 telecommands). Extra columns (`is_anomaly_*`) are ignored. Column **order in the file does not matter**; they are aligned to the lab order.

```bash
python infer.py --input /path/to/telemetry.csv --output-dir ./out
```

Writes:

| File | Content |
| --- | --- |
| `out/scores.csv` | Smoothed prediction error, 58 target channels |
| `out/alarms.csv` | 0/1 Telemanom dynamic threshold (same rule as the lab run) |
| `out/report.html` | Interactive browser view (true / wrong / miss) |

First 250 rows are zeros (look-back window; no forecast yet).

Rebuild HTML only (after you already have scores/alarms):

```bash
python infer.py --report-only \
  --input /path/to/telemetry.csv \
  --output-dir ./out_real_smoke \
  --max-rows 2350
```

Then open `out_real_smoke/report.html` in a browser (needs network once for Plotly CDN).

Scores only, no alarms:

```bash
python infer.py --input telemetry.csv --output-dir ./out --no-threshold
```

Short test on the first N rows:

```bash
python infer.py --input telemetry.csv --output-dir ./out --max-rows 2000
```

Mission1 test labels start around row **33564** (not at the beginning). Example chunk with labels:

```bash
python infer.py \
  --input ../data/preprocessed/multivariate/ESA-Mission1-semi-supervised/84_months.test.csv \
  --output-dir ./out_labeled_smoke \
  --skip-rows 31000 \
  --max-rows 5000
```

## Python

```python
from telemanom_esa_infer import TelemanomInferencer

clf = TelemanomInferencer()  # artifacts/ next to this package
result = clf.predict("telemetry.csv")
result.scores.to_csv("scores.csv")
result.alarms.to_csv("alarms.csv")
```

## Artifacts

`artifacts/` is the portable model pack from the lab full run:

- `model.h5` — LSTM `[134, 134]`
- `model.h5.means` / `model.h5.stds` — 87 values, **positional**
- `hyper_params.json` — 58 targets, `min_error_value=0`
- `contract.json` — frozen column names and indices

You can copy this whole `telemanom_infer/` folder elsewhere. It does not import TimeEval.
