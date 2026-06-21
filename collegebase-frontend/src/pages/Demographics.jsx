import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { api } from "../api";
import { useFilters } from "../context/FilterContext";
import { usePageTitle } from "../utils";
import "./Demographics.css";

const MIN_N = 15;
const TIER_COLORS = { t5_accepted: "#ef4444", t10_accepted: "#f97316", t20_accepted: "#6366f1", t50_accepted: "#22c55e" };
const TIER_LABELS = { t5_accepted: "T5", t10_accepted: "T10", t20_accepted: "T20", t50_accepted: "T50" };

function RateTable({ data, labelKey, title, onRowClick, hideUnreliable }) {
  const [sortKey, setSortKey] = useState("n");
  const [sortDir, setSortDir] = useState("desc");

  const filtered = hideUnreliable ? data.filter((r) => r.reliable) : data;
  const sorted = [...filtered].sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (av == null) return 1;
    if (bv == null) return -1;
    return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  return (
    <section className="chart-section">
      <h2>{title}</h2>
      <p className="section-sub">
        Rows with fewer than {MIN_N} profiles are dimmed. Rates shown as percentages.
        {onRowClick && " Click a row to browse matching profiles."}
      </p>
      <div className="demo-table-wrap">
        <table className="demo-table">
          <thead>
            <tr>
              <th className="left" onClick={() => handleSort(labelKey)}>
                {labelKey.charAt(0).toUpperCase() + labelKey.slice(1)}
                {sortKey === labelKey && (sortDir === "asc" ? " ↑" : " ↓")}
              </th>
              <th onClick={() => handleSort("n")}>
                Profiles{sortKey === "n" && (sortDir === "asc" ? " ↑" : " ↓")}
              </th>
              <th onClick={() => handleSort("avg_gpa")}>
                Avg GPA{sortKey === "avg_gpa" && (sortDir === "asc" ? " ↑" : " ↓")}
              </th>
              <th onClick={() => handleSort("avg_sat")}>
                Avg SAT{sortKey === "avg_sat" && (sortDir === "asc" ? " ↑" : " ↓")}
              </th>
              {Object.keys(TIER_LABELS).map((t) => (
                <th key={t} onClick={() => handleSort(t)}>
                  {TIER_LABELS[t]} Rate{sortKey === t && (sortDir === "asc" ? " ↑" : " ↓")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row[labelKey]}
                className={`${onRowClick ? "clickable-row" : ""} ${row.reliable ? "" : "unreliable-row"}`}
                onClick={() => onRowClick && onRowClick(row[labelKey])}>
                <td className="left">{row[labelKey]}</td>
                <td>{row.n}</td>
                <td>{row.avg_gpa?.toFixed(2) ?? "—"}</td>
                <td>{row.avg_sat?.toFixed(0) ?? "—"}</td>
                {Object.keys(TIER_LABELS).map((t) => (
                  <td key={t}>{row[t] != null ? (row[t] * 100).toFixed(1) + "%" : "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TierChart({ data, labelKey, title }) {
  const chartData = data
    .filter((d) => d.n >= 3)
    .map((d) => ({
      name: d[labelKey],
      T5: d.t5_accepted != null ? +(d.t5_accepted * 100).toFixed(1) : 0,
      T10: d.t10_accepted != null ? +(d.t10_accepted * 100).toFixed(1) : 0,
      T20: d.t20_accepted != null ? +(d.t20_accepted * 100).toFixed(1) : 0,
      T50: d.t50_accepted != null ? +(d.t50_accepted * 100).toFixed(1) : 0,
      n: d.n,
      reliable: d.reliable,
    }));

  return (
    <section className="chart-section">
      <h2>{title}</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
          <YAxis unit="%" domain={[0, 100]} />
          <Tooltip
            content={({ payload, label }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="custom-tooltip">
                  <strong>{label}</strong> (n={d.n})
                  {!d.reliable && <span className="unreliable"> — small sample</span>}
                  {payload.map((p) => (
                    <div key={p.dataKey}>{p.dataKey}: {p.value}%</div>
                  ))}
                </div>
              );
            }}
          />
          <Legend />
          <Bar dataKey="T5" fill={TIER_COLORS.t5_accepted} />
          <Bar dataKey="T10" fill={TIER_COLORS.t10_accepted} />
          <Bar dataKey="T20" fill={TIER_COLORS.t20_accepted} />
          <Bar dataKey="T50" fill={TIER_COLORS.t50_accepted} />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}

export default function Demographics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [raceView, setRaceView] = useState("grouped");
  const { filters, update, reset, hideUnreliable } = useFilters();
  const navigate = useNavigate();

  usePageTitle("Demographics");

  useEffect(() => {
    setLoading(true);
    api.demographics(filters)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setData(null); setLoading(false); });
  }, [filters]);

  if (loading) return <div className="page-loading">Loading demographics...</div>;
  if (!data) return <div className="page-error">Failed to load demographics. Is the API running?</div>;

  const raceData = raceView === "grouped" ? data.by_race_grouped : data.by_race;

  function browseTo(filterKey, value) {
    reset();
    setTimeout(() => { update(filterKey, value); navigate("/browser"); });
  }

  function browseRace(value) {
    browseTo(raceView === "grouped" ? "race_group" : "race", value);
  }

  function browseTestStrategy(value) {
    browseTo(
      value === "Test Optional" ? "test_optional_only" : "submitted_scores_only",
      true,
    );
  }

  return (
    <div className="page demographics">
      <h1>Demographic Breakdowns</h1>
      <p className="page-sub">
        Acceptance rates and average stats split by race, gender, and testing strategy.
        Groups with fewer than {MIN_N} profiles are flagged unreliable.
        Click any row to browse matching profiles.
      </p>

      <div className="race-view-toggle">
        <label>Race/ethnicity view</label>
        <select value={raceView} onChange={(e) => setRaceView(e.target.value)}>
          <option value="grouped">Grouped</option>
          <option value="detailed">Detailed (all subtypes)</option>
        </select>
      </div>

      <TierChart data={raceData} labelKey="race" title="Acceptance rates by race/ethnicity" />
      <RateTable data={raceData} labelKey="race" title="Race/ethnicity breakdown"
        onRowClick={browseRace} hideUnreliable={hideUnreliable} />

      <TierChart data={data.by_gender} labelKey="gender" title="Acceptance rates by gender" />
      <RateTable data={data.by_gender} labelKey="gender" title="Gender breakdown"
        onRowClick={(v) => browseTo("gender", v)} hideUnreliable={hideUnreliable} />

      <TierChart data={data.by_test_optional} labelKey="group" title="Test optional vs submitted scores" />
      <RateTable data={data.by_test_optional} labelKey="group" title="Testing strategy breakdown"
        onRowClick={browseTestStrategy} hideUnreliable={hideUnreliable} />
    </div>
  );
}
