import { createContext, useContext, useState, useEffect } from "react";
import { api } from "../api";

const FilterContext = createContext(null);

export const DEFAULT_FILTERS = {
  gpa_min: "",
  gpa_max: "",
  sat_min: "",
  sat_max: "",
  stem_only: false,
  test_optional_only: false,
  submitted_scores_only: false,
  accepted_tier: "",
  major: "",
  race: "",
  race_group: "",
  gender: "",
  accepted_at: "",
  ec_category: "",
  award_category: "",
};

export function FilterProvider({ children }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [options, setOptions] = useState(null);
  const [hideUnreliable, setHideUnreliable] = useState(false);

  useEffect(() => {
    api.filterOptions().then(setOptions).catch(console.error);
  }, []);

  const update = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const reset = () => setFilters(DEFAULT_FILTERS);

  // Active filter chips for display
  const activeChips = Object.entries(filters).flatMap(([k, v]) => {
    if (!v || v === "") return [];
    const labelFns = {
      gpa_min: () => `GPA ≥ ${v}`,
      gpa_max: () => `GPA ≤ ${v}`,
      sat_min: () => `SAT ≥ ${v}`,
      sat_max: () => `SAT ≤ ${v}`,
      stem_only: () => "STEM only",
      test_optional_only: () => "Test optional",
      submitted_scores_only: () => "Submitted scores",
      accepted_tier: () => `Accepted ${String(v).toUpperCase()}`,
      major: () => `Major: ${v}`,
      race: () => `Race: ${v}`,
      race_group: () => `Race group: ${v}`,
      gender: () => `Gender: ${v}`,
      accepted_at: () => `School: ${v}`,
      ec_category: () => `EC: ${v}`,
      award_category: () => `Award: ${v}`,
    };
    return labelFns[k] ? [{ key: k, label: labelFns[k]() }] : [];
  });

  return (
    <FilterContext.Provider value={{ filters, update, reset, options, activeChips, hideUnreliable, setHideUnreliable }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  return useContext(FilterContext);
}
