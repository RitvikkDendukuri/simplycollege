import { useState, useEffect } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, Legend,
  AreaChart, Area,
} from "recharts";
import { api } from "../api";
import { useFilters } from "../context/FilterContext";
import { usePageTitle } from "../utils";
import SampleBadge from "../components/SampleBadge";
import ProfileDrawer from "../components/ProfileDrawer";
import "./Dashboard.css";

const MIN_RELIABLE_N = 15;

function makeRate(numerator, denominator) {
  if (denominator === 0) return { rate: null, n: 0, reliable: false };
  return {
    rate: Math.round((numerator / denominator) * 10000) / 10000,
    n: denominator,
    reliable: denominator >= MIN_RELIABLE_N,
  };
}

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
  for (const tier of ["t5_accepted", "t10_accepted", "t20_accepted", "t50_accepted"]) {
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
  const { filters } = useFilters();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  usePageTitle("Dashboard");

  useEffect(() => {
    setLoading(true);
    api.applicants({ ...filters, limit: 1000 })
      .then((p) => {
        setProfiles(p.applicants);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [filters]);

  if (loading) return <div className="page-loading">Loading dashboard…</div>;
  if (error) return <div className="page-error">Error: {error}</div>;

  const { overall, acceptance_rates } = computeStats(profiles);

  // Scatter data: GPA vs SAT-eq, colored by STEM
  const scatterData = profiles
    .filter((p) => p.gpa_unweighted && p.sat_equivalent)
    .map((p) => ({
      gpa: p.gpa_unweighted,
      sat: p.sat_equivalent,
      stem: p.stem_major,
      id: p.applicant_id,
      t20: p.t20_accepted,
    }));

  const stemPoints = scatterData.filter((d) => d.stem);
  const nonStemPoints = scatterData.filter((d) => !d.stem);

  // EC count distribution
  const ecCounts = {};
  profiles.forEach((p) => {
    const n = p.num_ecs;
    ecCounts[n] = (ecCounts[n] || 0) + 1;
  });
  const ecDist = Object.entries(ecCounts)
    .sort(([a], [b]) => +a - +b)
    .map(([n, count]) => ({ ecs: +n, count }));

  // Acceptance rates bar chart
  const tierBars = ["t5_accepted", "t10_accepted", "t20_accepted", "t50_accepted"].map((t) => ({
    tier: t.replace("_accepted", "").toUpperCase(),
    All: acceptance_rates[t].all.rate !== null
      ? +(acceptance_rates[t].all.rate * 100).toFixed(1) : 0,
    STEM: acceptance_rates[t].stem.rate !== null
      ? +(acceptance_rates[t].stem.rate * 100).toFixed(1) : 0,
    "Non-STEM": acceptance_rates[t].non_stem.rate !== null
      ? +(acceptance_rates[t].non_stem.rate * 100).toFixed(1) : 0,
    n: acceptance_rates[t].all.n,
  }));

  return (
    <div className="page dashboard">
      <h1>Dashboard</h1>
      <p className="page-sub">Summary of all {overall.total_profiles} profiles in the database.</p>

      {/* Key metrics */}
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

      {/* Acceptance rates with sample-size honesty */}
      <section className="chart-section">
        <h2>Acceptance rates by tier</h2>
        <p className="section-sub">Each rate shows the number of profiles it's based on. Rates with n &lt; 15 are flagged unreliable.</p>
        <div className="badge-grid">
          {["t5_accepted","t10_accepted","t20_accepted","t50_accepted"].map((t) => (
            <div key={t} className="badge-col">
              <div className="badge-tier">{t.replace("_accepted","").toUpperCase()}</div>
              <SampleBadge rate={acceptance_rates[t].all} label="All" />
              <SampleBadge rate={acceptance_rates[t].stem} label="STEM" />
              <SampleBadge rate={acceptance_rates[t].non_stem} label="Non-STEM" />
            </div>
          ))}
        </div>
      </section>

      {/* Acceptance rate bar chart */}
      <section className="chart-section">
        <h2>Acceptance rate by tier — STEM vs Non-STEM</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={tierBars}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="tier" />
            <YAxis unit="%" domain={[0, 100]} />
            <Tooltip formatter={(v) => v + "%"} />
            <Legend />
            <Bar dataKey="All" fill="#6366f1" />
            <Bar dataKey="STEM" fill="#22c55e" />
            <Bar dataKey="Non-STEM" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* GPA vs SAT scatter */}
      <section className="chart-section">
        <h2>GPA vs SAT equivalent</h2>
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="gpa" name="GPA" domain={[2.5, 4.1]} type="number"
              label={{ value: "GPA (unweighted)", position: "insideBottom", offset: -5 }} />
            <YAxis dataKey="sat" name="SAT eq" domain={[900, 1620]}
              label={{ value: "SAT equivalent", angle: -90, position: "insideLeft" }} />
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
              cursor="pointer" onClick={(d) => setSelectedId(d.id)} />
            <Scatter name="STEM" data={stemPoints} fill="#6366f1" opacity={0.7}
              cursor="pointer" onClick={(d) => setSelectedId(d.id)} />
          </ScatterChart>
        </ResponsiveContainer>
        <p className="chart-legend">
          <span className="legend-dot" style={{background:"#6366f1"}} /> STEM &nbsp;
          <span className="legend-dot" style={{background:"#f59e0b"}} /> Non-STEM
        </p>
      </section>

      {/* EC count distribution */}
      <section className="chart-section">
        <h2>Extracurricular count distribution</h2>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={ecDist}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="ecs" label={{ value: "# of ECs", position: "insideBottom", offset: -5 }} />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="count" fill="#6366f1" stroke="#4f46e5" fillOpacity={0.4} />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      <ProfileDrawer applicantId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function MetricCard({ label, value, sub }) {
  return (
    <div className="metric-card">
      <div className="metric-value">{value ?? "—"}</div>
      <div className="metric-label">{label}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}
