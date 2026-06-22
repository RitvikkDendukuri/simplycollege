const BASE = import.meta.env.VITE_API_URL || "";

async function get(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

function qs(filters) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === null || v === undefined || v === "" || v === false) continue;
    p.append(k, v);
  }
  const s = p.toString();
  return s ? "?" + s : "";
}

export const api = {
  health: () => get("/health"),
  stats: () => get("/stats"),
  filterOptions: () => get("/filters/options"),

  applicants: (filters = {}) => get("/applicants" + qs(filters)),
  applicant: (id) => get(`/applicants/${id}`),

  rate: (applicant_id, rating) => post("/ratings", { applicant_id, rating }),

  similar: (applicant_id, k = 5) =>
    get(`/similar/${applicant_id}?k=${k}`),

  similarCustom: (profile) => post("/similar/custom", profile),

  schools: (filters = {}) => get("/schools" + qs(filters)),
  demographics: (filters = {}) => get("/demographics" + qs(filters)),

  batchApplicants: (ids) => post("/applicants/batch", { ids }),
  archetypes: (view = "detailed", filters = {}) =>
    get("/archetypes" + qs({ view, ...filters })),
};
