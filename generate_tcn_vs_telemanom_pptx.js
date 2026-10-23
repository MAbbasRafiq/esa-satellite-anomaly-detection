const pptxgen = require('pptxgenjs');

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.author = 'ESA-ADB';
pres.title = 'TCN-ESA vs Telemanom-ESA';

const C = {
  bg:      'FFFFFF',
  dark:    '1A2340',
  accent:  '2563EB',
  muted:   '64748B',
  lightbg: 'F1F5F9',
  stripe:  'FFFFFF',
  border:  'CBD5E1',
  white:   'FFFFFF',
  red:     'DC2626',
  green:   '047857',
  tel:     '1D4ED8',
  tcn:     '7C3AED',
  navy2:   '1E2D4A',
  navy3:   '2D3F5E',
  noteBg:  'FFF7ED',
  noteBd:  'FED7AA',
  codeBg:  'F8FAFC',
  blueBg:  'EFF6FF',
};

const W = 10;
const H = 5.625;
const ML = 0.4;
const MR = 0.4;
const CW = W - ML - MR; // 9.2
const N_SLIDES = 12;

function hCell(text, opts = {}) {
  return {
    text: String(text),
    options: {
      bold: true,
      color: C.white,
      fill: { color: opts.fill || C.accent },
      align: opts.align || 'center',
      valign: 'middle',
      fontSize: opts.fontSize || 10,
      fontFace: 'Calibri',
      margin: opts.margin || [5, 6, 5, 6],
    },
  };
}

function dCell(text, opts = {}) {
  return {
    text: String(text),
    options: {
      color: opts.color || C.dark,
      fill: { color: opts.fill || C.lightbg },
      align: opts.align || 'left',
      valign: opts.valign || 'middle',
      fontSize: opts.fontSize || 10,
      fontFace: opts.fontFace || 'Calibri',
      bold: !!opts.bold,
      italic: !!opts.italic,
      margin: opts.margin || [4, 6, 4, 6],
    },
  };
}

function stripeFill(i) {
  return i % 2 === 0 ? C.stripe : C.lightbg;
}

function addFooter(sl, n) {
  sl.addText(`${n} / ${N_SLIDES}`, {
    x: W - MR - 0.9, y: H - 0.28, w: 0.9, h: 0.2,
    fontSize: 9, color: C.muted, fontFace: 'Calibri',
    align: 'right', margin: 0, valign: 'middle',
  });
}

function addSlide(title, subtitle, n) {
  const sl = pres.addSlide();
  sl.background = { color: C.bg };
  sl.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: W, h: 0.07,
    fill: { color: C.accent }, line: { color: C.accent },
  });
  sl.addText(title, {
    x: ML, y: 0.14, w: CW, h: subtitle ? 0.36 : 0.42,
    fontSize: 20, bold: true, color: C.dark,
    fontFace: 'Calibri', margin: 0, valign: 'middle',
  });
  if (subtitle) {
    sl.addText(subtitle, {
      x: ML, y: 0.5, w: CW, h: 0.28,
      fontSize: 11, color: C.muted, fontFace: 'Calibri', margin: 0, valign: 'middle',
    });
  }
  addFooter(sl, n);
  return sl;
}

function tableOpts(x, y, w, colW, extra = {}) {
  const { nRows, ...rest } = extra;
  let h = rest.h;
  if (h == null && rest.rowH != null) {
    if (Array.isArray(rest.rowH)) h = rest.rowH.reduce((a, b) => a + b, 0);
    else if (nRows) h = rest.rowH * nRows;
  }
  return {
    x, y, w,
    ...(h != null ? { h } : {}),
    colW,
    border: { color: C.border, pt: 0.5 },
    fontFace: 'Calibri',
    valign: 'middle',
    ...rest,
  };
}

function noteBox(sl, text, x, y, w, h) {
  sl.addShape(pres.ShapeType.rect, {
    x, y, w, h,
    fill: { color: C.noteBg },
    line: { color: C.noteBd, pt: 0.75 },
  });
  sl.addText(text, {
    x: x + 0.1, y: y + 0.06, w: w - 0.2, h: h - 0.1,
    fontSize: 10, color: C.dark, fontFace: 'Calibri',
    italic: true, margin: 0, valign: 'middle',
  });
}

// ─────────────────────────────────────────
// Slide 1 — Title
// ─────────────────────────────────────────
{
  const sl = pres.addSlide();
  sl.background = { color: C.dark };
  sl.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: W, h: 0.08,
    fill: { color: C.accent }, line: { color: C.accent },
  });
  sl.addShape(pres.ShapeType.rect, {
    x: 0, y: H - 0.08, w: W, h: 0.08,
    fill: { color: C.accent }, line: { color: C.accent },
  });

  sl.addText('TCN-ESA vs Telemanom-ESA', {
    x: 0.55, y: 0.55, w: 8.9, h: 0.7,
    fontSize: 32, bold: true, color: C.white,
    fontFace: 'Calibri', align: 'center', margin: 0,
  });
  sl.addText('Mission1 Full Run — Algorithm Comparison', {
    x: 0.55, y: 1.28, w: 8.9, h: 0.38,
    fontSize: 16, color: 'A5B4C8',
    fontFace: 'Calibri', align: 'center', margin: 0,
  });

  const rows = [
    [hCell('Field', { fill: C.accent, align: 'left' }), hCell('Value', { fill: C.accent, align: 'left' })],
    [dCell('Models', { bold: true, color: C.white, fill: C.navy2 }), dCell('TCN-ESA vs Telemanom-ESA (LSTM)', { color: 'A5B4C8', fill: C.navy2 })],
    [dCell('Paper baseline', { bold: true, color: C.white, fill: C.navy2 }), dCell('ESA-ADB Telemanom-ESA (and Pruned) — Mission1 full set', { color: 'A5B4C8', fill: C.navy2 })],
    [dCell('Split', { bold: true, color: C.white, fill: C.navy2 }), dCell('ESA-Mission1 84_months train + same full test', { color: 'A5B4C8', fill: C.navy2 })],
    [dCell('Targets', { bold: true, color: C.white, fill: C.navy2 }), dCell('58 channels', { color: 'A5B4C8', fill: C.navy2 })],
    [dCell('Our Telemanom', { bold: true, color: C.white, fill: C.navy2 }), dCell('Lab PC full run (deck you already presented)', { color: 'A5B4C8', fill: C.navy2 })],
    [dCell('Our TCN', { bold: true, color: C.white, fill: C.navy2 }), dCell('Lab PC full run — Status.OK, execute 9656 s ≈ 2.7 h', { color: 'A5B4C8', fill: C.navy2 })],
  ];
  sl.addTable(rows, tableOpts(0.7, 1.85, 8.6, [2.3, 6.3], {
    rowH: 0.36,
    nRows: 7,
    border: { color: C.navy3, pt: 0.5 },
  }));

  sl.addText('Same data contract for both our runs. Paper numbers = ESA-ADB Table 2 (combined) and Supplementary Table 9 (anomaly-only).', {
    x: 0.7, y: 4.5, w: 8.6, h: 0.45,
    fontSize: 11, color: '7A90A8', fontFace: 'Calibri',
    italic: true, align: 'center', margin: 0, valign: 'middle',
  });
  sl.addText('1 / 12', {
    x: W - 1.4, y: H - 0.32, w: 0.9, h: 0.18,
    fontSize: 9, color: '7A90A8', fontFace: 'Calibri', align: 'right', margin: 0,
  });
}

// ─────────────────────────────────────────
// Slide 2 — Model Input
// ─────────────────────────────────────────
{
  const sl = addSlide('Model Input (Same for Both Our Runs)', 'What we fed the model', 2);

  sl.addText('Inputs (features)', {
    x: ML, y: 0.86, w: 4.4, h: 0.26,
    fontSize: 13, bold: true, color: C.accent, fontFace: 'Calibri', margin: 0,
  });
  sl.addText(
    '•  Telemetry + telecommands\n\n' +
    '•  87 input features: 76 telemetry channels (channel_1–channel_76) + 11 Priority-3 telecommands\n\n' +
    '•  Not targets-only — learns cross-sensor / command correlations',
    {
      x: ML, y: 1.14, w: 4.45, h: 1.18,
      fontSize: 12, color: C.dark, fontFace: 'Calibri',
      valign: 'top', margin: 0,
    }
  );

  sl.addText('Targets (scored) — 58 channels', {
    x: ML, y: 2.38, w: 4.45, h: 0.26,
    fontSize: 13, bold: true, color: C.accent, fontFace: 'Calibri', margin: 0,
  });
  sl.addShape(pres.ShapeType.rect, {
    x: ML, y: 2.68, w: 4.45, h: 1.55,
    fill: { color: C.blueBg }, line: { color: C.border, pt: 0.75 },
  });
  sl.addText(
    'channel_12  →  channel_52     (41)\n' +
    'channel_57  →  channel_66     (10)\n' +
    'channel_70  →  channel_76      (7)\n' +
    '─────────────────────────────\n' +
    'Total evaluated:  58 channels',
    {
      x: ML + 0.15, y: 2.76, w: 4.15, h: 1.4,
      fontSize: 12, color: C.dark, fontFace: 'Courier New',
      margin: 0, valign: 'middle',
    }
  );

  sl.addText('Windowing (identical contract)', {
    x: 5.15, y: 0.86, w: 4.45, h: 0.26,
    fontSize: 13, bold: true, color: C.accent, fontFace: 'Calibri', margin: 0,
  });
  const wRows = [
    [hCell('Param', { align: 'left' }), hCell('Value', { align: 'left' })],
    [dCell('window_size', { fontFace: 'Courier New', fill: C.stripe }), dCell('250', { fill: C.stripe })],
    [dCell('prediction_window_size', { fontFace: 'Courier New', fill: C.lightbg }), dCell('10', { fill: C.lightbg })],
    [dCell('Train policy', { fill: C.stripe, valign: 'top' }), dCell('Nominal fragments only. validation_date_split = 2006-10-01 (early-stopping split inside the 84_months train file).', { fill: C.stripe, valign: 'top' })],
    [dCell('Thresholding', { fill: C.lightbg }), dCell('Telemanom nonparametric dynamic thresholding', { fill: C.lightbg })],
    [dCell('min_error_value', { fontFace: 'Courier New', fill: C.stripe }), dCell('0  (paper Telemanom-ESA setting, not Pruned 0.007)', { fill: C.stripe })],
  ];
  sl.addTable(wRows, tableOpts(5.15, 1.14, 4.45, [1.55, 2.9], {
    rowH: [0.3, 0.32, 0.32, 0.78, 0.42, 0.48],
  }));

  sl.addText('One multi-output model for all sensors (not one model per channel).', {
    x: ML, y: 4.95, w: CW, h: 0.28,
    fontSize: 11, italic: true, color: C.muted, fontFace: 'Calibri', margin: 0,
  });
}

// ─────────────────────────────────────────
// Slide 3 — TCN Variant
// ─────────────────────────────────────────
{
  const sl = addSlide('TCN Variant We Applied', 'Full name and definition', 3);

  const defRows = [
    [hCell('Field', { align: 'left' }), hCell('Value', { align: 'left' })],
    [dCell('Short name (our run)', { bold: true, fill: C.stripe }), dCell('TCN-ESA', { bold: true, fill: C.stripe })],
    [dCell('Full name', { fill: C.lightbg }), dCell('Dilated Causal Temporal Convolutional Network (forecasting / prediction-based anomaly detector)', { fill: C.lightbg })],
    [dCell('Canonical reference', { fill: C.stripe }), dCell('Bai, Kolter & Koltun (2018), An Empirical Evaluation of Generic Convolutional and Recurrent Networks for Sequence Modeling', { fill: C.stripe })],
    [dCell('Also called', { fill: C.lightbg }), dCell('Bai-style TCN, residual dilated causal TCN', { fill: C.lightbg })],
  ];
  sl.addTable(defRows, tableOpts(ML, 0.86, CW, [2.15, 7.05], {
    rowH: [0.32, 0.34, 0.48, 0.52, 0.34],
  }));

  sl.addText('What this variant is', {
    x: ML, y: 3.18, w: CW, h: 0.24,
    fontSize: 13, bold: true, color: C.accent, fontFace: 'Calibri', margin: 0,
  });
  sl.addText(
    '•  Temporal Convolutional Network (TCN): 1-D convolutions over time with causal padding (no future leakage) and exponential dilations for a large receptive field\n\n' +
    '•  Forecasting AD setup: train to predict the next window of target channels from past inputs; anomaly = large prediction error (same loop as Telemanom, LSTM → TCN)\n\n' +
    '•  ESA adaptations: multi-output (58 targets), all inputs (87), omit anomalies in train, Telemanom dynamic thresholding',
    {
      x: ML, y: 3.42, w: CW, h: 1.32,
      fontSize: 11, color: C.dark, fontFace: 'Calibri',
      margin: 0, valign: 'top',
    }
  );

  sl.addText('We applied the Bai et al. (2018) dilated causal TCN as a multi-output forecasting anomaly detector with Telemanom-style thresholding (TCN-ESA).', {
    x: ML, y: 4.95, w: CW, h: 0.28,
    fontSize: 11, italic: true, color: C.muted, fontFace: 'Calibri', margin: 0,
  });
}

// ─────────────────────────────────────────
// Slide 4 — TCN Architecture
// ─────────────────────────────────────────
{
  const sl = addSlide('TCN Architecture', 'TCN-ESA network', 4);

  sl.addShape(pres.ShapeType.rect, {
    x: ML, y: 0.86, w: 5.15, h: 3.55,
    fill: { color: C.codeBg }, line: { color: C.border, pt: 0.75 },
  });
  sl.addText(
    'INPUT  [batch × 250 × 87]\n' +
    '        ↓\n' +
    'Dilated Causal TCN\n' +
    '  8 residual levels, width=134, kernel=7\n' +
    '  dilations: 1, 2, 4, …, 128\n' +
    '        ↓\n' +
    'Linear head → next 10 steps × 58 targets\n' +
    '        ↓\n' +
    'Use 1st forecast step  →  |pred − actual|\n' +
    '        ↓\n' +
    'EWMA smooth + Telemanom dynamic\n' +
    'threshold → binary events',
    {
      x: ML + 0.18, y: 0.98, w: 4.8, h: 3.32,
      fontSize: 13, color: C.dark, fontFace: 'Courier New',
      margin: 0, valign: 'middle',
    }
  );

  const designRows = [
    [hCell('Design choice', { align: 'left', fontSize: 11 }), hCell('Setting', { align: 'left', fontSize: 11 })],
    [dCell('Backbone', { fill: C.stripe }), dCell('Bai-style dilated causal TCN', { fill: C.stripe })],
    [dCell('Channels / levels', { fill: C.lightbg }), dCell('134 × 8', { bold: true, fill: C.lightbg })],
    [dCell('Kernel / dropout', { fill: C.stripe }), dCell('7 / 0.2', { bold: true, fill: C.stripe })],
    [dCell('Optimizer / loss', { fill: C.lightbg }), dCell('Adam / MSE', { fill: C.lightbg })],
    [dCell('Early stopping', { fill: C.stripe }), dCell('patience 20, max 1000 epochs → stopped @ 84', { fill: C.stripe })],
  ];
  sl.addTable(designRows, tableOpts(5.75, 0.86, 3.85, [1.55, 2.3], {
    rowH: [0.36, 0.52, 0.52, 0.52, 0.52, 0.72],
  }));

  sl.addText('vs Telemanom: same I/O and thresholding; LSTM [134, 134] replaced by TCN.', {
    x: ML, y: 4.55, w: CW, h: 0.32,
    fontSize: 13, bold: true, color: C.dark, fontFace: 'Calibri', margin: 0,
  });
}

// ─────────────────────────────────────────
// Slide 5 — Run Facts
// ─────────────────────────────────────────
{
  const sl = addSlide('Run Facts', 'Intended difference = backbone only (LSTM vs dilated causal TCN)', 5);

  const runRows = [
    [hCell('Item', { align: 'left', fontSize: 12 }), hCell('Our Telemanom-ESA', { fontSize: 12 }), hCell('Our TCN-ESA', { fontSize: 12 })],
    [dCell('Train', { fill: C.stripe, fontSize: 13 }), dCell('~1.1 h', { fill: C.stripe, align: 'center', fontSize: 13 }), dCell('~45–60 min (stop @ epoch 84)', { fill: C.stripe, align: 'center', fontSize: 13 })],
    [dCell('Execute', { fill: C.lightbg, fontSize: 13 }), dCell('~4.0 h', { fill: C.lightbg, align: 'center', fontSize: 13 }), dCell('~2.7 h (9656 s)', { fill: C.lightbg, align: 'center', fontSize: 13, bold: true, color: C.green })],
    [dCell('Status', { fill: C.stripe, fontSize: 13 }), dCell('OK', { fill: C.stripe, align: 'center', fontSize: 13 }), dCell('OK', { fill: C.stripe, align: 'center', fontSize: 13 })],
    [dCell('Targets / inputs', { fill: C.lightbg, fontSize: 13 }), dCell('58 / 87', { fill: C.lightbg, align: 'center', fontSize: 13 }), dCell('58 / 87', { fill: C.lightbg, align: 'center', fontSize: 13 })],
    [dCell('min_error_value', { fill: C.stripe, fontSize: 13, fontFace: 'Courier New' }), dCell('0', { fill: C.stripe, align: 'center', fontSize: 13 }), dCell('0', { fill: C.stripe, align: 'center', fontSize: 13 })],
  ];
  sl.addTable(runRows, tableOpts(ML, 1.05, CW, [2.4, 3.4, 3.4], {
    rowH: 0.5,
    nRows: 6,
  }));
}

// ─────────────────────────────────────────
// Slide 6 — Metrics
// ─────────────────────────────────────────
{
  const sl = addSlide('Metrics', 'Same framework as the Telemanom deck', 6);

  const metRows = [
    [hCell('Metric', { align: 'left', fontSize: 11 }), hCell('Meaning', { align: 'left', fontSize: 11 })],
    [dCell('EW', { bold: true, fill: C.stripe }), dCell('Any alarm overlap with a labelled window (strict yes/no)', { fill: C.stripe })],
    [dCell('AFF', { bold: true, fill: C.lightbg }), dCell('Partial credit if alarms are near the true window — primary quality metric', { fill: C.lightbg })],
    [dCell('F0.5', { bold: true, fill: C.stripe }), dCell('Precision weighted more than recall (false alarms are costly)', { fill: C.stripe })],
    [dCell('Alarming precision', { bold: true, fill: C.lightbg }), dCell('Ops-facing precision of raised alarms', { fill: C.lightbg })],
    [dCell('Channel / Subsystem F0.5', { bold: true, fill: C.stripe }), dCell('Exact sensor vs any sensor in the correct subsystem', { fill: C.stripe })],
    [dCell('ADTQC', { bold: true, fill: C.lightbg, valign: 'top' }), dCell('Timing of first overlapping alarm vs event start. Nb_Before = early, Nb_After = on-time/late, AfterRate = After / (Before + After), Total = mean timing quality.', { fill: C.lightbg, valign: 'top' })],
  ];
  sl.addTable(metRows, tableOpts(ML, 0.88, CW, [2.35, 6.85], {
    rowH: [0.32, 0.4, 0.4, 0.4, 0.4, 0.46, 0.7],
  }));

  sl.addText('Report Rare Event + Anomaly (combined) and Anomaly-only, same as the Telemanom slides.', {
    x: ML, y: 4.95, w: CW, h: 0.28,
    fontSize: 11, italic: true, color: C.muted, fontFace: 'Calibri', margin: 0,
  });
}

function metricRow(label, vals, stripe, boldIdx) {
  const fill = stripe ? C.stripe : C.lightbg;
  const cells = [dCell(label, { fill, bold: true })];
  vals.forEach((v, i) => {
    cells.push(dCell(v, {
      fill,
      align: 'right',
      bold: i === boldIdx,
      color: i === boldIdx ? C.green : C.dark,
    }));
  });
  return cells;
}

// ─────────────────────────────────────────
// Slide 7 — Combined results
// ─────────────────────────────────────────
{
  const sl = addSlide(
    'Results: Combined (Rare Event + Anomaly)',
    'Our Telemanom & TCN = lab 84_months full runs.  Paper = ESA-ADB Table 2, Mission1 full set.',
    7
  );

  const mainRows = [
    [
      hCell('Metric', { align: 'left', fontSize: 10 }),
      hCell('Paper TEL', { fontSize: 10 }),
      hCell('Paper Pruned', { fontSize: 10 }),
      hCell('Our Telemanom', { fontSize: 10 }),
      hCell('Our TCN', { fontSize: 10 }),
    ],
    metricRow('AFF Precision',        ['0.322', '0.368', '0.544', '0.523'], true,  2),
    metricRow('AFF Recall',           ['0.692', '0.563', '0.367', '0.350'], false, 0),
    metricRow('AFF F0.5',             ['0.673', '0.497', '0.496', '0.476'], true,  0),
    metricRow('Channel-aware F0.5',   ['0.282', '0.477', '0.463', '0.355'], false, 1),
    metricRow('Subsystem-aware F0.5', ['0.670', '0.689', '0.708', '0.624'], true,  2),
    metricRow('Alarming precision',   ['0.017', '0.578', '0.076', '0.065'], false, 1),
    metricRow('ADTQC Total',          ['0.716', '0.511', '0.689', '0.676'], true,  0),
    metricRow('ADTQC AfterRate',      ['0.074', '0.545', '0.341', '0.279'], false, 1),
  ];
  sl.addTable(mainRows, tableOpts(ML, 0.86, CW, [2.45, 1.5, 1.7, 1.85, 1.7], {
    rowH: 0.28,
    nRows: 9,
  }));

  sl.addText('EW (our two runs only)', {
    x: ML, y: 3.5, w: 5.15, h: 0.22,
    fontSize: 12, bold: true, color: C.dark, fontFace: 'Calibri', margin: 0,
  });
  const ewRows = [
    [hCell('Metric', { align: 'left', fontSize: 10, fill: C.tel }), hCell('Our Telemanom', { fontSize: 10, fill: C.tel }), hCell('Our TCN', { fontSize: 10, fill: C.tel })],
    [dCell('EW Recall', { fill: C.stripe }), dCell('96.70%', { fill: C.stripe, align: 'right', bold: true, color: C.green }), dCell('94.51%', { fill: C.stripe, align: 'right' })],
    [dCell('EW Precision', { fill: C.lightbg }), dCell('0.67%', { fill: C.lightbg, align: 'right', bold: true, color: C.green }), dCell('0.36%', { fill: C.lightbg, align: 'right' })],
    [dCell('EW F0.5', { fill: C.stripe }), dCell('0.83%', { fill: C.stripe, align: 'right', bold: true, color: C.green }), dCell('0.46%', { fill: C.stripe, align: 'right' })],
    [dCell('Alarming precision', { fill: C.lightbg }), dCell('7.57%', { fill: C.lightbg, align: 'right', bold: true, color: C.green }), dCell('6.50%', { fill: C.lightbg, align: 'right' })],
  ];
  sl.addTable(ewRows, tableOpts(ML, 3.74, 5.2, [2.05, 1.65, 1.5], {
    rowH: 0.26,
    nRows: 5,
  }));

  noteBox(
    sl,
    'Our Telemanom still leads our TCN on every combined quality F-score. TCN is close on AFF (−0.020 F0.5). The gap is channel F0.5 (−0.108). Paper TEL still leads AFF recall / AFF F0.5; both our runs are the precision-heavy operating point (closer to Pruned on AFF F0.5).',
    5.8, 3.5, 3.8, 1.55
  );
}

// ─────────────────────────────────────────
// Slide 8 — Anomaly-only
// ─────────────────────────────────────────
{
  const sl = addSlide(
    'Results: Anomaly-Only',
    'Paper = ESA-ADB Supplementary Table 9, Mission1 full set, anomaly-only.',
    8
  );

  const mainRows = [
    [
      hCell('Metric', { align: 'left', fontSize: 10 }),
      hCell('Paper TEL', { fontSize: 10 }),
      hCell('Paper Pruned', { fontSize: 10 }),
      hCell('Our Telemanom', { fontSize: 10 }),
      hCell('Our TCN', { fontSize: 10 }),
    ],
    metricRow('AFF Precision',        ['0.327', '0.344', '0.515', '0.505'], true,  2),
    metricRow('AFF Recall',           ['0.654', '0.518', '0.350', '0.339'], false, 0),
    metricRow('AFF F0.5',             ['0.561', '0.467', '0.470', '0.460'], true,  0),
    metricRow('Channel-aware F0.5',   ['0.291', '0.472', '0.458', '0.273'], false, 1),
    metricRow('Subsystem-aware F0.5', ['0.721', '0.717', '0.733', '0.600'], true,  2),
    metricRow('Alarming precision',   ['0.020', '0.531', '0.120', '0.115'], false, 1),
    metricRow('ADTQC Total',          ['0.733', '0.473', '0.605', '0.581'], true,  0),
    metricRow('ADTQC AfterRate',      ['—',     '—',     '0.359', '0.308'], false, 2),
  ];
  sl.addTable(mainRows, tableOpts(ML, 0.86, CW, [2.45, 1.5, 1.7, 1.85, 1.7], {
    rowH: 0.28,
    nRows: 9,
  }));

  sl.addText('EW (our two runs)', {
    x: ML, y: 3.5, w: 5.15, h: 0.22,
    fontSize: 12, bold: true, color: C.dark, fontFace: 'Calibri', margin: 0,
  });
  const ewRows = [
    [hCell('Metric', { align: 'left', fontSize: 10, fill: C.tel }), hCell('Our Telemanom', { fontSize: 10, fill: C.tel }), hCell('Our TCN', { fontSize: 10, fill: C.tel })],
    [dCell('EW Recall', { fill: C.stripe }), dCell('96.36%', { fill: C.stripe, align: 'right', bold: true, color: C.green }), dCell('94.55%', { fill: C.stripe, align: 'right' })],
    [dCell('EW Precision', { fill: C.lightbg }), dCell('0.40%', { fill: C.lightbg, align: 'right', bold: true, color: C.green }), dCell('0.22%', { fill: C.lightbg, align: 'right' })],
    [dCell('Alarming precision', { fill: C.stripe }), dCell('11.99%', { fill: C.stripe, align: 'right', bold: true, color: C.green }), dCell('11.48%', { fill: C.stripe, align: 'right' })],
  ];
  sl.addTable(ewRows, tableOpts(ML, 3.74, 5.2, [2.05, 1.65, 1.5], {
    rowH: 0.28,
    nRows: 4,
  }));

  noteBox(
    sl,
    'Headline: Anomaly AFF F0.5 is a near tie (0.470 vs 0.460). Channel F0.5 is not (0.458 vs 0.273, −40% relative). TCN Anomaly-only channel F0.5 0.273 is slightly below paper TEL 0.291; our LSTM 0.458 is well above.',
    5.8, 3.5, 3.8, 1.55
  );
}

// ─────────────────────────────────────────
// Slide 9 — Localization
// ─────────────────────────────────────────
{
  const sl = addSlide('Localization: Channel vs Subsystem', 'Did the model name the right sensor? (PC metrics)', 9);

  function locRows(data) {
    const rows = [[
      hCell('Level', { fontSize: 9 }),
      hCell('Metric', { fontSize: 9 }),
      hCell('Our Telemanom', { fontSize: 9 }),
      hCell('Our TCN', { fontSize: 9 }),
      hCell('Winner', { fontSize: 9 }),
    ]];
    data.forEach((r, i) => {
      const fill = stripeFill(i);
      const telWins = r[4] === 'Telemanom';
      rows.push([
        dCell(r[0], { fill, fontSize: 10 }),
        dCell(r[1], { fill, fontSize: 10, bold: r[1] === 'F0.5' }),
        dCell(r[2], { fill, align: 'right', fontSize: 10, bold: telWins && r[1] !== 'Recall', color: telWins && r[1] !== 'Recall' ? C.green : C.dark }),
        dCell(r[3], { fill, align: 'right', fontSize: 10, bold: !telWins, color: !telWins ? C.tcn : C.dark }),
        dCell(r[4], { fill, align: 'center', fontSize: 10, bold: true, color: telWins ? C.tel : C.tcn }),
      ]);
    });
    return rows;
  }

  const re = [
    ['Channel', 'Precision', '0.500', '0.355', 'Telemanom'],
    ['Channel', 'Recall',    '0.581', '0.625', 'TCN'],
    ['Channel', 'F0.5',      '0.463', '0.355', 'Telemanom'],
    ['Subsystem', 'Precision', '0.694', '0.589', 'Telemanom'],
    ['Subsystem', 'Recall',    '0.890', '0.923', 'TCN'],
    ['Subsystem', 'F0.5',      '0.708', '0.624', 'Telemanom'],
  ];
  const ao = [
    ['Channel', 'Precision', '0.487', '0.254', 'Telemanom'],
    ['Channel', 'Recall',    '0.577', '0.600', 'TCN'],
    ['Channel', 'F0.5',      '0.458', '0.273', 'Telemanom'],
    ['Subsystem', 'Precision', '0.727', '0.564', 'Telemanom'],
    ['Subsystem', 'Recall',    '0.873', '0.927', 'TCN'],
    ['Subsystem', 'F0.5',      '0.733', '0.600', 'Telemanom'],
  ];

  const leftW = 4.5;
  const rightX = 5.1;
  const rightW = 4.5;

  sl.addText('Rare Event + Anomaly', {
    x: ML, y: 0.84, w: leftW, h: 0.24,
    fontSize: 12, bold: true, color: C.dark, fontFace: 'Calibri', margin: 0,
  });
  sl.addTable(locRows(re), tableOpts(ML, 1.1, leftW, [0.95, 0.82, 1.08, 0.78, 0.87], { rowH: [0.42, 0.36, 0.36, 0.36, 0.36, 0.36, 0.36] }));

  sl.addText('Anomaly-only', {
    x: rightX, y: 0.84, w: rightW, h: 0.24,
    fontSize: 12, bold: true, color: C.dark, fontFace: 'Calibri', margin: 0,
  });
  sl.addTable(locRows(ao), tableOpts(rightX, 1.1, rightW, [0.95, 0.82, 1.08, 0.78, 0.87], { rowH: [0.42, 0.36, 0.36, 0.36, 0.36, 0.36, 0.36] }));

  noteBox(
    sl,
    'TCN finds the event on more channels/subsystems (recall ↑) but alarms extra channels (precision ↓). F0.5 punishes that. Ops triage: TCN still often hits the right subsystem, then smears the channel.',
    ML, 4.0, CW, 0.85
  );
}

// ─────────────────────────────────────────
// Slide 10 — ADTQC Timing
// ─────────────────────────────────────────
{
  const sl = addSlide(
    'ADTQC Timing',
    'First overlapping alarm vs labelled start. Not pruning / not alarm merging.',
    10
  );

  const h2 = (t1, t2) => ({
    text: [
      { text: t1, options: { bold: true, color: C.white, breakLine: true, fontSize: 10 } },
      { text: t2, options: { bold: true, color: 'DBEAFE', fontSize: 9 } },
    ],
    options: {
      fill: { color: C.accent },
      align: 'center',
      valign: 'middle',
      fontFace: 'Calibri',
      margin: [4, 4, 4, 4],
    },
  });

  const rows = [
    [
      hCell('Metric', { fontSize: 10, align: 'left' }),
      h2('Our Telemanom', 'Combined'),
      h2('Our TCN', 'Combined'),
      h2('Our Telemanom', 'Anomaly-only'),
      h2('Our TCN', 'Anomaly-only'),
    ],
    [
      dCell('Early (Nb_Before)', { fill: C.stripe, bold: true }),
      dCell('58', { fill: C.stripe, align: 'center' }),
      dCell('62', { fill: C.stripe, align: 'center', bold: true, color: C.tcn }),
      dCell('34', { fill: C.stripe, align: 'center' }),
      dCell('36', { fill: C.stripe, align: 'center', bold: true, color: C.tcn }),
    ],
    [
      dCell('On-time/late (Nb_After)', { fill: C.lightbg, bold: true }),
      dCell('30', { fill: C.lightbg, align: 'center' }),
      dCell('24', { fill: C.lightbg, align: 'center' }),
      dCell('19', { fill: C.lightbg, align: 'center' }),
      dCell('16', { fill: C.lightbg, align: 'center' }),
    ],
    [
      dCell('AfterRate', { fill: C.stripe, bold: true }),
      dCell('0.341', { fill: C.stripe, align: 'center' }),
      dCell('0.279', { fill: C.stripe, align: 'center', bold: true, color: C.tcn }),
      dCell('0.359', { fill: C.stripe, align: 'center' }),
      dCell('0.308', { fill: C.stripe, align: 'center', bold: true, color: C.tcn }),
    ],
    [
      dCell('Total', { fill: C.lightbg, bold: true }),
      dCell('0.689', { fill: C.lightbg, align: 'center', bold: true, color: C.green }),
      dCell('0.676', { fill: C.lightbg, align: 'center' }),
      dCell('0.605', { fill: C.lightbg, align: 'center', bold: true, color: C.green }),
      dCell('0.581', { fill: C.lightbg, align: 'center' }),
    ],
  ];
  sl.addTable(rows, tableOpts(ML, 0.9, CW, [2.15, 1.76, 1.76, 1.76, 1.77], {
    rowH: [0.52, 0.4, 0.4, 0.4, 0.4],
  }));

  sl.addShape(pres.ShapeType.rect, {
    x: ML, y: 3.22, w: CW, h: 0.55,
    fill: { color: C.noteBg }, line: { color: C.noteBd, pt: 0.75 },
  });
  sl.addText('Paper Combined AfterRate', {
    x: ML + 0.15, y: 3.32, w: 2.5, h: 0.35,
    fontSize: 12, bold: true, color: C.dark, fontFace: 'Calibri', margin: 0, valign: 'middle',
  });
  sl.addText('Paper TEL   0.074', {
    x: ML + 2.8, y: 3.32, w: 2.6, h: 0.35,
    fontSize: 13, color: C.dark, fontFace: 'Calibri', margin: 0, valign: 'middle',
  });
  sl.addText('Paper Pruned   0.545', {
    x: ML + 5.5, y: 3.32, w: 3.2, h: 0.35,
    fontSize: 13, color: C.dark, fontFace: 'Calibri', margin: 0, valign: 'middle',
  });

  sl.addText('TCN fires earlier (more Nb_Before, lower AfterRate). Timing quality score (Total) still slightly favors Telemanom. Both our runs are much earlier than paper TEL AfterRate 0.074.', {
    x: ML, y: 3.95, w: CW, h: 0.55,
    fontSize: 12, italic: true, color: C.muted, fontFace: 'Calibri', margin: 0,
  });
}

// ─────────────────────────────────────────
// Slide 11 — Where TCN Wins
// ─────────────────────────────────────────
{
  const sl = addSlide('Where TCN Wins (and Where It Does Not)', '', 11);

  const rows = [
    [hCell('Metric', { align: 'left', fontSize: 11 }), hCell('Our Telemanom', { fontSize: 11 }), hCell('Our TCN', { fontSize: 11 }), hCell('Δ', { fontSize: 11 })],
    [dCell('Execute time', { fill: C.stripe, bold: true }), dCell('4.0 h', { fill: C.stripe, align: 'center' }), dCell('2.7 h', { fill: C.stripe, align: 'center', bold: true, color: C.green }), dCell('−1.3 h', { fill: C.stripe, align: 'center', bold: true, color: C.green })],
    [dCell('Train wall time', { fill: C.lightbg }), dCell('~1.1 h', { fill: C.lightbg, align: 'center' }), dCell('~0.8 h (epoch 84)', { fill: C.lightbg, align: 'center', bold: true, color: C.green }), dCell('faster', { fill: C.lightbg, align: 'center', color: C.green })],
    [dCell('Channel recall (Anomaly)', { fill: C.stripe }), dCell('0.577', { fill: C.stripe, align: 'center' }), dCell('0.600', { fill: C.stripe, align: 'center', bold: true, color: C.tcn }), dCell('+0.023', { fill: C.stripe, align: 'center', color: C.tcn })],
    [dCell('Channel recall (RE + Anomaly)', { fill: C.lightbg }), dCell('0.581', { fill: C.lightbg, align: 'center' }), dCell('0.625', { fill: C.lightbg, align: 'center', bold: true, color: C.tcn }), dCell('+0.044', { fill: C.lightbg, align: 'center', color: C.tcn })],
    [dCell('Subsystem recall (Anomaly)', { fill: C.stripe }), dCell('0.873', { fill: C.stripe, align: 'center' }), dCell('0.927', { fill: C.stripe, align: 'center', bold: true, color: C.tcn }), dCell('+0.054', { fill: C.stripe, align: 'center', color: C.tcn })],
    [dCell('Subsystem recall (RE + Anomaly)', { fill: C.lightbg }), dCell('0.890', { fill: C.lightbg, align: 'center' }), dCell('0.923', { fill: C.lightbg, align: 'center', bold: true, color: C.tcn }), dCell('+0.033', { fill: C.lightbg, align: 'center', color: C.tcn })],
    [dCell('AfterRate (Anomaly)', { fill: C.stripe }), dCell('0.359', { fill: C.stripe, align: 'center' }), dCell('0.308', { fill: C.stripe, align: 'center', bold: true, color: C.tcn }), dCell('earlier', { fill: C.stripe, align: 'center', color: C.tcn })],
    [dCell('AfterRate (RE + Anomaly)', { fill: C.lightbg }), dCell('0.341', { fill: C.lightbg, align: 'center' }), dCell('0.279', { fill: C.lightbg, align: 'center', bold: true, color: C.tcn }), dCell('earlier', { fill: C.lightbg, align: 'center', color: C.tcn })],
  ];
  sl.addTable(rows, tableOpts(ML, 0.7, CW, [3.4, 2.0, 2.2, 1.6], {
    rowH: 0.36,
    nRows: 9,
  }));

  sl.addText('Telemanom still wins (precision-sensitive): AFF F0.5, channel F0.5, subsystem F0.5, ADTQC Total, alarming precision.', {
    x: ML, y: 4.12, w: CW, h: 0.32,
    fontSize: 12, bold: true, color: C.red, fontFace: 'Calibri', margin: 0,
  });
  sl.addText('Per-channel (AFF F0.5, RE+Anomaly): Our Telemanom best ch73/ch74, worst 48–52. Our TCN best ch41–46, worst 62–65. TCN is stronger on 48–52 than LSTM.', {
    x: ML, y: 4.46, w: CW, h: 0.42,
    fontSize: 11, italic: true, color: C.muted, fontFace: 'Calibri', margin: 0,
  });
}

// ─────────────────────────────────────────
// Slide 12 — Conclusions
// ─────────────────────────────────────────
{
  const sl = addSlide('Conclusions', '', 12);

  const rows = [
    [hCell('Question', { align: 'left', fontSize: 12 }), hCell('Answer', { align: 'left', fontSize: 12 })],
    [
      dCell('Fair comparison (our two runs)?', { fill: C.stripe, bold: true, fontSize: 12, valign: 'top' }),
      dCell('Yes — same 84_months split, 58 targets, 87 inputs, min_error_value = 0, same dynamic thresholding.', { fill: C.stripe, fontSize: 12, valign: 'top' }),
    ],
    [
      dCell('Best quality (AFF / channel / subsystem / ADTQC)?', { fill: C.lightbg, bold: true, fontSize: 12, valign: 'top' }),
      dCell('Our Telemanom-ESA (LSTM)', { fill: C.lightbg, fontSize: 13, bold: true, color: C.tel, valign: 'middle' }),
    ],
    [
      dCell('Best speed?', { fill: C.stripe, bold: true, fontSize: 12 }),
      dCell('Our TCN-ESA', { fill: C.stripe, fontSize: 13, bold: true, color: C.tcn }),
    ],
    [
      dCell('vs paper Telemanom-ESA', { fill: C.lightbg, bold: true, fontSize: 12, valign: 'top' }),
      dCell('Both our runs: higher AFF precision / channel ID than paper TEL, lower AFF recall. TCN does not beat our LSTM. On Anomaly-only channel F0.5, TCN is even slightly below paper TEL.', { fill: C.lightbg, fontSize: 12, valign: 'top' }),
    ],
  ];
  sl.addTable(rows, tableOpts(ML, 0.72, CW, [3.35, 5.85], {
    rowH: [0.38, 0.7, 0.7, 0.55, 1.15],
  }));
}

pres.writeFile({ fileName: '/home/abbas/ESA_ADB/TCN_ESA_vs_Telemanom_ESA.pptx' })
  .then(() => console.log('Done'))
  .catch((e) => { console.error(e); process.exit(1); });
