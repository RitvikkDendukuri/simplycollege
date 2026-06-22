import "./CorrelationMatrix.css";

const FEATURES = [
  { key: "gpa_unweighted", label: "GPA" },
  { key: "sat_equivalent", label: "SAT-Eq" },
  { key: "ap_classes", label: "APs" },
  { key: "num_ecs", label: "ECs" },
  { key: "num_awards", label: "Awards" },
];

function pearson(profiles, keyA, keyB) {
  const pairs = [];
  for (const p of profiles) {
    const a = p[keyA], b = p[keyB];
    if (a != null && b != null && !Number.isNaN(a) && !Number.isNaN(b)) {
      pairs.push([a, b]);
    }
  }
  const n = pairs.length;
  if (n < 2) return null;
  const meanA = pairs.reduce((s, [a]) => s + a, 0) / n;
  const meanB = pairs.reduce((s, [, b]) => s + b, 0) / n;
  let cov = 0, varA = 0, varB = 0;
  for (const [a, b] of pairs) {
    const da = a - meanA, db = b - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA === 0 || varB === 0) return null;
  return cov / Math.sqrt(varA * varB);
}

function corrColor(r) {
  if (r == null) return "var(--surface2)";
  const yellow = [255, 255, 191];
  const green = [102, 189, 99];
  const red = [215, 25, 28];
  const t = Math.min(1, Math.abs(r));
  const target = r >= 0 ? green : red;
  const mix = yellow.map((c, i) => Math.round(c + (target[i] - c) * t));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

export default function CorrelationMatrix({ profiles }) {
  const matrix = FEATURES.map((rowF) =>
    FEATURES.map((colF) =>
      rowF.key === colF.key ? 1 : pearson(profiles, rowF.key, colF.key)
    )
  );

  return (
    <div className="corr-matrix">
      <div className="corr-grid"
        style={{ gridTemplateColumns: `auto repeat(${FEATURES.length}, 1fr)` }}>
        <div className="corr-corner" />
        {FEATURES.map((f) => (
          <div key={f.key} className="corr-colhead">{f.label}</div>
        ))}
        {FEATURES.map((rowF, ri) => (
          <Row key={rowF.key} label={rowF.label} values={matrix[ri]} />
        ))}
      </div>
      <p className="corr-legend">
        <span className="corr-swatch" style={{ background: "rgb(215,25,28)" }} /> −1
        <span className="corr-swatch" style={{ background: "rgb(255,255,191)" }} /> 0
        <span className="corr-swatch" style={{ background: "rgb(102,189,99)" }} /> +1
        &nbsp;· Pearson correlation between numeric features (dark text = stronger).
      </p>
    </div>
  );
}

function Row({ label, values }) {
  return (
    <>
      <div className="corr-rowhead">{label}</div>
      {values.map((r, ci) => (
        <div key={ci} className="corr-cell"
          style={{ background: corrColor(r), color: "#1a1a1a" }}
          title={r == null ? "Not enough data" : `r = ${r.toFixed(3)}`}>
          {r == null ? "—" : r.toFixed(2)}
        </div>
      ))}
    </>
  );
}
