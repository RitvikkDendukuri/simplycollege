import { useState, useEffect } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { api } from "../api";
import { useFilters } from "../context/FilterContext";
import { usePageTitle } from "../utils";
import { MIN_RELIABLE_N } from "../constants";
import ProfileDrawer from "../components/ProfileDrawer";
import "./Archetypes.css";

const ARCHETYPE_COLORS = {
  "GPA-Focused": "#e4e4ef",
  "SAT-Focused": "#a0a0b8",
  "EC-Focused": "#7a7a90",
  "Award-Focused": "#5a5a6e",
  "Well-Balanced": "#c0c0d0",
};

const GROUPED_COLORS = ["#e4e4ef", "#a0a0b8", "#7a7a90", "#5a5a6e"];

export default function Archetypes() {
  const [view, setView] = useState("detailed");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const { debouncedFilters: filters } = useFilters();

  usePageTitle("Profile Archetypes");

  useEffect(() => {
    setLoading(true);
    setError(null);
    setExpanded(null);
    setData(null);
    api.archetypes(view, filters)
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [view, filters]);

  if (loading) return <div className="page-loading">Analyzing profiles...</div>;
  if (error) return <div className="page-error">Error: {error}</div>;
  if (data && data.total_profiles === 0) return (
    <div className="page archetypes">
      <h1>Profile Archetypes</h1>
      <div className="similar-empty">
        No profiles with full GPA / SAT / EC / award data match the current filters.
        Try adjusting or clearing your filters.
      </div>
    </div>
  );

  return (
    <div className="page archetypes">
      <h1>Profile Archetypes</h1>
      <p className="page-sub">
        Each profile is classified by its strongest trait relative to the scale:
        10 ECs = 5 awards = 4.0 GPA = 1600 SAT. Profiles with similar scores across all
        dimensions are "Well-Balanced." Respects the sidebar filters —
        {" "}{data.total_profiles} profiles analyzed.
      </p>

      <div className="view-toggle">
        <button className={`mode-tab ${view === "detailed" ? "active" : ""}`}
          onClick={() => setView("detailed")}>
          By strongest trait
        </button>
        <button className={`mode-tab ${view === "grouped" ? "active" : ""}`}
          onClick={() => setView("grouped")}>
          Grouped (academics / activity)
        </button>
      </div>

      {view === "detailed" && data?.clusters ? (
        <DetailedView data={data} expanded={expanded} setExpanded={setExpanded}
          setSelectedId={setSelectedId} />
      ) : view === "grouped" && data?.by_academics ? (
        <GroupedView data={data} expanded={expanded} setExpanded={setExpanded}
          setSelectedId={setSelectedId} />
      ) : null}

      <ProfileDrawer applicantId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

const RADAR_SCALES = {
  gpa:    { floor: 2.5, ceiling: 4.0 },
  sat:    { floor: 1000, ceiling: 1600 },
  ecs:    { floor: 0, ceiling: 10 },
  awards: { floor: 0, ceiling: 5 },
};

function getRadarScales() {
  return RADAR_SCALES;
}

function DetailedView({ data, expanded, setExpanded, setSelectedId }) {
  const { clusters, total_profiles } = data;
  const scales = getRadarScales();

  const chartData = clusters.map((c) => ({
    name: c.label.replace("-Focused", ""),
    "T20 Rate": +(c.t20_rate * 100).toFixed(1),
    "T5 Rate": +(c.t5_rate * 100).toFixed(1),
    n: c.n,
    fill: ARCHETYPE_COLORS[c.label] || "#6366f1",
  }));

  return (
    <>
      <section className="chart-section">
        <span className="section-num">01</span>
        <h2>T20 acceptance rate by archetype</h2>
        <p className="section-sub">Which profile shape gets into T20 schools most often?</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--text-sub)" }} />
            <YAxis unit="%" domain={[0, 100]} tick={{ fill: "var(--text-sub)" }} />
            <Tooltip content={({ payload, label }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="custom-tooltip">
                  <strong>{label}</strong> (n={d.n})
                  <div>T20: {d["T20 Rate"]}%</div>
                  <div>T5: {d["T5 Rate"]}%</div>
                </div>
              );
            }} />
            <Bar dataKey="T20 Rate" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <rect key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      <div className="archetype-grid">
        {clusters.map((cluster) => (
          <ArchetypeCard key={cluster.label} cluster={cluster} total={total_profiles}
            scales={scales}
            color={ARCHETYPE_COLORS[cluster.label] || "#6366f1"}
            expanded={expanded === cluster.label}
            onToggle={() => setExpanded(expanded === cluster.label ? null : cluster.label)}
            onSelectProfile={setSelectedId} />
        ))}
      </div>
    </>
  );
}

function GroupedView({ data, expanded, setExpanded, setSelectedId }) {
  const scales = getRadarScales();
  const academics = data.by_academics || [];
  const activity = data.by_activity || [];

  return (
    <>
      <section className="chart-section">
        <span className="section-num">01</span>
        <h2>By academic strength (GPA + SAT combined)</h2>
        <p className="section-sub">Profiles grouped by their combined GPA and SAT score.</p>
        <GroupChart groups={academics} />
      </section>
      <div className="archetype-grid">
        {academics.map((g, i) => (
          <ArchetypeCard key={g.label} cluster={g} total={data.total_profiles}
            scales={scales}
            color={GROUPED_COLORS[i % GROUPED_COLORS.length]}
            expanded={expanded === `a-${g.label}`}
            onToggle={() => setExpanded(expanded === `a-${g.label}` ? null : `a-${g.label}`)}
            onSelectProfile={setSelectedId} />
        ))}
      </div>

      <section className="chart-section" style={{ marginTop: 28 }}>
        <span className="section-num">02</span>
        <h2>By activity level (ECs + awards combined)</h2>
        <p className="section-sub">Profiles grouped by their combined extracurricular and award count.</p>
        <GroupChart groups={activity} />
      </section>
      <div className="archetype-grid">
        {activity.map((g, i) => (
          <ArchetypeCard key={g.label} cluster={g} total={data.total_profiles}
            scales={scales}
            color={GROUPED_COLORS[i % GROUPED_COLORS.length]}
            expanded={expanded === `b-${g.label}`}
            onToggle={() => setExpanded(expanded === `b-${g.label}` ? null : `b-${g.label}`)}
            onSelectProfile={setSelectedId} />
        ))}
      </div>
    </>
  );
}

function GroupChart({ groups }) {
  const chartData = groups.map((g) => ({
    name: g.label.split("(")[0].trim(),
    "T20 Rate": +(g.t20_rate * 100).toFixed(1),
    n: g.n,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-sub)" }} />
        <YAxis unit="%" domain={[0, 100]} tick={{ fill: "var(--text-sub)" }} />
        <Tooltip content={({ payload, label }) => {
          if (!payload?.length) return null;
          const d = payload[0].payload;
          return (
            <div className="custom-tooltip">
              <strong>{label}</strong> (n={d.n})
              <div>T20: {d["T20 Rate"]}%</div>
            </div>
          );
        }} />
        <Bar dataKey="T20 Rate" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function scaleVal(val, range) {
  if (!val) return 0;
  const clamped = Math.max(range.floor, Math.min(range.ceiling, val));
  return ((clamped - range.floor) / (range.ceiling - range.floor)) * 100;
}

function ArchetypeCard({ cluster, total, scales, color, expanded, onToggle, onSelectProfile }) {
  const radarData = [
    { axis: "GPA", value: scaleVal(cluster.avg_gpa, scales.gpa) },
    { axis: "SAT", value: scaleVal(cluster.avg_sat, scales.sat) },
    { axis: "ECs", value: scaleVal(cluster.avg_ecs, scales.ecs) },
    { axis: "Awards", value: scaleVal(cluster.avg_awards, scales.awards) },
  ];

  return (
    <div className={`archetype-card ${expanded ? "expanded" : ""} ${cluster.reliable === false ? "unreliable-card" : ""}`}
      style={{ borderColor: color }}>
      <div className="archetype-header" onClick={onToggle}>
        <div>
          <div className="archetype-label" style={{ color }}>{cluster.label}</div>
          <div className="archetype-count">
            {cluster.n} profiles ({((cluster.n / total) * 100).toFixed(0)}%)
            {cluster.reliable === false && (
              <span className="archetype-warn" title={`Small sample (n < ${MIN_RELIABLE_N}) — rates below are unreliable`}> ⚠</span>
            )}
          </div>
        </div>
        <div className="archetype-t20">
          <span className="t20-value">{(cluster.t20_rate * 100).toFixed(0)}%</span>
          <span className="t20-label">T20</span>
        </div>
      </div>

      <div className="archetype-stats">
        <div><span className="stat-label">GPA</span><span className="stat-val">{cluster.avg_gpa?.toFixed(2) ?? "—"}</span></div>
        <div><span className="stat-label">SAT</span><span className="stat-val">{cluster.avg_sat?.toFixed(0) ?? "—"}</span></div>
        <div><span className="stat-label">ECs</span><span className="stat-val">{cluster.avg_ecs?.toFixed(1) ?? "—"}</span></div>
        <div><span className="stat-label">Awards</span><span className="stat-val">{cluster.avg_awards?.toFixed(1) ?? "—"}</span></div>
        <div><span className="stat-label">STEM</span><span className="stat-val">{(cluster.stem_pct * 100).toFixed(0)}%</span></div>
        <div><span className="stat-label">T5</span><span className="stat-val">{(cluster.t5_rate * 100).toFixed(0)}%</span></div>
      </div>

      <div className="archetype-radar">
        <ResponsiveContainer width="100%" height={200}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "var(--text-sub)" }} />
            <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
            <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.2} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {expanded && (
        <div className="archetype-detail">
          <div className="detail-section">
            <h4>Top EC categories</h4>
            <div className="detail-tags">
              {cluster.top_ecs.map(([cat, count]) => (
                <span key={cat} className="detail-tag">{cat} <small>({count})</small></span>
              ))}
            </div>
          </div>
          <div className="detail-section">
            <h4>Top award categories</h4>
            <div className="detail-tags">
              {cluster.top_awards.map(([cat, count]) => (
                <span key={cat} className="detail-tag">{cat} <small>({count})</small></span>
              ))}
            </div>
          </div>
          <div className="detail-section">
            <h4>Top majors</h4>
            <div className="detail-tags">
              {cluster.top_majors.map(([maj, count]) => (
                <span key={maj} className="detail-tag">{maj} <small>({count})</small></span>
              ))}
            </div>
          </div>
          <div className="detail-section">
            <h4>Browse profiles in this archetype ({cluster.n})</h4>
            <MemberBrowser members={cluster.members || []} onSelectProfile={onSelectProfile} />
          </div>
        </div>
      )}

      <button className="expand-btn" onClick={onToggle}>
        {expanded ? "Show less" : "Explore archetype"}
      </button>
    </div>
  );
}

function MemberBrowser({ members, onSelectProfile }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("sat_equivalent");

  const filtered = members.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(m.applicant_id).includes(q) ||
      (m.majors || []).join(" ").toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (av == null) return 1;
    if (bv == null) return -1;
    return bv - av; // high to low
  });

  return (
    <div className="member-browser">
      <div className="member-browser-controls">
        <input className="member-search" placeholder="Search id or major…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
          <option value="sat_equivalent">Sort: SAT</option>
          <option value="gpa_unweighted">Sort: GPA</option>
          <option value="num_ecs">Sort: ECs</option>
          <option value="num_awards">Sort: Awards</option>
        </select>
        <span className="member-count">{sorted.length} shown</span>
      </div>
      <div className="member-grid">
        {sorted.map((m) => (
          <button key={m.applicant_id} className="member-row"
            onClick={() => onSelectProfile(m.applicant_id)}>
            <span className="member-id">#{m.applicant_id}</span>
            <span className="member-stat">{m.gpa_unweighted?.toFixed(2) ?? "—"} GPA</span>
            <span className="member-stat">{m.sat_equivalent?.toFixed(0) ?? "—"} SAT</span>
            <span className="member-stat">{m.num_ecs ?? 0} EC · {m.num_awards ?? 0} aw</span>
            <span className="member-major">{(m.majors || []).join(", ") || "—"}</span>
            <span className="member-tiers">
              {m.t5_accepted && <span className="tier-badge">T5</span>}
              {m.t20_accepted && !m.t5_accepted && <span className="tier-badge">T20</span>}
            </span>
          </button>
        ))}
        {sorted.length === 0 && <div className="member-empty">No profiles match.</div>}
      </div>
    </div>
  );
}
