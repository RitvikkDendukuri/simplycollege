import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { api } from "../api";
import { useFilters } from "../context/FilterContext";
import { rankClass, usePageTitle } from "../utils";
import { MIN_RELIABLE_N } from "../constants";
import ProfileDrawer from "../components/ProfileDrawer";
import "./Schools.css";

const MIN_N = MIN_RELIABLE_N;

export default function Schools() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("total");
  const [sortDir, setSortDir] = useState("desc");
  const [selected, setSelected] = useState(null);
  const [compare, setCompare] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const { debouncedFilters: filters, update, reset, hideUnreliable } = useFilters();
  const navigate = useNavigate();

  usePageTitle("Schools");

  function browseSchool(schoolName) {
    reset();
    setTimeout(() => { update("accepted_at", schoolName); navigate("/browser"); });
  }

  function selectSchool(name) {
    setSelected(selected === name ? null : name);
  }

  function toggleCompare(e, schoolName) {
    e.stopPropagation();
    setCompare((prev) =>
      prev.includes(schoolName)
        ? prev.filter((s) => s !== schoolName)
        : prev.length < 4 ? [...prev, schoolName] : prev
    );
  }

  useEffect(() => {
    setLoading(true);
    api.schools(filters)
      .then((d) => { setSchools(d.schools); setLoading(false); })
      .catch(() => { setSchools([]); setLoading(false); });
  }, [filters]);

  if (loading) return <div className="page-loading">Loading school data...</div>;
  if (schools.length === 0) return (
    <div className="page schools">
      <h1>School-Specific Stats</h1>
      <div className="similar-empty">No school data matches the current filters. Try adjusting or clearing your filters.</div>
    </div>
  );

  const filtered = schools.filter((s) =>
    s.school.toLowerCase().includes(search.toLowerCase()) &&
    (!hideUnreliable || s.reliable)
  );

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

  const topChart = [...schools]
    .filter((s) => s.total >= 5)
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  const compareData = compare.map((name) => schools.find((s) => s.school === name)).filter(Boolean);
  const selectedSchool = selected ? schools.find((s) => s.school === selected) : null;

  const COLS = [
    { key: "_compare", label: "Cmp", align: "center", render: (_v, r) => (
      <input type="checkbox" checked={compare.includes(r.school)}
        onChange={(e) => toggleCompare(e, r.school)}
        title="Add to comparison" />
    )},
    { key: "school", label: "School", align: "left" },
    { key: "accepted", label: "Accepted" },
    { key: "rejected", label: "Rejected" },
    { key: "total", label: "Total" },
    { key: "accept_rate", label: "Acc. Rate", render: (v, r) =>
      v != null ? <span className={r.reliable ? "" : "unreliable"}>{(v * 100).toFixed(0)}%</span> : "—" },
    { key: "avg_gpa", label: "Avg GPA", render: (v) => v?.toFixed(2) ?? "—" },
    { key: "avg_sat", label: "Avg SAT", render: (v) => v?.toFixed(0) ?? "—" },
    { key: "avg_ecs", label: "Avg ECs", render: (v) => v?.toFixed(1) ?? "—" },
    { key: "stem_share", label: "STEM %", render: (v) =>
      v != null ? (v * 100).toFixed(0) + "%" : "—" },
  ];

  return (
    <div className="page schools">
      <h1>School-Specific Stats</h1>
      <p className="page-sub">
        Acceptance and rejection data per school, with average stats of accepted applicants.
        Schools with fewer than {MIN_N} data points are flagged unreliable.
        Check the box to compare up to 4 schools side by side.
      </p>

      {compareData.length >= 2 && <SchoolCompare schools={compareData} onClear={() => setCompare([])}
        onBrowse={browseSchool} />}

      <section className="chart-section">
        <h2>Most reported schools (min 5 data points)</h2>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={topChart} layout="vertical" margin={{ left: 180, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" tick={{ fill: "var(--text-sub)" }} />
            <YAxis dataKey="school" type="category" tick={{ fontSize: 11, fill: "var(--text-sub)" }} width={170} />
            <Tooltip
              content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="custom-tooltip">
                    <strong>{d.school}</strong>
                    <div>Accepted: {d.accepted} / Rejected: {d.rejected}</div>
                    <div>Rate: {d.accept_rate != null ? (d.accept_rate * 100).toFixed(0) + "%" : "—"}
                      {!d.reliable && " (small sample)"}</div>
                    <div>Avg GPA: {d.avg_gpa?.toFixed(2) ?? "—"} | SAT: {d.avg_sat?.toFixed(0) ?? "—"}</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="accepted" stackId="a" fill="#22c55e" name="Accepted" />
            <Bar dataKey="rejected" stackId="a" fill="#ef4444" name="Rejected" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="chart-section">
        <div className="school-table-header">
          <h2>All schools ({filtered.length})</h2>
          <input className="search-box" placeholder="Search schools..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="school-table-wrap">
          <table className="school-table">
            <thead>
              <tr>
                {COLS.map((col) => (
                  <th key={col.key}
                    className={`${col.align === "left" ? "left" : ""} ${col.align === "center" ? "center" : ""} ${sortKey === col.key ? "sorted" : ""}`}
                    onClick={() => col.key !== "_compare" && handleSort(col.key)}>
                    {col.label}
                    {sortKey === col.key && (sortDir === "asc" ? " ↑" : " ↓")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.school}
                  className={`${selected === s.school ? "selected-row" : ""} ${s.reliable ? "" : "unreliable-row"}`}
                  onClick={() => selectSchool(s.school)}>
                  {COLS.map((col) => (
                    <td key={col.key} className={col.align === "left" ? "left" : col.align === "center" ? "center" : ""}>
                      {col.render ? col.render(s[col.key], s) : (s[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={COLS.length} className="empty-row">No schools match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedSchool && (
        <div className="school-popup">
          <button className="popup-close" onClick={() => setSelected(null)}>✕</button>
          <h3>{selectedSchool.school}</h3>
          <div className="popup-stats">
            <div><span className="accepted-text">{selectedSchool.accepted}</span> accepted</div>
            <div><span className="rejected-text">{selectedSchool.rejected}</span> rejected</div>
            <div>{selectedSchool.accept_rate != null ? (selectedSchool.accept_rate * 100).toFixed(1) + "%" : "—"} rate
              {selectedSchool.ci_low != null && (
                <span className="ci-range" title="Wilson 95% confidence interval">
                  {" "}(95% CI {(selectedSchool.ci_low * 100).toFixed(0)}–{(selectedSchool.ci_high * 100).toFixed(0)}%)
                </span>
              )}
              {!selectedSchool.reliable && <span className="unreliable"> (n={selectedSchool.total})</span>}
            </div>
            <div>GPA: {selectedSchool.avg_gpa?.toFixed(2) ?? "—"}</div>
            <div>SAT: {selectedSchool.avg_sat?.toFixed(0) ?? "—"}</div>
            <div>ECs: {selectedSchool.avg_ecs?.toFixed(1) ?? "—"}</div>
            <div>STEM: {selectedSchool.stem_share != null ? (selectedSchool.stem_share * 100).toFixed(0) + "%" : "—"}</div>
          </div>

          <ApplicantList title="Accepted" profiles={selectedSchool.accepted_profiles || []}
            className="accepted-list" onSelect={setSelectedId} />
          <ApplicantList title="Rejected" profiles={selectedSchool.rejected_profiles || []}
            className="rejected-list" onSelect={setSelectedId} />
        </div>
      )}

      <ProfileDrawer applicantId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function ApplicantList({ title, profiles, className, onSelect }) {
  if (!profiles.length) return null;
  return (
    <div className={`school-applicant-list ${className}`}>
      <h4>{title} ({profiles.length})</h4>
      <div className="school-applicant-grid">
        {profiles.map((p) => (
          <button key={p.applicant_id} className="school-applicant-row"
            onClick={() => onSelect(p.applicant_id)}>
            <span className="sa-id">#{p.applicant_id}</span>
            <span className="sa-stat">{p.gpa_unweighted?.toFixed(2) ?? "—"} GPA</span>
            <span className="sa-stat">{p.sat_equivalent?.toFixed(0) ?? "—"} SAT</span>
            <span className="sa-stat">{p.num_ecs ?? 0} EC</span>
            <span className="sa-major">{(p.majors || []).join(", ") || "—"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const COMPARE_ROWS = [
  { label: "Accepted", key: "accepted", higher: true },
  { label: "Rejected", key: "rejected", higher: false },
  { label: "Total", key: "total" },
  { label: "Accept Rate", key: "accept_rate", fmt: (v) => v != null ? (v * 100).toFixed(1) + "%" : "—", higher: true },
  { label: "Avg GPA", key: "avg_gpa", fmt: (v) => v?.toFixed(2) ?? "—", higher: true },
  { label: "Avg SAT", key: "avg_sat", fmt: (v) => v?.toFixed(0) ?? "—", higher: true },
  { label: "Avg ECs", key: "avg_ecs", fmt: (v) => v?.toFixed(1) ?? "—", higher: true },
  { label: "Avg Awards", key: "avg_awards", fmt: (v) => v?.toFixed(1) ?? "—", higher: true },
  { label: "STEM %", key: "stem_share", fmt: (v) => v != null ? (v * 100).toFixed(0) + "%" : "—" },
];

function SchoolCompare({ schools, onClear, onBrowse }) {
  return (
    <section className="chart-section compare-section">
      <div className="school-detail-header">
        <h2>School Comparison</h2>
        <button className="browse-btn" onClick={onClear}>Clear comparison</button>
      </div>
      <div className="compare-table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th></th>
              {schools.map((s) => <th key={s.school}>{s.school}</th>)}
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((row) => {
              const values = schools.map((s) => s[row.key]);
              return (
                <tr key={row.key}>
                  <td className="compare-label">{row.label}</td>
                  {schools.map((s, i) => (
                    <td key={s.school} className={rankClass(values, i, row.higher)}>
                      {row.fmt ? row.fmt(s[row.key]) : (s[row.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr>
              <td className="compare-label">Browse</td>
              {schools.map((s) => (
                <td key={s.school}>
                  <button className="browse-btn-sm" onClick={() => onBrowse(s.school)}>
                    View profiles
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
