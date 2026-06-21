import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import { useFilters } from "../context/FilterContext";
import { usePageTitle } from "../utils";
import ProfileDrawer from "../components/ProfileDrawer";
import "./Browser.css";

const COLS = [
  { key: "applicant_id", label: "#" },
  { key: "gpa_unweighted", label: "GPA (UW)" },
  { key: "gpa_weighted", label: "GPA (W)" },
  { key: "sat_equivalent", label: "SAT Eq" },
  { key: "majors", label: "Majors", render: (v) => v?.join(", ") || "—" },
  { key: "stem_major", label: "STEM", render: (v) => v ? "✓" : "" },
  { key: "num_ecs", label: "ECs" },
  { key: "num_awards", label: "Awards" },
  { key: "num_acceptances", label: "Accepted" },
  { key: "t20_accepted", label: "T20", render: (v) => v ? "✓" : "" },
  { key: "t5_accepted", label: "T5", render: (v) => v ? "✓" : "" },
];

export default function Browser() {
  const { filters } = useFilters();
  const [profiles, setProfiles] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [sortKey, setSortKey] = useState("applicant_id");
  const [sortDir, setSortDir] = useState("asc");
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  usePageTitle("Browse Applicants");

  const load = useCallback(() => {
    setLoading(true);
    api.applicants({ ...filters, limit: LIMIT, offset })
      .then(({ applicants, count }) => {
        setProfiles(applicants);
        setTotal(count);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filters, offset]);

  useEffect(() => {
    setOffset(0);
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  // Client-side search on visible page
  const visible = profiles.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.majors?.join(" ").toLowerCase().includes(q) ||
      p.acceptances?.join(" ").toLowerCase().includes(q) ||
      p.ec_categories?.join(" ").toLowerCase().includes(q) ||
      String(p.applicant_id).includes(q)
    );
  });

  // Client-side sort on visible page
  const sorted = [...visible].sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (Array.isArray(av)) av = av.join();
    if (Array.isArray(bv)) bv = bv.join();
    if (av == null) return 1;
    if (bv == null) return -1;
    return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  return (
    <div className="page browser">
      <div className="browser-header">
        <div>
          <h1>Applicant Browser</h1>
          <p className="page-sub">
            {total} profiles match current filters.
            {total > LIMIT && ` Showing ${offset + 1}–${Math.min(offset + LIMIT, total)}.`}
          </p>
        </div>
        <input className="search-box" placeholder="Search majors, schools, ECs…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="page-loading">Loading…</div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="applicant-table">
              <thead>
                <tr>
                  {COLS.map((col) => (
                    <th key={col.key} onClick={() => handleSort(col.key)}
                      className={sortKey === col.key ? "sorted" : ""}>
                      {col.label}
                      {sortKey === col.key && (sortDir === "asc" ? " ↑" : " ↓")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.applicant_id}
                    className="clickable-row"
                    onClick={() => setSelectedId(p.applicant_id)}>
                    {COLS.map((col) => (
                      <td key={col.key}>
                        {col.render ? col.render(p[col.key]) : (p[col.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr><td colSpan={COLS.length} className="empty-row">No profiles match.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {total > LIMIT && (
            <div className="pagination">
              <button disabled={offset === 0} onClick={() => setOffset((o) => o - LIMIT)}>
                ← Previous
              </button>
              <span>Page {Math.floor(offset / LIMIT) + 1} of {Math.ceil(total / LIMIT)}</span>
              <button disabled={offset + LIMIT >= total} onClick={() => setOffset((o) => o + LIMIT)}>
                Next →
              </button>
            </div>
          )}
        </>
      )}

      <ProfileDrawer applicantId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
