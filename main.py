"""
main.py — CollegeBase API (FastAPI).

Run locally:
    pip install fastapi uvicorn scikit-learn
    uvicorn main:app --reload

Then open http://127.0.0.1:8000/docs to click through every endpoint and see
real JSON — no frontend needed to verify the backend works.

Endpoints:
    GET  /health                 -> liveness check
    GET  /applicants             -> filtered, paged list
    GET  /applicants/{id}        -> one applicant + its rating summary
    GET  /stats                  -> summary stats, each rate carries its n
    POST /ratings                -> submit a 1-10 rating for an applicant
    GET  /similar/{id}           -> nearest-neighbour profiles (if sklearn present)

Sample-size honesty: any computed acceptance rate reports the n it was based on,
and is flagged unreliable when n is below MIN_RELIABLE_N.
"""

import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import db

MIN_RELIABLE_N = 15  # below this, a rate is statistically too thin to trust

app = FastAPI(title="CollegeBase API", version="1.0.0")

# Allow the future React dev server to call this API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten to your real domain before going public
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- response models --------------------------------------------------------

class RatingIn(BaseModel):
    applicant_id: int
    rating: int = Field(ge=1, le=10, description="Score from 1 to 10")


class Rate(BaseModel):
    """An acceptance rate that is honest about how many profiles it rests on."""
    rate: Optional[float]      # None when n == 0
    n: int                     # sample size the rate is based on
    reliable: bool             # False when n < MIN_RELIABLE_N


def make_rate(numerator: int, denominator: int) -> Rate:
    if denominator == 0:
        return Rate(rate=None, n=0, reliable=False)
    return Rate(
        rate=round(numerator / denominator, 4),
        n=denominator,
        reliable=denominator >= MIN_RELIABLE_N,
    )


# --- basic endpoints --------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/applicants")
def get_applicants(
    gpa_min: Optional[float] = None,
    gpa_max: Optional[float] = None,
    sat_min: Optional[float] = None,
    sat_max: Optional[float] = None,
    stem_only: bool = False,
    test_optional_only: bool = False,
    accepted_tier: Optional[str] = Query(None, pattern="^(t5|t10|t20|t50)$"),
    major: Optional[str] = None,
    race: Optional[str] = None,
    race_group: Optional[str] = None,
    gender: Optional[str] = None,
    accepted_at: Optional[str] = None,
    ec_category: Optional[str] = None,
    award_category: Optional[str] = None,
    submitted_scores_only: bool = False,
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    filters = {
        "gpa_min": gpa_min, "gpa_max": gpa_max,
        "sat_min": sat_min, "sat_max": sat_max,
        "stem_only": stem_only, "test_optional_only": test_optional_only,
        "submitted_scores_only": submitted_scores_only,
        "accepted_tier": accepted_tier, "major": major,
        "race": race, "gender": gender, "accepted_at": accepted_at,
        "ec_category": ec_category, "award_category": award_category,
        "limit": limit, "offset": offset,
    }
    results = db.list_applicants(filters)

    if race_group:
        results = [
            r for r in results
            if any(_normalize_race(rc) == race_group for rc in (r.get("race") or []))
        ]

    return {"count": len(results), "applicants": results}


@app.get("/applicants/{applicant_id}")
def get_one(applicant_id: int):
    applicant = db.get_applicant(applicant_id)
    if applicant is None:
        raise HTTPException(status_code=404, detail="Applicant not found")
    applicant["ratings"] = db.get_rating_summary(applicant_id)
    return applicant


@app.post("/ratings")
def post_rating(payload: RatingIn):
    try:
        new_id = db.add_rating(payload.applicant_id, payload.rating)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {
        "id": new_id,
        "summary": db.get_rating_summary(payload.applicant_id),
    }


# --- filter options ---------------------------------------------------------

@app.get("/filters/options")
def filter_options():
    rows = db.get_all_applicants()
    majors = set()
    races = set()
    genders = set()
    ec_cats = set()
    award_cats = set()
    schools = set()
    for r in rows:
        for m in (r.get("majors") or []):
            majors.add(m)
        for rc in (r.get("race") or []):
            races.add(rc)
        if r.get("gender"):
            genders.add(r["gender"])
        for ec in (r.get("ec_categories") or []):
            ec_cats.add(ec)
        for aw in (r.get("award_categories") or []):
            award_cats.add(aw)
        for s in (r.get("acceptances") or []):
            schools.add(s)
    return {
        "majors": sorted(majors),
        "races": sorted(races),
        "genders": sorted(genders),
        "ec_categories": sorted(ec_cats),
        "award_categories": sorted(award_cats),
        "schools": sorted(schools),
    }


# --- stats (sample-size aware) ----------------------------------------------

@app.get("/stats")
def stats():
    rows = db.get_all_applicants()
    total = len(rows)

    def acc_rate(predicate, tier_key):
        """Of applicants matching `predicate`, how many were accepted to `tier`?"""
        pool = [r for r in rows if predicate(r)]
        accepted = sum(1 for r in pool if r[tier_key])
        return make_rate(accepted, len(pool))

    overall = {
        "total_profiles": total,
        "mean_gpa_unweighted": _mean(rows, "gpa_unweighted"),
        "mean_sat_equivalent": _mean(rows, "sat_equivalent"),
        "stem_share": make_rate(sum(1 for r in rows if r["stem_major"]), total),
        "test_optional_share": make_rate(
            sum(1 for r in rows if r["test_optional"]), total
        ),
    }

    # Acceptance rate into each tier, split by STEM vs non-STEM, each with its n.
    by_tier = {}
    for tier in ("t5_accepted", "t10_accepted", "t20_accepted", "t50_accepted"):
        by_tier[tier] = {
            "all": acc_rate(lambda r: True, tier),
            "stem": acc_rate(lambda r: r["stem_major"], tier),
            "non_stem": acc_rate(lambda r: not r["stem_major"], tier),
        }

    return {"overall": overall, "acceptance_rates": by_tier,
            "reliability_threshold": MIN_RELIABLE_N}


def _mean(rows, col):
    vals = [r[col] for r in rows if r.get(col) is not None]
    return round(sum(vals) / len(vals), 2) if vals else None


# --- similarity (optional, needs scikit-learn) ------------------------------

@app.get("/similar/{applicant_id}")
def similar(applicant_id: int, k: int = Query(5, ge=1, le=20)):
    try:
        from sklearn.neighbors import NearestNeighbors
        from sklearn.preprocessing import StandardScaler
        import numpy as np
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="scikit-learn not installed; similarity search unavailable.",
        )

    target = db.get_applicant(applicant_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Applicant not found")

    rows = db.get_all_applicants()
    # numeric feature space; profiles missing a value are skipped to keep it simple
    feats = ["gpa_unweighted", "sat_equivalent", "num_ecs", "num_awards"]
    usable = [r for r in rows if all(r.get(f) is not None for f in feats)]
    if target.get("sat_equivalent") is None or target.get("gpa_unweighted") is None:
        raise HTTPException(
            status_code=422,
            detail="Target applicant lacks the numeric fields needed for similarity.",
        )

    ids = [r["applicant_id"] for r in usable]
    X = np.array([[r[f] for f in feats] for r in usable], dtype=float)
    Xs = StandardScaler().fit_transform(X)

    target_idx = ids.index(applicant_id)
    n_neighbors = min(k + 1, len(usable))   # +1 because the target matches itself
    nn = NearestNeighbors(n_neighbors=n_neighbors).fit(Xs)
    _, idxs = nn.kneighbors([Xs[target_idx]])

    neighbor_ids = [ids[i] for i in idxs[0] if ids[i] != applicant_id][:k]
    neighbors = [db.get_applicant(i) for i in neighbor_ids]
    return {"applicant_id": applicant_id, "neighbors": neighbors}


# --- shared filter helper ---------------------------------------------------

def _get_filtered_rows(
    gpa_min=None, gpa_max=None, sat_min=None, sat_max=None,
    stem_only=False, test_optional_only=False, submitted_scores_only=False,
    accepted_tier=None, major=None, race=None, race_group=None,
    gender=None, accepted_at=None, ec_category=None, award_category=None,
    **_ignored,
):
    filters = {
        "gpa_min": gpa_min, "gpa_max": gpa_max,
        "sat_min": sat_min, "sat_max": sat_max,
        "stem_only": stem_only, "test_optional_only": test_optional_only,
        "submitted_scores_only": submitted_scores_only,
        "accepted_tier": accepted_tier, "major": major,
        "race": race, "gender": gender, "accepted_at": accepted_at,
        "ec_category": ec_category, "award_category": award_category,
        "limit": 10000, "offset": 0,
    }
    results = db.list_applicants(filters)
    if race_group:
        results = [
            r for r in results
            if any(_normalize_race(rc) == race_group for rc in (r.get("race") or []))
        ]
    return results


# --- school-specific stats --------------------------------------------------

@app.get("/schools")
def school_stats(
    gpa_min: Optional[float] = None, gpa_max: Optional[float] = None,
    sat_min: Optional[float] = None, sat_max: Optional[float] = None,
    stem_only: bool = False, test_optional_only: bool = False,
    submitted_scores_only: bool = False,
    accepted_tier: Optional[str] = Query(None, pattern="^(t5|t10|t20|t50)$"),
    major: Optional[str] = None, race: Optional[str] = None,
    race_group: Optional[str] = None, gender: Optional[str] = None,
    accepted_at: Optional[str] = None,
    ec_category: Optional[str] = None, award_category: Optional[str] = None,
):
    rows = _get_filtered_rows(**locals())
    schools = {}
    for r in rows:
        for s in (r.get("acceptances") or []):
            if s not in schools:
                schools[s] = {"accepted": [], "rejected": []}
            schools[s]["accepted"].append(r)
        for s in (r.get("rejections") or []):
            if s not in schools:
                schools[s] = {"accepted": [], "rejected": []}
            schools[s]["rejected"].append(r)

    result = []
    for name, data in sorted(schools.items()):
        acc = data["accepted"]
        rej = data["rejected"]
        total = len(acc) + len(rej)
        result.append({
            "school": name,
            "accepted": len(acc),
            "rejected": len(rej),
            "total": total,
            "accept_rate": round(len(acc) / total, 4) if total else None,
            "reliable": total >= MIN_RELIABLE_N,
            "avg_gpa": _mean(acc, "gpa_unweighted"),
            "avg_sat": _mean(acc, "sat_equivalent"),
            "avg_ecs": _mean(acc, "num_ecs"),
            "avg_awards": _mean(acc, "num_awards"),
            "stem_share": round(
                sum(1 for a in acc if a["stem_major"]) / len(acc), 4
            ) if acc else None,
        })
    return {"schools": result}


# --- demographic breakdowns -------------------------------------------------

def _normalize_race(raw: str) -> Optional[str]:
    low = raw.lower().strip()
    if low in ("n/a", "unknown", "removed", ""):
        return None
    if "caucasian" in low:
        return "White"
    if "native" in low or "indigenous" in low:
        return "Native American"
    if "middle east" in low or "mena" in low or "persian" in low:
        return "Middle Eastern"
    if low in ("mixed", "multiracial", "biracial") or (
        "/" in low and not any(x in low for x in ["mena", "middle east"])
    ):
        return "Multiracial"
    if any(x in low for x in ["hispanic", "latino", "latina", "cuban"]):
        return "Hispanic/Latino"
    if any(x in low for x in ["black", "african"]):
        return "Black"
    if any(x in low for x in [
        "indian", "south asian", "south-asian", "bangladesh", "pakistani",
    ]):
        return "South Asian"
    if any(x in low for x in [
        "asian", "chinese", "korean", "japanese", "taiwanese",
        "vietnamese", "filipino", "east asian", "southeast", "asia",
    ]):
        return "East Asian"
    if any(x in low for x in ["white", "german", "european"]):
        return "White"
    if "jewish" in low:
        return "White"
    return "Other"


@app.get("/demographics")
def demographics(
    gpa_min: Optional[float] = None, gpa_max: Optional[float] = None,
    sat_min: Optional[float] = None, sat_max: Optional[float] = None,
    stem_only: bool = False, test_optional_only: bool = False,
    submitted_scores_only: bool = False,
    accepted_tier: Optional[str] = Query(None, pattern="^(t5|t10|t20|t50)$"),
    major: Optional[str] = None, race: Optional[str] = None,
    race_group: Optional[str] = None, gender: Optional[str] = None,
    accepted_at: Optional[str] = None,
    ec_category: Optional[str] = None, award_category: Optional[str] = None,
):
    rows = _get_filtered_rows(**locals())
    tiers = ["t5_accepted", "t10_accepted", "t20_accepted", "t50_accepted"]

    def breakdown(group_fn, label_name):
        groups = {}
        for r in rows:
            keys = group_fn(r)
            if not isinstance(keys, list):
                keys = [keys]
            for key in keys:
                if key is None:
                    continue
                if key not in groups:
                    groups[key] = []
                groups[key].append(r)
        result = []
        for key, pool in sorted(groups.items()):
            n = len(pool)
            entry = {
                label_name: key,
                "n": n,
                "reliable": n >= MIN_RELIABLE_N,
                "avg_gpa": _mean(pool, "gpa_unweighted"),
                "avg_sat": _mean(pool, "sat_equivalent"),
            }
            for t in tiers:
                accepted = sum(1 for p in pool if p[t])
                entry[t] = round(accepted / n, 4) if n else None
            result.append(entry)
        return result

    def grouped_race(r):
        raw_list = r.get("race") or []
        seen = set()
        out = []
        for raw in raw_list:
            normed = _normalize_race(raw)
            if normed and normed not in seen:
                seen.add(normed)
                out.append(normed)
        return out if out else []

    return {
        "by_race": breakdown(lambda r: r.get("race") or [], "race"),
        "by_race_grouped": breakdown(grouped_race, "race"),
        "by_gender": breakdown(lambda r: r.get("gender") or "Unknown", "gender"),
        "by_test_optional": breakdown(
            lambda r: "Test Optional" if r.get("test_optional") else "Submitted Scores",
            "group",
        ),
    }


class CustomProfile(BaseModel):
    gpa_unweighted: float = Field(ge=0, le=4.0)
    sat_equivalent: float = Field(ge=400, le=1600)
    num_ecs: int = Field(ge=0)
    num_awards: int = Field(ge=0)
    stem_major: bool = False
    k: int = Field(5, ge=1, le=20)


@app.post("/similar/custom")
def similar_custom(profile: CustomProfile):
    try:
        from sklearn.neighbors import NearestNeighbors
        from sklearn.preprocessing import StandardScaler
        import numpy as np
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="scikit-learn not installed; similarity search unavailable.",
        )

    rows = db.get_all_applicants()
    feats = ["gpa_unweighted", "sat_equivalent", "num_ecs", "num_awards"]
    usable = [r for r in rows if all(r.get(f) is not None for f in feats)]
    if not usable:
        raise HTTPException(status_code=404, detail="No usable profiles in database.")

    ids = [r["applicant_id"] for r in usable]
    X = np.array([[r[f] for f in feats] + [int(r.get("stem_major", False))]
                   for r in usable], dtype=float)
    target = np.array([[profile.gpa_unweighted, profile.sat_equivalent,
                        profile.num_ecs, profile.num_awards,
                        int(profile.stem_major)]], dtype=float)

    scaler = StandardScaler().fit(X)
    Xs = scaler.transform(X)
    target_s = scaler.transform(target)

    n_neighbors = min(profile.k, len(usable))
    nn = NearestNeighbors(n_neighbors=n_neighbors).fit(Xs)
    _, idxs = nn.kneighbors(target_s)

    neighbor_ids = [ids[i] for i in idxs[0]]
    neighbors = [db.get_applicant(i) for i in neighbor_ids]
    return {"custom": True, "neighbors": neighbors}


# --- serve the React frontend (built by Vite) --------------------------------

STATIC_DIR = Path(__file__).resolve().parent / "collegebase-frontend" / "dist"

if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="static-assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        file = STATIC_DIR / full_path
        if file.is_file():
            return FileResponse(file)
        return FileResponse(STATIC_DIR / "index.html")
