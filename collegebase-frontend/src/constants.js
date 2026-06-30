export const MIN_RELIABLE_N = 15;

// Reads a CSS custom property off :root so chart fills (set as SVG attributes,
// where var() doesn't resolve) can still follow the active theme.
export function cssVar(name, fallback) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export const TIER_COLORS = {
  t5: "#e4e4ef",
  t10: "#a0a0b8",
  t20: "#6b6b80",
  t50: "#4a4a5a",
};

export const TIER_KEYS = ["t5_accepted", "t10_accepted", "t20_accepted", "t50_accepted"];

export const TIER_LABELS = {
  t5_accepted: "T5",
  t10_accepted: "T10",
  t20_accepted: "T20",
  t50_accepted: "T50",
};

export function wilsonInterval(numerator, denominator, z = 1.96) {
  if (denominator === 0) return [null, null];
  const p = numerator / denominator;
  const n = denominator;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z / denom) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [
    Math.round(Math.max(0, center - margin) * 10000) / 10000,
    Math.round(Math.min(1, center + margin) * 10000) / 10000,
  ];
}

export function makeRate(numerator, denominator) {
  if (denominator === 0) return { rate: null, n: 0, reliable: false, ci_low: null, ci_high: null };
  const [ci_low, ci_high] = wilsonInterval(numerator, denominator);
  return {
    rate: Math.round((numerator / denominator) * 10000) / 10000,
    n: denominator,
    reliable: denominator >= MIN_RELIABLE_N,
    ci_low,
    ci_high,
  };
}
