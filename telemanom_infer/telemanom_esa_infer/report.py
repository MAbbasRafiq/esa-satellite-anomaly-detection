"""Build a browser HTML report: alarms vs labels (true / wrong / miss)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple, Union

import numpy as np
import pandas as pd

PathLike = Union[str, Path]


def _intervals(mask: np.ndarray) -> List[Tuple[int, int]]:
    """Return inclusive [start, end] index pairs where mask is True."""
    mask = np.asarray(mask, dtype=bool)
    if mask.size == 0:
        return []
    padded = np.concatenate(([False], mask, [False]))
    diff = np.diff(padded.astype(np.int8))
    starts = np.where(diff == 1)[0]
    ends = np.where(diff == -1)[0] - 1
    return [(int(s), int(e)) for s, e in zip(starts, ends)]


def _overlaps(a: Tuple[int, int], b: Tuple[int, int]) -> bool:
    return not (a[1] < b[0] or b[1] < a[0])


def classify_channel(
    alarm: np.ndarray,
    label: np.ndarray,
) -> Dict[str, object]:
    """Classify alarm/label intervals for one channel.

    Returns point-wise class array:
      0 = no alarm
      1 = true alarm (alarm segment overlaps a label segment)
      2 = wrong alarm (alarm segment with no label overlap)
    Plus miss intervals (label segments with no alarm overlap).
    """
    alarm_b = np.asarray(alarm).astype(float) > 0.5
    label_b = np.asarray(label).astype(float) > 0  # 1/2/3 all count as labelled activity
    alarm_iv = _intervals(alarm_b)
    label_iv = _intervals(label_b)

    point_class = np.zeros(len(alarm_b), dtype=np.int8)
    true_iv: List[Tuple[int, int]] = []
    wrong_iv: List[Tuple[int, int]] = []
    for iv in alarm_iv:
        hit = any(_overlaps(iv, lv) for lv in label_iv)
        if hit:
            true_iv.append(iv)
            point_class[iv[0] : iv[1] + 1] = 1
        else:
            wrong_iv.append(iv)
            point_class[iv[0] : iv[1] + 1] = 2

    miss_iv: List[Tuple[int, int]] = []
    for lv in label_iv:
        if not any(_overlaps(lv, av) for av in alarm_iv):
            miss_iv.append(lv)

    return {
        "point_class": point_class,
        "true_intervals": true_iv,
        "wrong_intervals": wrong_iv,
        "miss_intervals": miss_iv,
        "label_intervals": label_iv,
        "n_true": len(true_iv),
        "n_wrong": len(wrong_iv),
        "n_miss": len(miss_iv),
        "n_label": len(label_iv),
        "n_alarm": len(alarm_iv),
    }


def _skip_arg(skip_rows: int):
    return range(1, skip_rows + 1) if skip_rows > 0 else None


def load_labels_aligned(
    input_csv: PathLike,
    timestamps: pd.Index,
    channels: Sequence[str],
    max_rows: Optional[int] = None,
    skip_rows: int = 0,
) -> pd.DataFrame:
    """Load is_anomaly_* columns aligned to inference timestamps."""
    path = Path(input_csv)
    header = pd.read_csv(path, nrows=0).columns.tolist()
    label_cols = []
    for ch in channels:
        name = f"is_anomaly_{ch}"
        if name in header:
            label_cols.append(name)
    if "timestamp" not in header:
        raise ValueError(f"{path} has no timestamp column")
    usecols = ["timestamp"] + label_cols
    df = pd.read_csv(
        path,
        usecols=usecols,
        index_col="timestamp",
        parse_dates=True,
        skiprows=_skip_arg(skip_rows),
        nrows=max_rows,
    )
    # Align to inference index (same slice)
    df = df.reindex(timestamps)
    out = pd.DataFrame(0, index=timestamps, columns=list(channels), dtype=np.float32)
    for ch in channels:
        name = f"is_anomaly_{ch}"
        if name in df.columns:
            out[ch] = df[name].fillna(0).astype(np.float32)
    return out


def load_telemetry_aligned(
    input_csv: PathLike,
    timestamps: pd.Index,
    channels: Sequence[str],
    max_rows: Optional[int] = None,
    skip_rows: int = 0,
) -> Optional[pd.DataFrame]:
    path = Path(input_csv)
    header = pd.read_csv(path, nrows=0).columns.tolist()
    keep = [c for c in channels if c in header]
    if not keep:
        return None
    df = pd.read_csv(
        path,
        usecols=["timestamp"] + keep,
        index_col="timestamp",
        parse_dates=True,
        skiprows=_skip_arg(skip_rows),
        nrows=max_rows,
        dtype={c: np.float32 for c in keep},
    )
    df = df.reindex(timestamps)
    return df


def build_report_payload(
    scores: pd.DataFrame,
    alarms: pd.DataFrame,
    labels: pd.DataFrame,
    telemetry: Optional[pd.DataFrame] = None,
    max_points: int = 8000,
) -> dict:
    channels = list(alarms.columns)
    n = len(alarms)
    step = max(1, n // max_points) if n > max_points else 1
    idx = np.arange(0, n, step)

    ts = [t.isoformat() if hasattr(t, "isoformat") else str(t) for t in alarms.index[idx]]

    channel_stats = []
    channel_data = {}

    # Primary evaluation: channels that have at least one label in this window
    det_true = det_wrong = det_miss = det_label = det_alarm = 0
    # Secondary: alarms on channels with no label here (not scored as FP vs labels)
    other_alarm = 0
    n_labelled_ch = 0
    n_other_alarm_ch = 0

    for ch in channels:
        cls = classify_channel(alarms[ch].values, labels[ch].values)
        has_label = int(cls["n_label"]) > 0
        has_alarm = int(cls["n_alarm"]) > 0
        if has_label:
            n_labelled_ch += 1
            det_true += int(cls["n_true"])
            det_wrong += int(cls["n_wrong"])
            det_miss += int(cls["n_miss"])
            det_label += int(cls["n_label"])
            det_alarm += int(cls["n_alarm"])
            group = "labelled"
        elif has_alarm:
            n_other_alarm_ch += 1
            other_alarm += int(cls["n_alarm"])
            group = "other_alarm"
        else:
            group = "quiet"

        channel_stats.append(
            {
                "channel": ch,
                "group": group,
                "n_true": cls["n_true"],
                "n_wrong": cls["n_wrong"],
                "n_miss": cls["n_miss"],
                "n_label": cls["n_label"],
                "n_alarm": cls["n_alarm"],
            }
        )
        entry = {
            "score": [float(x) for x in scores[ch].values[idx]],
            "alarm": [int(x > 0.5) for x in alarms[ch].values[idx]],
            "label": [int(x > 0) for x in labels[ch].values[idx]],
            "alarm_class": [int(x) for x in np.asarray(cls["point_class"])[idx]],
            "true_intervals": cls["true_intervals"],
            "wrong_intervals": cls["wrong_intervals"],
            "miss_intervals": cls["miss_intervals"],
            "label_intervals": cls["label_intervals"],
            "group": group,
        }
        if telemetry is not None and ch in telemetry.columns:
            entry["value"] = [
                None if pd.isna(v) else float(v) for v in telemetry[ch].values[idx]
            ]
        channel_data[ch] = entry

    # Labelled channels first (detections before misses), then other-alarm, then quiet
    group_rank = {"labelled": 0, "other_alarm": 1, "quiet": 2}
    channel_stats.sort(
        key=lambda r: (
            group_rank.get(r["group"], 9),
            -(r["n_true"]),
            -(r["n_label"]),
            r["n_miss"],
            -(r["n_alarm"]),
            r["channel"],
        )
    )

    hit_rate = (det_true / det_label) if det_label else None

    return {
        "meta": {
            "n_rows": n,
            "n_channels": len(channels),
            "downsample_step": step,
            "n_plot_points": len(idx),
            "time_start": ts[0] if ts else None,
            "time_end": ts[-1] if ts else None,
            "window_note": "First 250 timesteps are look-back (scores/alarms padded with 0).",
            "label_rule": "label > 0 counts as labelled activity (Anomaly / Rare Event / Gap).",
            "match_rule": (
                "Primary view scores only channels that have labels in this window. "
                "Detected = alarm overlaps a label; Missed = label with no alarm; "
                "Extra alarm = alarm on a labelled channel that does not overlap a label. "
                "Alarms on channels with no label here are shown separately (not counted as false positives)."
            ),
            "disclaimer": (
                "Smoke / demo view — interval overlap on a short slice. "
                "Not the official ESA event metrics from the full TimeEval run."
            ),
        },
        "summary": {
            # Primary (labelled channels only)
            "labelled_channels": n_labelled_ch,
            "label_intervals": det_label,
            "detected": det_true,
            "missed": det_miss,
            "extra_on_labelled": det_wrong,
            "alarms_on_labelled": det_alarm,
            "detection_rate": hit_rate,
            # Secondary
            "other_alarm_channels": n_other_alarm_ch,
            "other_alarm_intervals": other_alarm,
            # Legacy keys kept for compatibility
            "true_alarm_intervals": det_true,
            "wrong_alarm_intervals": det_wrong + other_alarm,
            "miss_label_intervals": det_miss,
            "alarm_intervals": det_alarm + other_alarm,
        },
        "timestamps": ts,
        "full_index_for_intervals": True,
        "interval_index_note": "Interval indices refer to full (pre-downsample) row positions.",
        "channels_ordered": [r["channel"] for r in channel_stats],
        "channel_stats": channel_stats,
        "channels": channel_data,
    }


def _html_template(payload: dict, title: str) -> str:
    data_json = json.dumps(payload, separators=(",", ":"))
    # Escape </script> in JSON just in case
    data_json = data_json.replace("<", "\\u003c")
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>{title}</title>
<script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
<style>
  :root {{
    --bg: #0f1419;
    --panel: #1a222c;
    --text: #e7ecf1;
    --muted: #9aa7b5;
    --true: #3ecf8e;
    --wrong: #f07178;
    --miss: #e6b450;
    --label: #5b9fd4;
    --score: #c3a6ff;
    --other: #7a8794;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; font-family: "Segoe UI", system-ui, sans-serif;
    background: var(--bg); color: var(--text);
  }}
  header {{
    padding: 1rem 1.25rem 0.75rem; border-bottom: 1px solid #2a3440;
    background: linear-gradient(180deg, #15202b, var(--bg));
  }}
  h1 {{ margin: 0 0 0.35rem; font-size: 1.25rem; font-weight: 650; }}
  .sub {{ color: var(--muted); font-size: 0.9rem; max-width: 72rem; line-height: 1.45; }}
  .disclaimer {{
    margin-top: 0.55rem; font-size: 0.8rem; color: #b8c0c8;
    background: #1a2836; border-left: 3px solid #5b9fd4;
    padding: 0.45rem 0.7rem; max-width: 72rem;
  }}
  .section-label {{
    margin-top: 0.95rem; font-size: 0.75rem; letter-spacing: 0.04em;
    text-transform: uppercase; color: var(--muted);
  }}
  .summary {{
    display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.45rem;
  }}
  .card {{
    background: var(--panel); border: 1px solid #2a3440; border-radius: 10px;
    padding: 0.65rem 0.9rem; min-width: 8.5rem;
  }}
  .card.primary {{ border-color: #3a5a48; }}
  .card.secondary {{ opacity: 0.85; border-style: dashed; }}
  .card .n {{ font-size: 1.35rem; font-weight: 700; }}
  .card .l {{ color: var(--muted); font-size: 0.78rem; }}
  .true .n {{ color: var(--true); }}
  .wrong .n {{ color: var(--wrong); }}
  .miss .n {{ color: var(--miss); }}
  .other .n {{ color: var(--other); }}
  .controls {{
    display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end;
    padding: 0.85rem 1.25rem; border-bottom: 1px solid #2a3440;
  }}
  label {{ color: var(--muted); font-size: 0.85rem; }}
  select {{
    background: var(--panel); color: var(--text); border: 1px solid #3a4654;
    border-radius: 8px; padding: 0.4rem 0.6rem; min-width: 14rem;
  }}
  .toggle {{
    display: flex; gap: 0.5rem; align-items: center; color: var(--muted); font-size: 0.85rem;
  }}
  .toggle input {{ accent-color: #5b9fd4; }}
  .legend {{ display: flex; flex-wrap: wrap; gap: 0.85rem; font-size: 0.82rem; color: var(--muted); }}
  .sw {{ display: inline-block; width: 0.7rem; height: 0.7rem; border-radius: 2px; margin-right: 0.3rem; vertical-align: middle; }}
  #plot {{ width: 100%; height: 620px; }}
  #table-wrap {{ padding: 1rem 1.25rem 2rem; }}
  table {{
    width: 100%; border-collapse: collapse; font-size: 0.85rem;
    background: var(--panel); border-radius: 10px; overflow: hidden;
  }}
  th, td {{ padding: 0.45rem 0.6rem; border-bottom: 1px solid #2a3440; text-align: left; }}
  th {{ color: var(--muted); font-weight: 600; position: sticky; top: 0; background: #1e2833; }}
  tr:hover td {{ background: #222c38; cursor: pointer; }}
  tr.labelled td:first-child {{ font-weight: 600; }}
  .badge {{
    display: inline-block; font-size: 0.7rem; padding: 0.1rem 0.4rem;
    border-radius: 4px; margin-left: 0.35rem; vertical-align: middle;
  }}
  .badge.lab {{ background: #1e3a55; color: #8ec5f0; }}
  .badge.oth {{ background: #2a3038; color: #a0aab4; }}
  .note {{ color: var(--muted); font-size: 0.8rem; padding: 0 1.25rem 1rem; }}
</style>
</head>
<body>
<header>
  <h1>{title}</h1>
  <div class="sub" id="meta-line"></div>
  <div class="disclaimer" id="disclaimer"></div>
  <div class="section-label">On labelled channels (primary)</div>
  <div class="summary" id="summary-primary"></div>
  <div class="section-label">Other channels in this window (not scored vs labels)</div>
  <div class="summary" id="summary-secondary"></div>
</header>
<div class="controls">
  <div>
    <label for="channel">Channel</label><br/>
    <select id="channel"></select>
  </div>
  <label class="toggle">
    <input type="checkbox" id="labelled-only" checked/>
    Labelled channels only
  </label>
  <div class="legend">
    <span><i class="sw" style="background:var(--score)"></i>Score</span>
    <span><i class="sw" style="background:var(--true)"></i>Detected</span>
    <span><i class="sw" style="background:var(--miss)"></i>Missed label</span>
    <span><i class="sw" style="background:var(--label)"></i>Label</span>
    <span><i class="sw" style="background:var(--wrong)"></i>Extra alarm (labelled ch.)</span>
    <span><i class="sw" style="background:var(--other)"></i>Alarm (no label here)</span>
  </div>
</div>
<div id="plot"></div>
<p class="note" id="channel-note"></p>
<div id="table-wrap">
  <h2 style="font-size:1rem;margin:0 0 0.6rem;">Channels (click to open)</h2>
  <table>
    <thead>
      <tr>
        <th>Channel</th><th>Role</th><th>Labels</th><th>Detected</th>
        <th>Missed</th><th>Extra / other alarms</th>
      </tr>
    </thead>
    <tbody id="tbody"></tbody>
  </table>
</div>
<script>
const DATA = {data_json};

function pct(x) {{
  if (x === null || x === undefined) return "—";
  return (100 * x).toFixed(0) + "%";
}}

function metaText() {{
  const m = DATA.meta;
  return `Rows ${{m.n_rows}} · ${{m.n_channels}} channels · ${{m.time_start}} → ${{m.time_end}}`
    + (m.downsample_step > 1 ? ` · plot downsampled ×${{m.downsample_step}}` : "")
    + `<br/>${{m.match_rule}}`;
}}

function fillSummary() {{
  const s = DATA.summary;
  document.getElementById("disclaimer").textContent = DATA.meta.disclaimer;
  document.getElementById("summary-primary").innerHTML = `
    <div class="card primary true"><div class="n">${{s.detected}} / ${{s.label_intervals}}</div>
      <div class="l">Label intervals detected</div></div>
    <div class="card primary"><div class="n">${{pct(s.detection_rate)}}</div>
      <div class="l">Detection rate (labels hit)</div></div>
    <div class="card primary miss"><div class="n">${{s.missed}}</div>
      <div class="l">Missed label intervals</div></div>
    <div class="card primary wrong"><div class="n">${{s.extra_on_labelled}}</div>
      <div class="l">Extra alarms on labelled channels</div></div>
    <div class="card primary"><div class="n">${{s.labelled_channels}}</div>
      <div class="l">Channels with labels here</div></div>`;
  document.getElementById("summary-secondary").innerHTML = `
    <div class="card secondary other"><div class="n">${{s.other_alarm_intervals}}</div>
      <div class="l">Alarm intervals on unlabelled channels</div></div>
    <div class="card secondary other"><div class="n">${{s.other_alarm_channels}}</div>
      <div class="l">Unlabelled channels that alarmed</div></div>`;
}}

function visibleStats() {{
  const only = document.getElementById("labelled-only").checked;
  return DATA.channel_stats.filter(st => {{
    if (only) return st.group === "labelled";
    return st.group === "labelled" || st.group === "other_alarm";
  }});
}}

function fillSelect() {{
  const sel = document.getElementById("channel");
  const cur = sel.value;
  sel.innerHTML = "";
  visibleStats().forEach(st => {{
    const opt = document.createElement("option");
    opt.value = st.channel;
    if (st.group === "labelled") {{
      opt.textContent = `${{st.channel}}  · detected ${{st.n_true}}/${{st.n_label}}, miss ${{st.n_miss}}`;
    }} else {{
      opt.textContent = `${{st.channel}}  · ${{st.n_alarm}} alarms (no label in window)`;
    }}
    sel.appendChild(opt);
  }});
  if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
  else if (sel.options.length) sel.value = sel.options[0].value;
}}

function fillTable() {{
  const tb = document.getElementById("tbody");
  tb.innerHTML = "";
  visibleStats().forEach(st => {{
    const tr = document.createElement("tr");
    tr.className = st.group;
    const role = st.group === "labelled"
      ? `<span class="badge lab">labelled</span>`
      : `<span class="badge oth">no label here</span>`;
    const extra = st.group === "labelled" ? st.n_wrong : st.n_alarm;
    tr.innerHTML = `<td>${{st.channel}}</td><td>${{role}}</td>
      <td>${{st.n_label}}</td>
      <td style="color:var(--true)">${{st.n_true}}</td>
      <td style="color:var(--miss)">${{st.n_miss}}</td>
      <td style="color:${{st.group === "labelled" ? "var(--wrong)" : "var(--other)"}}">${{extra}}</td>`;
    tr.onclick = () => {{
      document.getElementById("channel").value = st.channel;
      plotChannel(st.channel);
      window.scrollTo({{ top: 0, behavior: "smooth" }});
    }};
    tb.appendChild(tr);
  }});
}}

function refreshLists(andPlot) {{
  fillSelect();
  fillTable();
  if (andPlot) {{
    const ch = document.getElementById("channel").value;
    if (ch) plotChannel(ch);
  }}
}}

function shapesForIntervals(intervals, color, opacity) {{
  const step = DATA.meta.downsample_step;
  const ts = DATA.timestamps;
  const shapes = [];
  intervals.forEach(([s, e]) => {{
    const i0 = Math.floor(s / step);
    const i1 = Math.min(ts.length - 1, Math.floor(e / step));
    if (i0 >= ts.length) return;
    shapes.push({{
      type: "rect", xref: "x", yref: "paper",
      x0: ts[i0], x1: ts[i1], y0: 0, y1: 1,
      fillcolor: color, opacity: opacity, line: {{ width: 0 }}, layer: "below"
    }});
  }});
  return shapes;
}}

function plotChannel(ch) {{
  const d = DATA.channels[ch];
  const ts = DATA.timestamps;
  const st = DATA.channel_stats.find(x => x.channel === ch);
  if (st.group === "labelled") {{
    document.getElementById("channel-note").textContent =
      `${{ch}} (labelled): ${{st.n_true}}/${{st.n_label}} detected, ${{st.n_miss}} missed, `
      + `${{st.n_wrong}} extra alarm(s) on this channel. ` + DATA.meta.window_note;
  }} else {{
    document.getElementById("channel-note").textContent =
      `${{ch}}: ${{st.n_alarm}} alarm interval(s), no ground-truth label in this window `
      + `(not counted as false positive in the primary summary). ` + DATA.meta.window_note;
  }}

  const alarmColor = st.group === "labelled" ? "#f07178" : "#7a8794";
  const shapes = []
    .concat(shapesForIntervals(d.label_intervals, "#5b9fd4", 0.18))
    .concat(shapesForIntervals(d.miss_intervals, "#e6b450", 0.28))
    .concat(shapesForIntervals(d.true_intervals, "#3ecf8e", 0.22))
    .concat(shapesForIntervals(d.wrong_intervals, alarmColor, 0.22));

  const traces = [];
  if (d.value) {{
    traces.push({{
      x: ts, y: d.value, name: "telemetry", type: "scatter", mode: "lines",
      line: {{ color: "#8b9aab", width: 1 }}, yaxis: "y3"
    }});
  }}
  traces.push({{
    x: ts, y: d.score, name: "score", type: "scatter", mode: "lines",
    line: {{ color: "#c3a6ff", width: 1.5 }}
  }});

  const xt = [], yt = [], xw = [], yw = [];
  for (let i = 0; i < ts.length; i++) {{
    if (d.alarm_class[i] === 1) {{ xt.push(ts[i]); yt.push(d.score[i]); }}
    if (d.alarm_class[i] === 2) {{ xw.push(ts[i]); yw.push(d.score[i]); }}
  }}
  traces.push({{
    x: xt, y: yt, name: "detected", type: "scatter", mode: "markers",
    marker: {{ color: "#3ecf8e", size: 6 }}
  }});
  traces.push({{
    x: xw, y: yw,
    name: st.group === "labelled" ? "extra alarm" : "alarm (no label)",
    type: "scatter", mode: "markers",
    marker: {{ color: alarmColor, size: 6, symbol: "x" }}
  }});

  const layout = {{
    paper_bgcolor: "#0f1419",
    plot_bgcolor: "#141b22",
    font: {{ color: "#e7ecf1" }},
    margin: {{ t: 30, r: 40, b: 50, l: 55 }},
    legend: {{ orientation: "h", y: 1.12 }},
    xaxis: {{ title: "time", gridcolor: "#243040", zeroline: false }},
    yaxis: {{ title: "score", gridcolor: "#243040", zeroline: false,
             domain: d.value ? [0.35, 1] : [0, 1] }},
    shapes,
    hovermode: "x unified"
  }};
  if (d.value) {{
    layout.yaxis3 = {{
      title: "value", overlaying: false, side: "left",
      domain: [0, 0.28], gridcolor: "#243040", zeroline: false
    }};
  }}
  Plotly.newPlot("plot", traces, layout, {{responsive: true, displayModeBar: true}});
}}

document.getElementById("meta-line").innerHTML = metaText();
fillSummary();
document.getElementById("channel").addEventListener("change", e => plotChannel(e.target.value));
document.getElementById("labelled-only").addEventListener("change", () => refreshLists(true));
refreshLists(true);
</script>
</body>
</html>
"""


def write_html_report(
    output_dir: PathLike,
    input_csv: PathLike,
    max_rows: Optional[int] = None,
    skip_rows: int = 0,
    title: str = "Telemanom-ESA inference report",
    filename: str = "report.html",
) -> Path:
    """Create report.html from scores.csv + alarms.csv + labels in input CSV."""
    out = Path(output_dir)
    scores = pd.read_csv(out / "scores.csv", index_col=0, parse_dates=True)
    alarms_path = out / "alarms.csv"
    if not alarms_path.is_file():
        raise FileNotFoundError(f"Need {alarms_path} to build the HTML report")
    alarms = pd.read_csv(alarms_path, index_col=0, parse_dates=True)

    channels = list(alarms.columns)
    labels = load_labels_aligned(
        input_csv, alarms.index, channels, max_rows=max_rows, skip_rows=skip_rows
    )
    telemetry = load_telemetry_aligned(
        input_csv, alarms.index, channels, max_rows=max_rows, skip_rows=skip_rows
    )

    payload = build_report_payload(scores, alarms, labels, telemetry=telemetry)
    html = _html_template(payload, title=title)
    path = out / filename
    path.write_text(html, encoding="utf-8")
    print(f"Wrote {path}")
    s = payload["summary"]
    rate = s["detection_rate"]
    rate_s = "n/a" if rate is None else f"{100 * rate:.0f}%"
    print(
        f"Labelled channels — detected {s['detected']}/{s['label_intervals']} "
        f"({rate_s}), missed {s['missed']}, extra-on-labelled {s['extra_on_labelled']}; "
        f"other-channel alarms {s['other_alarm_intervals']} "
        f"(not counted as FP in primary view)"
    )
    return path
