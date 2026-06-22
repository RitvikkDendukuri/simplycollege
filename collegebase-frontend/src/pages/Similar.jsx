import { useState } from "react";
import { api } from "../api";
import { usePageTitle } from "../utils";
import SampleBadge from "../components/SampleBadge";
import ProfileDrawer from "../components/ProfileDrawer";
import "./Similar.css";

export default function Similar() {
  const [mode, setMode] = useState("custom");
  const [inputId, setInputId] = useState("");
  const [k, setK] = useState(5);
  const [results, setResults] = useState(null);
  const [outcomes, setOutcomes] = useState(null);
  const [anchor, setAnchor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  usePageTitle("Find Similar");

  const [gpa, setGpa] = useState("");
  const [sat, setSat] = useState("");
  const [ecs, setEcs] = useState("");
  const [awards, setAwards] = useState("");
  const [stem, setStem] = useState(false);

  async function runById() {
    const id = parseInt(inputId, 10);
    if (!id || id < 1) {
      setError("Enter a valid profile ID.");
      return;
    }
    setLoading(true);
    setError(null);
    setResults(null);
    setOutcomes(null);
    setAnchor(null);
    try {
      const [anchorData, simData] = await Promise.all([
        api.applicant(id),
        api.similar(id, k),
      ]);
      setAnchor(anchorData);
      setResults(simData.neighbors);
      setOutcomes(simData.outcomes);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function runCustom() {
    const g = parseFloat(gpa);
    const s = parseFloat(sat);
    const e = parseInt(ecs, 10);
    const a = parseInt(awards, 10);

    if (isNaN(g) || g < 0 || g > 4) { setError("Enter a GPA between 0 and 4.0."); return; }
    if (isNaN(s) || s < 400 || s > 1600) { setError("Enter an SAT score between 400 and 1600."); return; }
    if (isNaN(e) || e < 0) { setError("Enter a valid number of ECs."); return; }
    if (isNaN(a) || a < 0) { setError("Enter a valid number of awards."); return; }

    setLoading(true);
    setError(null);
    setResults(null);
    setOutcomes(null);
    setAnchor(null);
    try {
      const data = await api.similarCustom({
        gpa_unweighted: g, sat_equivalent: s,
        num_ecs: e, num_awards: a, stem_major: stem, k,
      });
      setAnchor({
        custom: true,
        gpa_unweighted: g, sat_equivalent: s,
        num_ecs: e, num_awards: a, stem_major: stem,
      });
      setResults(data.neighbors);
      setOutcomes(data.outcomes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function run() {
    if (mode === "id") runById();
    else runCustom();
  }

  return (
    <div className="page similar">
      <h1>Find Similar Profiles</h1>
      <p className="page-sub">
        Look up an existing profile by ID, or enter your own stats to find
        the most similar applicants in the database.
      </p>

      <div className="mode-tabs">
        <button className={`mode-tab ${mode === "custom" ? "active" : ""}`}
          onClick={() => { setMode("custom"); setResults(null); setOutcomes(null); setAnchor(null); setError(null); }}>
          Enter my stats
        </button>
        <button className={`mode-tab ${mode === "id" ? "active" : ""}`}
          onClick={() => { setMode("id"); setResults(null); setOutcomes(null); setAnchor(null); setError(null); }}>
          Look up by ID
        </button>
      </div>

      {mode === "custom" ? (
        <div className="similar-controls custom-controls">
          <label>
            GPA (unweighted)
            <input type="number" min="0" max="4" step="0.01" value={gpa}
              onChange={(e) => setGpa(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="e.g. 3.85" />
          </label>
          <label>
            SAT equivalent
            <input type="number" min="400" max="1600" step="10" value={sat}
              onChange={(e) => setSat(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="e.g. 1480" />
          </label>
          <label>
            # of ECs
            <input type="number" min="0" value={ecs}
              onChange={(e) => setEcs(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="e.g. 8" />
          </label>
          <label>
            # of Awards
            <input type="number" min="0" value={awards}
              onChange={(e) => setAwards(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="e.g. 3" />
          </label>
          <label className="toggle-label-inline">
            <input type="checkbox" checked={stem}
              onChange={(e) => setStem(e.target.checked)} />
            STEM major
          </label>
          <label>
            Neighbors (k)
            <input type="number" min="1" max="20" value={k}
              onChange={(e) => setK(+e.target.value)} />
          </label>
          <button className="run-btn" onClick={run} disabled={loading}>
            {loading ? "Searching..." : "Find similar"}
          </button>
        </div>
      ) : (
        <div className="similar-controls">
          <label>
            Profile ID
            <input type="number" min="1" value={inputId}
              onChange={(e) => setInputId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="e.g. 42" />
          </label>
          <label>
            Neighbors (k)
            <input type="number" min="1" max="20" value={k}
              onChange={(e) => setK(+e.target.value)} />
          </label>
          <button className="run-btn" onClick={run} disabled={loading}>
            {loading ? "Searching..." : "Find similar"}
          </button>
        </div>
      )}

      {error && <div className="page-error">{error}</div>}

      {anchor && (
        <div className="anchor-card"
          onClick={() => !anchor.custom && setSelectedId(anchor.applicant_id)}>
          <div className="anchor-label">{anchor.custom ? "Your profile" : "Anchor profile"}</div>
          {anchor.custom ? (
            <div className="profile-row">
              <div className="pr-stats">
                <span>GPA {anchor.gpa_unweighted}</span>
                <span>SAT eq {anchor.sat_equivalent}</span>
                <span>{anchor.num_ecs} ECs</span>
                <span>{anchor.num_awards} awards</span>
                <span>{anchor.stem_major ? "STEM" : "Non-STEM"}</span>
              </div>
            </div>
          ) : (
            <ProfileRow p={anchor} />
          )}
        </div>
      )}

      {outcomes && outcomes.cohort_n > 0 && (
        <section className="outcomes-card">
          <h2>How applicants like this did</h2>
          <p className="section-sub">
            Acceptance rates across the {outcomes.cohort_n} most similar profiles — the
            honest read on "your odds." Each rate carries its sample size and 95% CI.
            Numbers can't capture EC/award <em>quality</em>, so open the profiles below
            to see what these applicants actually did.
          </p>
          <div className="outcomes-badges">
            {["t5","t10","t20","t50"].map((t) => (
              <SampleBadge key={t} rate={outcomes.tiers[t]} label={`${t.toUpperCase()} accept`} />
            ))}
          </div>
        </section>
      )}

      {results && (
        <>
          <h2>Top {results.length} similar profiles</h2>
          <p className="section-sub">Ranked by distance in standardized GPA + SAT + EC + award space. Click any row to open full profile.</p>
          <div className="similar-list">
            {results.map((p, i) => (
              <div key={p.applicant_id} className="similar-card"
                onClick={() => setSelectedId(p.applicant_id)}>
                <div className="rank">#{i + 1}</div>
                <ProfileRow p={p} />
              </div>
            ))}
          </div>
        </>
      )}

      {!results && !loading && !error && (
        <div className="similar-empty">
          {mode === "custom"
            ? "Enter your stats above and click \"Find similar\" to see the nearest matches."
            : "Enter a profile ID above and click \"Find similar\" to see the nearest neighbours."}
        </div>
      )}

      <ProfileDrawer applicantId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function ProfileRow({ p }) {
  const tiers = ["t5","t10","t20","t50"].filter((t) => p[`${t}_accepted`]);
  return (
    <div className="profile-row">
      <div className="pr-id">#{p.applicant_id}</div>
      <div className="pr-stats">
        <span>GPA {p.gpa_unweighted ?? "---"}</span>
        <span>SAT eq {p.sat_equivalent ?? "---"}</span>
        <span>{p.num_ecs} ECs</span>
        <span>{p.num_awards} awards</span>
      </div>
      <div className="pr-majors">{p.majors?.join(", ") || "---"}</div>
      <div className="pr-tiers">
        {tiers.map((t) => <span key={t} className="tier-badge">{t.toUpperCase()}</span>)}
      </div>
    </div>
  );
}
