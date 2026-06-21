import { useFilters } from "../context/FilterContext";
import "./Sidebar.css";

export default function Sidebar() {
  const { filters, update, reset, options, activeChips, hideUnreliable, setHideUnreliable } = useFilters();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Filters</span>
        {activeChips.length > 0 && (
          <button className="reset-btn" onClick={reset}>Clear all</button>
        )}
      </div>

      {activeChips.length > 0 && (
        <div className="chip-row">
          {activeChips.map((c) => (
            <span key={c.key} className="chip">{c.label}</span>
          ))}
        </div>
      )}

      <section className="filter-section">
        <label>GPA (unweighted)</label>
        <div className="range-row">
          <input type="number" placeholder="Min" min="0" max="4" step="0.1"
            value={filters.gpa_min}
            onChange={(e) => update("gpa_min", e.target.value)} />
          <span>–</span>
          <input type="number" placeholder="Max" min="0" max="4" step="0.1"
            value={filters.gpa_max}
            onChange={(e) => update("gpa_max", e.target.value)} />
        </div>
      </section>

      <section className="filter-section">
        <label>SAT equivalent</label>
        <div className="range-row">
          <input type="number" placeholder="Min" min="400" max="1600" step="10"
            value={filters.sat_min}
            onChange={(e) => update("sat_min", e.target.value)} />
          <span>–</span>
          <input type="number" placeholder="Max" min="400" max="1600" step="10"
            value={filters.sat_max}
            onChange={(e) => update("sat_max", e.target.value)} />
        </div>
      </section>

      <section className="filter-section">
        <label>Accepted tier</label>
        <select value={filters.accepted_tier}
          onChange={(e) => update("accepted_tier", e.target.value)}>
          <option value="">Any</option>
          <option value="t5">T5</option>
          <option value="t10">T10</option>
          <option value="t20">T20</option>
          <option value="t50">T50</option>
        </select>
      </section>

      <section className="filter-section">
        <label>Major</label>
        <select value={filters.major}
          onChange={(e) => update("major", e.target.value)}>
          <option value="">Any</option>
          {options?.majors.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </section>

      <section className="filter-section">
        <label>Race / ethnicity</label>
        <select value={filters.race}
          onChange={(e) => update("race", e.target.value)}>
          <option value="">Any</option>
          {options?.races.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </section>

      <section className="filter-section">
        <label>Gender</label>
        <select value={filters.gender}
          onChange={(e) => update("gender", e.target.value)}>
          <option value="">Any</option>
          {options?.genders?.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </section>

      <section className="filter-section">
        <label>Accepted at school</label>
        <select value={filters.accepted_at}
          onChange={(e) => update("accepted_at", e.target.value)}>
          <option value="">Any</option>
          {options?.schools?.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </section>

      <section className="filter-section">
        <label>EC category</label>
        <select value={filters.ec_category}
          onChange={(e) => update("ec_category", e.target.value)}>
          <option value="">Any</option>
          {options?.ec_categories.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </section>

      <section className="filter-section">
        <label>Award category</label>
        <select value={filters.award_category}
          onChange={(e) => update("award_category", e.target.value)}>
          <option value="">Any</option>
          {options?.award_categories.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </section>

      <section className="filter-section toggles">
        <label className="toggle-label">
          <input type="checkbox" checked={filters.stem_only}
            onChange={(e) => update("stem_only", e.target.checked)} />
          STEM majors only
        </label>
        <label className="toggle-label">
          <input type="checkbox" checked={filters.test_optional_only}
            onChange={(e) => update("test_optional_only", e.target.checked)} />
          Test optional only
        </label>
        <label className="toggle-label">
          <input type="checkbox" checked={hideUnreliable}
            onChange={(e) => setHideUnreliable(e.target.checked)} />
          Hide small samples (n &lt; 15)
        </label>
      </section>
    </aside>
  );
}
