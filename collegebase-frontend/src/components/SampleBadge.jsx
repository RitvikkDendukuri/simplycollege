import "./SampleBadge.css";

/**
 * Displays a computed rate alongside its sample size and reliability flag.
 * Every acceptance rate in the app must go through this component so users
 * always know how many profiles the number rests on.
 *
 * Props:
 *   rate   { rate: float|null, n: int, reliable: bool }
 *   label  string  e.g. "T20 acceptance rate"
 */
export default function SampleBadge({ rate, label }) {
  if (!rate) return null;
  const pct = rate.rate !== null ? (rate.rate * 100).toFixed(1) + "%" : "—";

  return (
    <div className={`sample-badge ${rate.reliable ? "reliable" : "unreliable"}`}>
      <div className="badge-value">{pct}</div>
      <div className="badge-label">{label}</div>
      <div className="badge-n">
        n = {rate.n}
        {!rate.reliable && <span className="badge-warn" title="Sample too small to be reliable"> ⚠</span>}
      </div>
    </div>
  );
}
