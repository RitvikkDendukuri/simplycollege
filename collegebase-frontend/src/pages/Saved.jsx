import { useState, useEffect } from "react";
import { api } from "../api";
import { useSaved } from "../context/SavedContext";
import { rankClass, usePageTitle } from "../utils";
import ProfileDrawer from "../components/ProfileDrawer";
import "./Saved.css";

const COMPARE_FIELDS = [
  { label: "GPA (UW)", key: "gpa_unweighted", fmt: (v) => v?.toFixed(2) ?? "—", higher: true },
  { label: "SAT Eq", key: "sat_equivalent", fmt: (v) => v?.toFixed(0) ?? "—", higher: true },
  { label: "ECs", key: "num_ecs", higher: true },
  { label: "Awards", key: "num_awards", higher: true },
  { label: "Accepted", key: "num_acceptances", higher: true },
  { label: "Rejected", key: "num_rejections", higher: false },
  { label: "STEM", key: "stem_major", fmt: (v) => v ? "Yes" : "No" },
  { label: "T5", key: "t5_accepted", fmt: (v) => v ? "Yes" : "" },
  { label: "T10", key: "t10_accepted", fmt: (v) => v ? "Yes" : "" },
  { label: "T20", key: "t20_accepted", fmt: (v) => v ? "Yes" : "" },
  { label: "T50", key: "t50_accepted", fmt: (v) => v ? "Yes" : "" },
  { label: "Majors", key: "majors", fmt: (v) => v?.join(", ") || "—" },
];

export default function Saved() {
  const { savedIds, toggle, clear } = useSaved();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  usePageTitle("Saved Profiles");

  useEffect(() => {
    if (savedIds.length === 0) {
      setProfiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all(savedIds.map((id) => api.applicant(id)))
      .then((results) => { setProfiles(results); setLoading(false); })
      .catch(() => setLoading(false));
  }, [savedIds]);

  if (loading) return <div className="page-loading">Loading saved profiles...</div>;

  return (
    <div className="page saved">
      <h1>Saved Profiles</h1>
      <p className="page-sub">
        {savedIds.length === 0
          ? "No profiles saved yet. Open any profile and click the star to save it."
          : `${savedIds.length} saved profile${savedIds.length !== 1 ? "s" : ""}. Click a row to view, or compare them side by side below.`}
      </p>

      {profiles.length > 0 && (
        <>
          <div className="saved-actions">
            <button className="browse-btn" onClick={clear}>Clear all saved</button>
          </div>

          <section className="chart-section">
            <h2>Saved profiles</h2>
            <div className="saved-list">
              {profiles.map((p) => (
                <div key={p.applicant_id} className="saved-card">
                  <div className="saved-card-main" onClick={() => setSelectedId(p.applicant_id)}>
                    <span className="saved-id">#{p.applicant_id}</span>
                    <span>{p.gpa_unweighted?.toFixed(2) ?? "—"} GPA</span>
                    <span>{p.sat_equivalent?.toFixed(0) ?? "—"} SAT</span>
                    <span>{p.majors?.join(", ") || "—"}</span>
                    <span className="saved-tiers">
                      {["t5","t10","t20","t50"].filter((t) => p[`${t}_accepted`])
                        .map((t) => <span key={t} className="tier-badge">{t.toUpperCase()}</span>)}
                    </span>
                  </div>
                  <button className="remove-btn" onClick={() => toggle(p.applicant_id)}
                    title="Remove from saved">✕</button>
                </div>
              ))}
            </div>
          </section>

          {profiles.length >= 2 && (
            <section className="chart-section">
              <h2>Comparison</h2>
              <div className="compare-wrap">
                <table className="profile-compare">
                  <thead>
                    <tr>
                      <th></th>
                      {profiles.map((p) => (
                        <th key={p.applicant_id}
                          className="compare-header"
                          onClick={() => setSelectedId(p.applicant_id)}>
                          #{p.applicant_id}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE_FIELDS.map((field) => {
                      const values = profiles.map((p) => p[field.key]);
                      return (
                        <tr key={field.key}>
                          <td className="compare-label">{field.label}</td>
                          {profiles.map((p, i) => (
                            <td key={p.applicant_id}
                              className={rankClass(values, i, field.higher)}>
                              {field.fmt ? field.fmt(p[field.key]) : (p[field.key] ?? "—")}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                    <tr>
                      <td className="compare-label">Top Acceptances</td>
                      {profiles.map((p) => (
                        <td key={p.applicant_id} className="compare-schools">
                          {(p.acceptances || []).slice(0, 5).map((s, i) => (
                            <div key={i}>{s}</div>
                          ))}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <ProfileDrawer applicantId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
