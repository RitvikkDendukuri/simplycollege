# CollegeBase API — uvicorn main:app --reload, then hit /docs

import os
import time
from collections import defaultdict
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import db

MIN_RELIABLE_N = 15

_rate_buckets = defaultdict(list)
RATE_LIMIT = 30
RATE_WINDOW = 60

def _check_rate_limit(client_ip: str):
    now = time.time()
    bucket = _rate_buckets[client_ip]
    _rate_buckets[client_ip] = [t for t in bucket if now - t < RATE_WINDOW]
    if len(_rate_buckets[client_ip]) >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many ratings. Try again later.")
    _rate_buckets[client_ip].append(now)

app = FastAPI(title="CollegeBase API", version="1.0.0")

ALLOWED_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class RatingIn(BaseModel):
    applicant_id: int
    rating: int = Field(ge=1, le=10)


# rate + sample size + Wilson 95% CI
class Rate(BaseModel):
    rate: Optional[float]
    n: int
    reliable: bool
    ci_low: Optional[float]
    ci_high: Optional[float]


def wilson_interval(numerator: int, denominator: int, z: float = 1.96):
    if denominator == 0:
        return None, None
    p = numerator / denominator
    n = denominator
    denom = 1 + z**2 / n
    center = (p + z**2 / (2 * n)) / denom
    margin = (z / denom) * ((p * (1 - p) / n + z**2 / (4 * n**2)) ** 0.5)
    return round(max(0.0, center - margin), 4), round(min(1.0, center + margin), 4)


def make_rate(numerator: int, denominator: int) -> Rate:
    if denominator == 0:
        return Rate(rate=None, n=0, reliable=False, ci_low=None, ci_high=None)
    low, high = wilson_interval(numerator, denominator)
    return Rate(
        rate=round(numerator / denominator, 4),
        n=denominator,
        reliable=denominator >= MIN_RELIABLE_N,
        ci_low=low,
        ci_high=high,
    )


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
def post_rating(payload: RatingIn, request: Request):
    _check_rate_limit(request.client.host if request.client else "unknown")
    try:
        new_id = db.add_rating(payload.applicant_id, payload.rating)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {
        "id": new_id,
        "summary": db.get_rating_summary(payload.applicant_id),
    }


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


@app.get("/stats")
def stats():
    rows = db.get_all_applicants()
    total = len(rows)

    def acc_rate(predicate, tier_key):
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


SIMILAR_COHORT = 25


def _cohort_outcomes(profiles):
    n = len(profiles)
    tiers = {}
    for t in ("t5", "t10", "t20", "t50"):
        accepted = sum(1 for p in profiles if p.get(f"{t}_accepted"))
        tiers[t] = make_rate(accepted, n).model_dump()
    return {"cohort_n": n, "tiers": tiers}


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
    n_neighbors = min(SIMILAR_COHORT + 1, len(usable))
    nn = NearestNeighbors(n_neighbors=n_neighbors).fit(Xs)
    _, idxs = nn.kneighbors([Xs[target_idx]])

    cohort = [usable[i] for i in idxs[0] if ids[i] != applicant_id]
    return {
        "applicant_id": applicant_id,
        "neighbors": cohort[:k],
        "outcomes": _cohort_outcomes(cohort),
    }


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
        ci_low, ci_high = wilson_interval(len(acc), total)
        result.append({
            "school": name,
            "accepted": len(acc),
            "rejected": len(rej),
            "total": total,
            "accept_rate": round(len(acc) / total, 4) if total else None,
            "ci_low": ci_low,
            "ci_high": ci_high,
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
                low, high = wilson_interval(accepted, n)
                entry[f"{t}_ci"] = [low, high]
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


class BatchIds(BaseModel):
    ids: list[int]

@app.post("/applicants/batch")
def batch_applicants(payload: BatchIds):
    results = []
    for aid in payload.ids[:50]:
        a = db.get_applicant(aid)
        if a:
            a["ratings"] = db.get_rating_summary(aid)
            results.append(a)
    return {"applicants": results}


# normalize so 10 ECs ≈ 5 awards ≈ 4.0 GPA ≈ 1600 SAT
def _normalize_profile(r):
    return {
        "gpa": (r.get("gpa_unweighted") or 0) / 4.0,
        "sat": (r.get("sat_equivalent") or 0) / 1600,
        "ecs": (r.get("num_ecs") or 0) / 10,
        "awards": (r.get("num_awards") or 0) / 5,
    }

def _classify_profile(r):
    n = _normalize_profile(r)
    scores = [("GPA-Focused", n["gpa"]), ("SAT-Focused", n["sat"]),
              ("EC-Focused", n["ecs"]), ("Award-Focused", n["awards"])]
    vals = [s[1] for s in scores]
    top = max(vals)
    if top == 0:
        return "Well-Balanced"
    spread = top - min(vals)
    avg = sum(vals) / 4
    if avg > 0 and spread / avg < 0.35:
        return "Well-Balanced"
    return max(scores, key=lambda s: s[1])[0]

def _build_group(label, members):
    n = len(members)
    if n == 0:
        return None
    top_ecs, top_awards, top_majors = {}, {}, {}
    for m in members:
        for ec in (m.get("ec_categories") or []):
            top_ecs[ec] = top_ecs.get(ec, 0) + 1
        for aw in (m.get("award_categories") or []):
            top_awards[aw] = top_awards.get(aw, 0) + 1
        for maj in (m.get("majors") or []):
            top_majors[maj] = top_majors.get(maj, 0) + 1
    return {
        "label": label,
        "n": n,
        "reliable": n >= MIN_RELIABLE_N,
        "avg_gpa": _mean(members, "gpa_unweighted"),
        "avg_sat": _mean(members, "sat_equivalent"),
        "avg_ecs": _mean(members, "num_ecs"),
        "avg_awards": _mean(members, "num_awards"),
        "stem_pct": round(sum(1 for m in members if m["stem_major"]) / n, 4),
        "t5_rate": round(sum(1 for m in members if m["t5_accepted"]) / n, 4),
        "t20_rate": round(sum(1 for m in members if m["t20_accepted"]) / n, 4),
        "top_ecs": sorted(top_ecs.items(), key=lambda x: -x[1])[:5],
        "top_awards": sorted(top_awards.items(), key=lambda x: -x[1])[:5],
        "top_majors": sorted(top_majors.items(), key=lambda x: -x[1])[:5],
        "member_ids": [m["applicant_id"] for m in members],
        "members": [
            {
                "applicant_id": m["applicant_id"],
                "gpa_unweighted": m.get("gpa_unweighted"),
                "sat_equivalent": m.get("sat_equivalent"),
                "num_ecs": m.get("num_ecs"),
                "num_awards": m.get("num_awards"),
                "majors": m.get("majors") or [],
                "t5_accepted": m.get("t5_accepted"),
                "t20_accepted": m.get("t20_accepted"),
            }
            for m in members
        ],
    }

@app.get("/archetypes")
def archetypes(
    view: str = Query("detailed", pattern="^(detailed|grouped)$"),
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
    feats = ["gpa_unweighted", "sat_equivalent", "num_ecs", "num_awards"]
    usable = [r for r in rows if all(r.get(f) is not None for f in feats)]

    if view == "grouped":
        def academic_bucket(r):
            n = _normalize_profile(r)
            avg = (n["gpa"] + n["sat"]) / 2
            if avg >= 0.93: return "Elite academics (GPA 3.9+ / SAT 1500+)"
            if avg >= 0.87: return "Strong academics (GPA 3.7+ / SAT 1400+)"
            if avg >= 0.8: return "Solid academics (GPA 3.4+ / SAT 1300+)"
            return "Developing academics"

        def activity_bucket(r):
            n = _normalize_profile(r)
            avg = (n["ecs"] + n["awards"]) / 2
            if avg >= 0.8: return "Highly active (8+ ECs / 4+ awards)"
            if avg >= 0.5: return "Active (5+ ECs / 2+ awards)"
            if avg >= 0.25: return "Moderate activity"
            return "Light activity"

        acad_groups, act_groups = {}, {}
        for r in usable:
            ab = academic_bucket(r)
            acad_groups.setdefault(ab, []).append(r)
            actb = activity_bucket(r)
            act_groups.setdefault(actb, []).append(r)

        acad_order = ["Elite academics (GPA 3.9+ / SAT 1500+)",
                      "Strong academics (GPA 3.7+ / SAT 1400+)",
                      "Solid academics (GPA 3.4+ / SAT 1300+)",
                      "Developing academics"]
        act_order = ["Highly active (8+ ECs / 4+ awards)",
                     "Active (5+ ECs / 2+ awards)",
                     "Moderate activity", "Light activity"]

        return {
            "view": "grouped",
            "by_academics": [_build_group(k, acad_groups.get(k, [])) for k in acad_order if acad_groups.get(k)],
            "by_activity": [_build_group(k, act_groups.get(k, [])) for k in act_order if act_groups.get(k)],
            "total_profiles": len(usable),
        }

    buckets = {}
    for r in usable:
        label = _classify_profile(r)
        buckets.setdefault(label, []).append(r)

    order = ["GPA-Focused", "SAT-Focused", "EC-Focused", "Award-Focused", "Well-Balanced"]
    clusters = [_build_group(label, buckets.get(label, [])) for label in order if buckets.get(label)]

    return {"view": "detailed", "clusters": clusters, "total_profiles": len(usable)}


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

    X = np.array([[r[f] for f in feats] + [int(r.get("stem_major", False))]
                   for r in usable], dtype=float)
    target = np.array([[profile.gpa_unweighted, profile.sat_equivalent,
                        profile.num_ecs, profile.num_awards,
                        int(profile.stem_major)]], dtype=float)

    scaler = StandardScaler().fit(X)
    Xs = scaler.transform(X)
    target_s = scaler.transform(target)

    n_neighbors = min(SIMILAR_COHORT, len(usable))
    nn = NearestNeighbors(n_neighbors=n_neighbors).fit(Xs)
    _, idxs = nn.kneighbors(target_s)

    cohort = [usable[i] for i in idxs[0]]
    return {
        "custom": True,
        "neighbors": cohort[:profile.k],
        "outcomes": _cohort_outcomes(cohort),
    }


STATIC_DIR = Path(__file__).resolve().parent / "collegebase-frontend" / "dist"


@app.head("/{full_path:path}")
@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    if not STATIC_DIR.is_dir():
        return {"error": "Frontend not built. Run: cd collegebase-frontend && npm run build"}
    file = STATIC_DIR / full_path
    if file.is_file() and ".." not in full_path:
        return FileResponse(file)
    return FileResponse(STATIC_DIR / "index.html")
