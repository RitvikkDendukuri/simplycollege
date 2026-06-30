import { useState, useEffect, useMemo, useRef } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, Legend,
} from "recharts";
import { api } from "../api";
import { useFilters } from "../context/FilterContext";
import { usePageTitle } from "../utils";
import { makeRate, TIER_KEYS, MIN_RELIABLE_N, TIER_LABELS } from "../constants";
import SampleBadge from "../components/SampleBadge";
import ProfileDrawer from "../components/ProfileDrawer";
import "./Dashboard.css";

function computeStats(profiles) {
  const total = profiles.length;
  const gpas = profiles.map((p) => p.gpa_unweighted).filter((v) => v != null);
  const sats = profiles.map((p) => p.sat_equivalent).filter((v) => v != null);
  const stemCount = profiles.filter((p) => p.stem_major).length;
  const toCount = profiles.filter((p) => p.test_optional).length;

  const overall = {
    total_profiles: total,
    mean_gpa_unweighted: gpas.length ? Math.round((gpas.reduce((a, b) => a + b, 0) / gpas.length) * 100) / 100 : null,
    mean_sat_equivalent: sats.length ? Math.round(sats.reduce((a, b) => a + b, 0) / sats.length * 100) / 100 : null,
    stem_share: makeRate(stemCount, total),
    test_optional_share: makeRate(toCount, total),
  };

  const acceptance_rates = {};
  for (const tier of TIER_KEYS) {
    const allAcc = profiles.filter((p) => p[tier]).length;
    const stemPool = profiles.filter((p) => p.stem_major);
    const nonStemPool = profiles.filter((p) => !p.stem_major);
    acceptance_rates[tier] = {
      all: makeRate(allAcc, total),
      stem: makeRate(stemPool.filter((p) => p[tier]).length, stemPool.length),
      non_stem: makeRate(nonStemPool.filter((p) => p[tier]).length, nonStemPool.length),
    };
  }

  return { overall, acceptance_rates };
}

export default function Dashboard() {
  const { debouncedFilters: filters, hideUnreliable } = useFilters();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [demoData, setDemoData] = useState(null);
  const [raceView, setRaceView] = useState("grouped");

  usePageTitle("Dashboard");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.applicants({ ...filters, limit: 1000 }),
      api.demographics(filters),
    ])
      .then(([p, d]) => {
        setProfiles(p.applicants);
        setDemoData(d);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [filters]);

  const { overall, acceptance_rates } = useMemo(() => computeStats(profiles), [profiles]);

  const { stemPoints, nonStemPoints } = useMemo(() => {
    const scatterData = profiles
      .filter((p) => p.gpa_unweighted && p.sat_equivalent)
      .map((p) => ({
        gpa: p.gpa_unweighted,
        sat: p.sat_equivalent,
        stem: p.stem_major,
        id: p.applicant_id,
        t20: p.t20_accepted,
      }));
    return {
      stemPoints: scatterData.filter((d) => d.stem),
      nonStemPoints: scatterData.filter((d) => !d.stem),
    };
  }, [profiles]);

  const raceData = useMemo(() => {
    if (!demoData) return [];
    const src = raceView === "grouped" ? demoData.by_race_grouped : demoData.by_race;
    return (src || []).filter((d) => d.n >= 3).sort((a, b) => b.n - a.n);
  }, [demoData, raceView]);

  const genderData = useMemo(() => {
    if (!demoData) return [];
    return (demoData.by_gender || []).filter((d) => d.n >= 3).sort((a, b) => b.n - a.n);
  }, [demoData]);

  if (loading) return <div className="page-loading">Loading dashboard…</div>;
  if (error) return <div className="page-error">Error: {error}</div>;
  if (profiles.length === 0) return (
    <div className="page dashboard">
      <h1>Dashboard</h1>
      <div className="similar-empty">No profiles match the current filters. Try adjusting or clearing your filters.</div>
    </div>
  );

  return (
    <div className="page dashboard">
      <h1>Dashboard</h1>
      <p className="page-sub">Summary of all {overall.total_profiles} profiles in the database.</p>

      <div className="metric-row">
        <MetricCard label="Total profiles" value={overall.total_profiles} />
        <MetricCard label="Mean GPA (unweighted)" value={overall.mean_gpa_unweighted?.toFixed(2)} />
        <MetricCard label="Mean SAT equivalent" value={overall.mean_sat_equivalent?.toFixed(0)} />
        <MetricCard label="STEM share"
          value={overall.stem_share.rate !== null ? (overall.stem_share.rate * 100).toFixed(0) + "%" : "—"}
          sub={`n = ${overall.stem_share.n}`} />
        <MetricCard label="Test optional"
          value={overall.test_optional_share.rate !== null ? (overall.test_optional_share.rate * 100).toFixed(0) + "%" : "—"}
          sub={`n = ${overall.test_optional_share.n}`} />
      </div>

      <section className="chart-section">
        <span className="section-num">01</span>
        <h2>Acceptance rates by tier</h2>
        <p className="section-sub">Each rate shows the number of profiles it's based on. Rates with n &lt; 15 are flagged unreliable.</p>
        <div className="badge-grid">
          {TIER_KEYS.map((t) => {
            const rates = [
              { rate: acceptance_rates[t].all, label: "All" },
              { rate: acceptance_rates[t].stem, label: "STEM" },
              { rate: acceptance_rates[t].non_stem, label: "Non-STEM" },
            ].filter((r) => !hideUnreliable || r.rate.reliable);
            return (
              <div key={t} className="badge-col">
                <div className="badge-tier">{t.replace("_accepted","").toUpperCase()}</div>
                {rates.map((r) => <SampleBadge key={r.label} rate={r.rate} label={r.label} />)}
              </div>
            );
          })}
        </div>
      </section>

      <section className="chart-section">
        <span className="section-num">02</span>
        <h2>GPA vs SAT equivalent</h2>
        <div role="img" aria-label={`Scatter plot of GPA versus SAT equivalent for ${stemPoints.length + nonStemPoints.length} applicants, split by STEM and non-STEM majors.`}>
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="gpa" name="GPA" domain={[2.5, 4.1]} type="number"
              tick={{ fill: "var(--text-sub)" }}
              label={{ value: "GPA (unweighted)", position: "insideBottom", offset: -5, fill: "var(--text-sub)" }} />
            <YAxis dataKey="sat" name="SAT eq" domain={[900, 1620]}
              tick={{ fill: "var(--text-sub)" }}
              label={{ value: "SAT equivalent", angle: -90, position: "insideLeft", fill: "var(--text-sub)" }} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }}
              content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="custom-tooltip">
                    <div>GPA: {d.gpa}</div>
                    <div>SAT eq: {d.sat}</div>
                    <div>{d.stem ? "STEM" : "Non-STEM"}</div>
                    {d.t20 && <div className="tooltip-accepted">✓ T20 accepted</div>}
                  </div>
                );
              }} />
            <Scatter name="Non-STEM" data={nonStemPoints} fill="#f59e0b" opacity={0.7}
              shape="diamond" cursor="pointer" onClick={(d) => setSelectedId(d.id)} />
            <Scatter name="STEM" data={stemPoints} fill="#8b8ba0" opacity={0.7}
              shape="circle" cursor="pointer" onClick={(d) => setSelectedId(d.id)} />
          </ScatterChart>
        </ResponsiveContainer>
        </div>
        <p className="chart-legend">
          <span className="legend-dot" style={{background:"#8b8ba0"}} /> ● STEM &nbsp;
          <span className="legend-dot" style={{background:"#f59e0b", borderRadius:0, transform:"rotate(45deg)"}} /> ◆ Non-STEM
          &nbsp;·&nbsp; <span style={{color:"var(--text-muted)"}}>click any point to view the profile</span>
        </p>
      </section>

      {demoData && (raceData.length > 0 || genderData.length > 0) && (
        <section className="chart-section">
          <span className="section-num">03</span>
          <h2>Demographics at a glance</h2>
          <p className="section-sub">
            Acceptance rates by race/ethnicity and gender. Groups with fewer than {MIN_RELIABLE_N} profiles are dimmed.
          </p>
          <div className="demo-summary">
            {raceData.length > 0 && (
              <div className="demo-summary-col">
                <div className="demo-col-header">
                  <h3>Race / Ethnicity</h3>
                  <select className="demo-view-select" value={raceView}
                    onChange={(e) => setRaceView(e.target.value)}>
                    <option value="grouped">Grouped</option>
                    <option value="detailed">Detailed</option>
                  </select>
                </div>
                {raceData.map((d) => (
                  <div key={d.race} className={`demo-row ${d.reliable ? "" : "dimmed"}`}>
                    <span className="demo-label">{d.race}</span>
                    <span className="demo-n">n={d.n}</span>
                    <span className="demo-rate">{d.t20_accepted != null ? (d.t20_accepted * 100).toFixed(0) + "%" : "—"}</span>
                  </div>
                ))}
              </div>
            )}
            {genderData.length > 0 && (
              <div className="demo-summary-col">
                <div className="demo-col-header">
                  <h3>Gender</h3>
                </div>
                {genderData.map((d) => (
                  <div key={d.gender} className={`demo-row ${d.reliable ? "" : "dimmed"}`}>
                    <span className="demo-label">{d.gender}</span>
                    <span className="demo-n">n={d.n}</span>
                    <span className="demo-rate">{d.t20_accepted != null ? (d.t20_accepted * 100).toFixed(0) + "%" : "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <ProfileDrawer applicantId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function useCountUp(target, duration = 600) {
  const [display, setDisplay] = useState(target);
  const rafRef = useRef(null);

  useEffect(() => {
    // Handle null / dash / non-numeric
    if (target == null || target === "—") {
      setDisplay(target);
      return;
    }

    const str = String(target);
    // Extract numeric part and suffix (e.g. "42%" -> 42, "%")
    const match = str.match(/^(-?\d+\.?\d*)\s*(.*)$/);
    if (!match) {
      setDisplay(target);
      return;
    }

    const end = parseFloat(match[1]);
    const suffix = match[2] || "";
    const hasDecimal = match[1].includes(".");
    const decimals = hasDecimal ? (match[1].split(".")[1] || "").length : 0;

    let start = performance.now();
    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      const current = eased * end;

      if (hasDecimal) {
        setDisplay(current.toFixed(decimals) + suffix);
      } else {
        setDisplay(Math.round(current) + suffix);
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return display;
}

function MetricCard({ label, value, sub }) {
  const animatedValue = useCountUp(value);
  return (
    <div className="metric-card">
      <div className="metric-value">{animatedValue ?? "—"}</div>
      <div className="metric-label">{label}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}
