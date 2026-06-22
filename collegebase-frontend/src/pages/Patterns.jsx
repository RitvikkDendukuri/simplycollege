import { useState, useEffect, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { api } from "../api";
import { useFilters } from "../context/FilterContext";
import { usePageTitle } from "../utils";
import { MIN_RELIABLE_N, TIER_COLORS, wilsonInterval } from "../constants";
import "./Patterns.css";

const MIN_N = MIN_RELIABLE_N;

function bucket(profiles, key, bins) {
  return bins.map((b) => {
    const pool = profiles.filter((p) => {
      const v = p[key];
      return v != null && v >= b.min && v < b.max;
    });
    const accepted = (tier) => pool.filter((p) => p[`${tier}_accepted`]).length;
    return {
      label: b.label,
      n: pool.length,
      t5: pool.length ? +(accepted("t5") / pool.length * 100).toFixed(1) : null,
      t10: pool.length ? +(accepted("t10") / pool.length * 100).toFixed(1) : null,
      t20: pool.length ? +(accepted("t20") / pool.length * 100).toFixed(1) : null,
      t50: pool.length ? +(accepted("t50") / pool.length * 100).toFixed(1) : null,
      reliable: pool.length >= MIN_N,
    };
  });
}

function categoryRates(profiles, field, tier) {
  const map = {};
  profiles.forEach((p) => {
    (p[field] || []).forEach((cat) => {
      if (!map[cat]) map[cat] = { total: 0, accepted: 0 };
      map[cat].total += 1;
      if (p[`${tier}_accepted`]) map[cat].accepted += 1;
    });
  });
  return Object.entries(map)
    .map(([cat, { total, accepted }]) => ({
      label: cat, n: total,
      rate: +(accepted / total * 100).toFixed(1),
      reliable: total >= MIN_N,
    }))
    .sort((a, b) => b.rate - a.rate);
}

function countImpact(profiles, field, tier, bins) {
  return bins.map((b) => {
    const pool = profiles.filter((p) => {
      const v = p[field];
      return v != null && v >= b.min && v < b.max;
    });
    const acc = pool.filter((p) => p[`${tier}_accepted`]).length;
    const avgGpa = pool.length ? pool.reduce((s, p) => s + (p.gpa_unweighted || 0), 0) / pool.length : null;
    const avgSat = pool.length ? pool.reduce((s, p) => s + (p.sat_equivalent || 0), 0) / pool.length : null;
    const rate = pool.length ? +(acc / pool.length * 100).toFixed(1) : null;
    return {
      label: b.label,
      n: pool.length,
      [tier]: rate,
      rate,
      avgGpa: avgGpa ? +avgGpa.toFixed(2) : null,
      avgSat: avgSat ? +avgSat.toFixed(0) : null,
      reliable: pool.length >= MIN_N,
    };
  });
}

function adjustedCategoryRates(profiles, field, tier) {
  const usable = profiles.filter((p) => p.gpa_unweighted != null && p.sat_equivalent != null);
  if (usable.length === 0) return { n: 0, categories: [] };

  const avgGpa = usable.reduce((s, p) => s + p.gpa_unweighted, 0) / usable.length;
  const avgSat = usable.reduce((s, p) => s + p.sat_equivalent, 0) / usable.length;
  const stdGpa = Math.sqrt(usable.reduce((s, p) => s + (p.gpa_unweighted - avgGpa) ** 2, 0) / usable.length) || 0.1;
  const stdSat = Math.sqrt(usable.reduce((s, p) => s + (p.sat_equivalent - avgSat) ** 2, 0) / usable.length) || 50;

  const baseRate = usable.filter((p) => p[`${tier}_accepted`]).length / usable.length;

  const map = {};
  usable.forEach((p) => {
    const statZ = ((p.gpa_unweighted - avgGpa) / stdGpa + (p.sat_equivalent - avgSat) / stdSat) / 2;
    const accepted = p[`${tier}_accepted`] ? 1 : 0;
    const surprise = accepted - (baseRate + statZ * 0.15);

    (p[field] || []).forEach((cat) => {
      if (!map[cat]) map[cat] = { total: 0, surpriseSum: 0, rawAcc: 0 };
      map[cat].total += 1;
      map[cat].surpriseSum += surprise;
      map[cat].rawAcc += accepted;
    });
  });

  return {
    n: usable.length,
    categories: Object.entries(map)
      .map(([cat, { total, surpriseSum, rawAcc }]) => ({
        label: cat,
        n: total,
        rate: +(rawAcc / total * 100).toFixed(1),
        adjustedBoost: +(surpriseSum / total * 100).toFixed(1),
        reliable: total >= MIN_N,
      }))
      .sort((a, b) => b.adjustedBoost - a.adjustedBoost),
  };
}

const GPA_BINS = [
  { label: "< 3.0", min: 0, max: 3.0 },
  { label: "3.0-3.4", min: 3.0, max: 3.4 },
  { label: "3.4-3.6", min: 3.4, max: 3.6 },
  { label: "3.6-3.8", min: 3.6, max: 3.8 },
  { label: "3.8-3.9", min: 3.8, max: 3.9 },
  { label: "3.9-4.0", min: 3.9, max: 4.01 },
];
const SAT_BINS = [
  { label: "< 1200", min: 0, max: 1200 },
  { label: "1200-1350", min: 1200, max: 1350 },
  { label: "1350-1450", min: 1350, max: 1450 },
  { label: "1450-1500", min: 1450, max: 1500 },
  { label: "1500-1550", min: 1500, max: 1550 },
  { label: "1550-1600", min: 1550, max: 1601 },
];

function RateBar({ data, tier }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" angle={-25} textAnchor="end" interval={0} tick={{ fontSize: 11, fill: "var(--text-sub)" }} />
        <YAxis unit="%" domain={[0, 100]} tick={{ fill: "var(--text-sub)" }} />
        <Tooltip
          content={({ payload, label }) => {
            if (!payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="custom-tooltip">
                <strong>{label}</strong>
                <div>{tier.toUpperCase()} rate: {d[tier] ?? "---"}%</div>
                <div>n = {d.n} {!d.reliable && "!! small sample"}</div>
              </div>
            );
          }}
        />
        <Bar dataKey={tier} name={tier.toUpperCase()} radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i}
              fill={entry.reliable ? TIER_COLORS[tier] : "#d1d5db"}
              opacity={entry.reliable ? 1 : 0.6}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const HEATMAP_GPA_BINS = [
  { label: "< 3.4", min: 0, max: 3.4 },
  { label: "3.4–3.7", min: 3.4, max: 3.7 },
  { label: "3.7–3.9", min: 3.7, max: 3.9 },
  { label: "3.9–4.0", min: 3.9, max: 4.01 },
];
const HEATMAP_SAT_BINS = [
  { label: "< 1300", min: 0, max: 1300 },
  { label: "1300–1450", min: 1300, max: 1450 },
  { label: "1450–1550", min: 1450, max: 1550 },
  { label: "1550+", min: 1550, max: 1601 },
];

function AcceptanceHeatmap({ profiles, tier, color }) {
  const rows = [...HEATMAP_SAT_BINS].reverse();
  const cells = rows.map((sat) =>
    HEATMAP_GPA_BINS.map((gpa) => {
      const pool = profiles.filter((p) =>
        p.gpa_unweighted != null && p.sat_equivalent != null &&
        p.gpa_unweighted >= gpa.min && p.gpa_unweighted < gpa.max &&
        p.sat_equivalent >= sat.min && p.sat_equivalent < sat.max
      );
      const acc = pool.filter((p) => p[`${tier}_accepted`]).length;
      const n = pool.length;
      const rate = n ? acc / n : null;
      const [ciLow, ciHigh] = wilsonInterval(acc, n);
      return { n, rate, ciLow, ciHigh, reliable: n >= MIN_N };
    })
  );

  const maxRate = Math.max(
    0.0001,
    ...cells.flat().filter((c) => c.reliable && c.rate != null).map((c) => c.rate)
  );

  return (
    <div className="heatmap">
      <div className="heatmap-grid"
        style={{ gridTemplateColumns: `auto repeat(${HEATMAP_GPA_BINS.length}, 1fr)` }}>
        <div className="heatmap-corner">SAT \ GPA</div>
        {HEATMAP_GPA_BINS.map((g) => (
          <div key={g.label} className="heatmap-colhead">{g.label}</div>
        ))}
        {rows.map((sat, ri) => (
          <Fragment key={sat.label}>
            <div className="heatmap-rowhead">{sat.label}</div>
            {cells[ri].map((c, ci) => {
              const alpha = c.rate != null && c.reliable ? 0.12 + 0.88 * (c.rate / maxRate) : 0;
              return (
                <div key={ci}
                  className={`heatmap-cell ${c.n === 0 ? "empty" : ""} ${c.n > 0 && !c.reliable ? "thin" : ""}`}
                  style={c.reliable ? { background: hexWithAlpha(color, alpha) } : undefined}
                  title={c.n === 0 ? "No profiles in this band"
                    : `n = ${c.n}${c.reliable
                        ? ` · 95% CI ${(c.ciLow * 100).toFixed(0)}–${(c.ciHigh * 100).toFixed(0)}%`
                        : " · too few to trust"}`}>
                  {c.n === 0 ? "—" : (
                    <>
                      <span className="heatmap-rate">{(c.rate * 100).toFixed(0)}%</span>
                      <span className="heatmap-n">n={c.n}{!c.reliable && " ⚠"}</span>
                    </>
                  )}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function hexWithAlpha(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

export default function Patterns() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState("t20");
  const [section, setSection] = useState("academics");
  const navigate = useNavigate();
  const { debouncedFilters: filters, update, reset, hideUnreliable } = useFilters();

  usePageTitle("Acceptance Patterns");

  function browseTo(filterKey, value) {
    reset();
    setTimeout(() => { update(filterKey, value); navigate("/browser"); });
  }

  useEffect(() => {
    setLoading(true);
    api.applicants({ ...filters, limit: 1000 })
      .then(({ applicants }) => {
        setProfiles(applicants);
        setLoading(false);
      })
      .catch(() => { setLoading(false); setProfiles([]); });
  }, [filters]);

  if (loading) return <div className="page-loading">Loading...</div>;
  if (!profiles.length && !loading) return <div className="page-error">No data available. Is the API running?</div>;

  const gpaBuckets = bucket(profiles, "gpa_unweighted", GPA_BINS);
  const satBuckets = bucket(profiles, "sat_equivalent", SAT_BINS);
  const ecRates = categoryRates(profiles, "ec_categories", tier);
  const awardRates = categoryRates(profiles, "award_categories", tier);

  const ecCountImpact = countImpact(profiles, "num_ecs", tier,
    [{ label: "1-3", min: 1, max: 4 }, { label: "4-6", min: 4, max: 7 },
     { label: "7-9", min: 7, max: 10 }, { label: "10-12", min: 10, max: 13 },
     { label: "13+", min: 13, max: 99 }]);

  const awardCountImpact = countImpact(profiles, "num_awards", tier,
    [{ label: "0-1", min: 0, max: 2 }, { label: "2-3", min: 2, max: 4 },
     { label: "4-5", min: 4, max: 6 }, { label: "6-7", min: 6, max: 8 },
     { label: "8+", min: 8, max: 99 }]);

  const ecAdjusted = adjustedCategoryRates(profiles, "ec_categories", tier);
  const awardAdjusted = adjustedCategoryRates(profiles, "award_categories", tier);

  const filterRows = (rows) => hideUnreliable ? rows.filter((r) => r.reliable) : rows;

  return (
    <div className="page patterns">
      <h1>Acceptance Patterns</h1>
      <p className="page-sub">
        Greyed bars have n &lt; {MIN_N} and are statistically unreliable.
        {hideUnreliable && " Unreliable rows are hidden."}
      </p>

      <div className="tier-tabs">
        {["t5","t10","t20","t50"].map((t) => (
          <button key={t}
            className={`tier-tab ${tier === t ? "active" : ""}`}
            style={tier === t ? { background: TIER_COLORS[t] } : {}}
            onClick={() => setTier(t)}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="section-tabs">
        {[
          { id: "academics", label: "Academics" },
          { id: "activities", label: "Activities & Awards" },
          { id: "adjusted", label: "Adjusted Impact" },
        ].map((s) => (
          <button key={s.id}
            className={`section-tab ${section === s.id ? "active" : ""}`}
            onClick={() => setSection(s.id)}>
            {s.label}
          </button>
        ))}
      </div>

      {section === "academics" && <>
      <div className="pattern-grid">
        <section className="chart-section">
          <h2>By GPA range {"→"} {tier.toUpperCase()} acceptance</h2>
          <RateBar data={gpaBuckets} tier={tier} />
        </section>

        <section className="chart-section">
          <h2>By SAT equivalent range {"→"} {tier.toUpperCase()} acceptance</h2>
          <RateBar data={satBuckets} tier={tier} />
        </section>
      </div>

      <section className="chart-section">
        <h2>GPA × SAT interaction {"→"} {tier.toUpperCase()} acceptance</h2>
        <p className="section-sub">
          Acceptance rate at each GPA/SAT combination — reveals how the two
          interact rather than viewing each alone. Darker = higher rate
          (scaled to the strongest reliable cell). Cells with n &lt; {MIN_N} are
          hatched; hover any cell for its 95% confidence interval.
        </p>
        <AcceptanceHeatmap profiles={profiles} tier={tier} color={TIER_COLORS[tier]} />
      </section>
      </>}

      {section === "activities" && <>
      <section className="chart-section">
        <h2>By EC category {"→"} {tier.toUpperCase()} acceptance rate</h2>
        <p className="section-sub">Click a row to browse matching profiles.</p>
        <div className="category-table">
          <table>
            <thead>
              <tr>
                <th>EC Category</th>
                <th>Profiles</th>
                <th>{tier.toUpperCase()} Rate</th>
                <th>Reliable?</th>
              </tr>
            </thead>
            <tbody>
              {filterRows(ecRates).map((r) => (
                <tr key={r.label}
                  className={`clickable-row ${r.reliable ? "" : "unreliable-row"}`}
                  onClick={() => browseTo("ec_category", r.label)}>
                  <td>{r.label}</td>
                  <td>{r.n}</td>
                  <td>{r.rate}%</td>
                  <td>{r.reliable ? "Y" : "!! small n"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="chart-section">
        <h2>By award category {"→"} {tier.toUpperCase()} acceptance rate</h2>
        <p className="section-sub">Click a row to browse matching profiles.</p>
        <div className="category-table">
          <table>
            <thead>
              <tr>
                <th>Award Category</th>
                <th>Profiles</th>
                <th>{tier.toUpperCase()} Rate</th>
                <th>Reliable?</th>
              </tr>
            </thead>
            <tbody>
              {filterRows(awardRates).map((r) => (
                <tr key={r.label}
                  className={`clickable-row ${r.reliable ? "" : "unreliable-row"}`}
                  onClick={() => browseTo("award_category", r.label)}>
                  <td>{r.label}</td>
                  <td>{r.n}</td>
                  <td>{r.rate}%</td>
                  <td>{r.reliable ? "Y" : "!! small n"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="pattern-grid">
        <section className="chart-section">
          <h2>EC count {"→"} {tier.toUpperCase()} acceptance</h2>
          <p className="section-sub">Does more always mean better? Click a bucket to filter.</p>
          <RateBar data={ecCountImpact} tier={tier} />
          <div className="count-detail">
            {ecCountImpact.map((b) => (
              <div key={b.label} className="count-stat clickable-row"
                onClick={() => { reset(); setTimeout(() => { update("gpa_min", ""); navigate("/browser"); }); }}>
                <strong>{b.label} ECs</strong>
                <span>n={b.n}</span>
                <span>{tier.toUpperCase()}: {b.rate ?? "---"}%</span>
                <span>GPA: {b.avgGpa ?? "---"}</span>
                <span>SAT: {b.avgSat ?? "---"}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="chart-section">
          <h2>Award count {"→"} {tier.toUpperCase()} acceptance</h2>
          <p className="section-sub">How does the number of awards affect outcomes?</p>
          <RateBar data={awardCountImpact} tier={tier} />
          <div className="count-detail">
            {awardCountImpact.map((b) => (
              <div key={b.label} className="count-stat">
                <strong>{b.label} awards</strong>
                <span>n={b.n}</span>
                <span>{tier.toUpperCase()}: {b.rate ?? "---"}%</span>
                <span>GPA: {b.avgGpa ?? "---"}</span>
                <span>SAT: {b.avgSat ?? "---"}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      </>}

      {section === "adjusted" && <>
      <div className="pattern-grid">
        <section className="chart-section">
          <h2>EC impact (adjusted for GPA + SAT) {"→"} {tier.toUpperCase()}</h2>
          <p className="section-sub">
            Uses all {ecAdjusted.n} profiles. Boost shows how much more/less likely
            acceptance is after accounting for academic strength. Positive = EC adds value beyond stats. Click to browse.
          </p>
          <div className="category-table">
            <table>
              <thead>
                <tr>
                  <th>EC Category</th>
                  <th>Profiles</th>
                  <th>{tier.toUpperCase()} Rate</th>
                  <th>Adjusted Boost</th>
                </tr>
              </thead>
              <tbody>
                {filterRows(ecAdjusted.categories).map((r) => (
                  <tr key={r.label}
                    className={`clickable-row ${r.reliable ? "" : "unreliable-row"}`}
                    onClick={() => browseTo("ec_category", r.label)}>
                    <td>{r.label}</td>
                    <td>{r.n}</td>
                    <td>{r.rate}%</td>
                    <td className={r.adjustedBoost > 0 ? "positive-diff" : r.adjustedBoost < 0 ? "negative-diff" : ""}>
                      {r.adjustedBoost > 0 ? "+" : ""}{r.adjustedBoost}pp
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="chart-section">
          <h2>Award impact (adjusted for GPA + SAT) {"→"} {tier.toUpperCase()}</h2>
          <p className="section-sub">
            Uses all {awardAdjusted.n} profiles. Positive boost = award adds value beyond raw stats. Click to browse.
          </p>
          <div className="category-table">
            <table>
              <thead>
                <tr>
                  <th>Award Category</th>
                  <th>Profiles</th>
                  <th>{tier.toUpperCase()} Rate</th>
                  <th>Adjusted Boost</th>
                </tr>
              </thead>
              <tbody>
                {filterRows(awardAdjusted.categories).map((r) => (
                  <tr key={r.label}
                    className={`clickable-row ${r.reliable ? "" : "unreliable-row"}`}
                    onClick={() => browseTo("award_category", r.label)}>
                    <td>{r.label}</td>
                    <td>{r.n}</td>
                    <td>{r.rate}%</td>
                    <td className={r.adjustedBoost > 0 ? "positive-diff" : r.adjustedBoost < 0 ? "negative-diff" : ""}>
                      {r.adjustedBoost > 0 ? "+" : ""}{r.adjustedBoost}pp
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      </>}
    </div>
  );
}
