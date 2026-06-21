import { useState, useEffect } from "react";
import { api } from "../api";
import { useSaved } from "../context/SavedContext";
import "./ProfileDrawer.css";

export default function ProfileDrawer({ applicantId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toggle, isSaved } = useSaved();

  useEffect(() => {
    if (!applicantId) return;
    setLoading(true);
    setSubmitted(false);
    setRating(null);
    api.applicant(applicantId)
      .then((p) => {
        setProfile(p);
        setLoading(false);
      })
      .catch(() => {
        setProfile(null);
        setLoading(false);
      });
  }, [applicantId]);

  async function submitRating() {
    if (!rating) return;
    setSubmitting(true);
    await api.rate(applicantId, rating);
    // Refresh profile to get updated rating summary
    const updated = await api.applicant(applicantId);
    setProfile(updated);
    setSubmitting(false);
    setSubmitted(true);
  }

  if (!applicantId) return null;

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-actions">
          <button className={`save-btn ${applicantId && isSaved(applicantId) ? "saved" : ""}`}
            onClick={() => toggle(applicantId)}>
            {applicantId && isSaved(applicantId) ? "★ Saved" : "☆ Save"}
          </button>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="drawer-loading">Loading profile…</div>
        ) : !profile ? (
          <div className="drawer-loading">Failed to load profile.</div>
        ) : (
          <div className="drawer-content">
            <h2 className="drawer-title">Profile #{profile.applicant_id}</h2>

            <section className="drawer-section">
              <h3>Academics</h3>
              <dl className="stat-grid">
                <Stat label="GPA (unweighted)" value={profile.gpa_unweighted} />
                <Stat label="GPA (weighted)" value={profile.gpa_weighted} />
                <Stat label="SAT" value={profile.sat || "—"} />
                <Stat label="ACT" value={profile.act || "—"} />
                <Stat label="SAT equivalent" value={profile.sat_equivalent} />
                <Stat label="AP classes" value={profile.ap_classes} />
                <Stat label="IB classes" value={profile.ib_classes || 0} />
                <Stat label="College credits" value={profile.college_credit_classes || 0} />
              </dl>
            </section>

            <section className="drawer-section">
              <h3>Demographics</h3>
              <dl className="stat-grid">
                <Stat label="Gender" value={profile.gender || "Not reported"} />
                <Stat label="Race / ethnicity" value={profile.race?.join(", ") || "Not reported"} />
                <Stat label="Test optional" value={profile.test_optional ? "Yes" : "No"} />
                <Stat label="STEM major" value={profile.stem_major ? "Yes" : "No"} />
              </dl>
            </section>

            <section className="drawer-section">
              <h3>Majors</h3>
              <TagList items={profile.majors} empty="Not listed" />
            </section>

            <section className="drawer-section">
              <h3>Extracurriculars</h3>
              <ul className="detail-list">
                {profile.extracurriculars?.length
                  ? profile.extracurriculars.map((e, i) => <li key={i}>{e}</li>)
                  : <li className="empty">None listed</li>}
              </ul>
              {profile.ec_categories?.length > 0 && (
                <TagList items={profile.ec_categories} label="Categories:" />
              )}
            </section>

            <section className="drawer-section">
              <h3>Awards</h3>
              <ul className="detail-list">
                {profile.awards?.length
                  ? profile.awards.map((a, i) => <li key={i}>{a}</li>)
                  : <li className="empty">None listed</li>}
              </ul>
              {profile.award_categories?.length > 0 && (
                <TagList items={profile.award_categories} label="Categories:" />
              )}
            </section>

            <section className="drawer-section">
              <h3>Outcomes</h3>
              <div className="outcome-group">
                <strong>Accepted ({profile.num_acceptances})</strong>
                <TagList items={profile.acceptances} empty="None" />
              </div>
              <div className="outcome-group">
                <strong>Rejected ({profile.num_rejections})</strong>
                <TagList items={profile.rejections} empty="None" />
              </div>
              <div className="tier-flags">
                {["t5","t10","t20","t50"].map((t) =>
                  profile[`${t}_accepted`] && (
                    <span key={t} className="tier-badge">{t.toUpperCase()}</span>
                  )
                )}
              </div>
            </section>

            <section className="drawer-section">
              <h3>Community Rating</h3>
              {profile.ratings?.count > 0 ? (
                <div className="rating-summary">
                  <span className="rating-avg">{profile.ratings.average}</span>
                  <span className="rating-meta">/ 10 · {profile.ratings.count} rating{profile.ratings.count !== 1 ? "s" : ""}</span>
                </div>
              ) : (
                <p className="empty">No ratings yet.</p>
              )}

              {submitted ? (
                <p className="rating-thanks">Rating submitted!</p>
              ) : (
                <div className="rating-input">
                  <label>Rate this profile (1–10)</label>
                  <div className="star-row">
                    {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                      <button key={n}
                        className={`star-btn ${rating === n ? "selected" : ""}`}
                        onClick={() => setRating(n)}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <button className="submit-btn"
                    disabled={!rating || submitting}
                    onClick={submitRating}>
                    {submitting ? "Submitting…" : "Submit rating"}
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value ?? "—"}</dd>
    </>
  );
}

function TagList({ items, empty = "None", label }) {
  if (!items?.length) return <span className="empty">{empty}</span>;
  return (
    <div className="tag-list">
      {label && <span className="tag-list-label">{label} </span>}
      {items.map((item, i) => <span key={i} className="tag">{item}</span>)}
    </div>
  );
}
