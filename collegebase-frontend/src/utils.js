import { useEffect, useState } from "react";

export function rankClass(values, idx, higherIsBetter) {
  if (higherIsBetter === undefined) return "";
  const nums = values.filter((v) => v != null && typeof v === "number");
  if (nums.length < 2) return "";
  const v = values[idx];
  if (v == null || typeof v !== "number") return "";
  const max = Math.max(...nums);
  const min = Math.min(...nums);
  if (max === min) return "";
  if (higherIsBetter) return v === max ? "compare-best" : v === min ? "compare-worst" : "";
  return v === min ? "compare-best" : v === max ? "compare-worst" : "";
}

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — CollegeBase` : "CollegeBase";
    return () => { document.title = "CollegeBase"; };
  }, [title]);
}

export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
