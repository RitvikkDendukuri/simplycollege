import "./SampleBadge.css";

export default function SampleBadge({ rate, label }) {
  if (!rate) return null;
  const pct = rate.rate !== null ? (rate.rate * 100).toFixed(1) + "%" : "—";
  const hasCI = rate.ci_low != null && rate.ci_high != null;
  const ci = hasCI
    ? `${(rate.ci_low * 100).toFixed(0)}–${(rate.ci_high * 100).toFixed(0)}%`
    : null;

  return (
    <div className={`sample-badge ${rate.reliable ? "reliable" : "unreliable"}`}>
      <div className="badge-value">{pct}</div>
      <div className="badge-label">{label}</div>
      {ci && (
        <div className="badge-ci" title="Wilson 95% confidence interval">
          95% CI {ci}
        </div>
      )}
      <div className="badge-n">
        n = {rate.n}
        {!rate.reliable && <span className="badge-warn" title="Sample too small to be reliable"> ⚠</span>}
      </div>
    </div>
  );
}
