"""
db.py — Data access layer for the CollegeBase API.

ALL SQL lives in this file. The API routes in main.py call these functions and
never touch the database directly. This isolation means that if you later move
from SQLite to Postgres, this is the only file you rewrite.

Rows come back as plain dicts with JSON list-fields already decoded into real
Python lists, so the API layer can hand them straight to the response model.
"""

import json
import sqlite3
from pathlib import Path

DB_PATH = "collegebase.db"

# Columns stored as JSON text that must be decoded back into lists on read.
_LIST_COLS = [
    "majors", "race", "awards", "extracurriculars",
    "acceptances", "rejections", "ec_categories", "award_categories",
]
# Columns stored as 0/1 that should surface as real booleans.
_BOOL_COLS = [
    "test_optional", "stem_major",
    "t5_accepted", "t10_accepted", "t20_accepted", "t50_accepted",
]


def _connect():
    if not Path(DB_PATH).exists():
        raise FileNotFoundError(
            f"{DB_PATH} not found. Run `python migrate.py` first to build it."
        )
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row          # rows behave like dicts
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def _row_to_dict(row):
    """Decode a sqlite Row into a clean dict (lists parsed, bools real)."""
    d = dict(row)
    for col in _LIST_COLS:
        if col in d and isinstance(d[col], str):
            d[col] = json.loads(d[col])
    for col in _BOOL_COLS:
        if col in d and d[col] is not None:
            d[col] = bool(d[col])
    return d


# --- applicants -------------------------------------------------------------

def list_applicants(filters):
    """Return applicants matching the given filters (a dict of optional keys).

    Supported filters (all optional):
        gpa_min, gpa_max          (float, on gpa_unweighted)
        sat_min, sat_max          (float, on sat_equivalent)
        stem_only                 (bool)
        test_optional_only        (bool)
        accepted_tier             ('t5'|'t10'|'t20'|'t50')
        major                     (str, matches if present in majors list)
        limit, offset             (int, for paging)
    """
    where, params = [], []

    if filters.get("gpa_min") is not None:
        where.append("gpa_unweighted >= ?"); params.append(filters["gpa_min"])
    if filters.get("gpa_max") is not None:
        where.append("gpa_unweighted <= ?"); params.append(filters["gpa_max"])
    if filters.get("sat_min") is not None:
        where.append("sat_equivalent >= ?"); params.append(filters["sat_min"])
    if filters.get("sat_max") is not None:
        where.append("sat_equivalent <= ?"); params.append(filters["sat_max"])
    if filters.get("stem_only"):
        where.append("stem_major = 1")
    if filters.get("test_optional_only"):
        where.append("test_optional = 1")

    tier = filters.get("accepted_tier")
    if tier in ("t5", "t10", "t20", "t50"):
        where.append(f"{tier}_accepted = 1")

    if filters.get("submitted_scores_only"):
        where.append("test_optional = 0")

    if filters.get("gender"):
        where.append("gender = ?")
        params.append(filters["gender"])

    # JSON list columns; LIKE is a simple, safe substring match.
    if filters.get("major"):
        where.append("majors LIKE ?")
        params.append(f'%"{filters["major"]}"%')
    if filters.get("race"):
        where.append("race LIKE ?")
        params.append(f'%"{filters["race"]}"%')
    if filters.get("accepted_at"):
        where.append("acceptances LIKE ?")
        params.append(f'%"{filters["accepted_at"]}"%')
    if filters.get("ec_category"):
        where.append("ec_categories LIKE ?")
        params.append(f'%"{filters["ec_category"]}"%')
    if filters.get("award_category"):
        where.append("award_categories LIKE ?")
        params.append(f'%"{filters["award_category"]}"%')

    sql = "SELECT * FROM applicants"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY applicant_id"

    limit = filters.get("limit")
    if limit is not None:
        sql += " LIMIT ?"; params.append(limit)
        offset = filters.get("offset")
        if offset:
            sql += " OFFSET ?"; params.append(offset)

    conn = _connect()
    try:
        rows = conn.execute(sql, params).fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        conn.close()


def get_applicant(applicant_id):
    """Return one applicant by stable id, or None."""
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT * FROM applicants WHERE applicant_id = ?", (applicant_id,)
        ).fetchone()
        return _row_to_dict(row) if row else None
    finally:
        conn.close()


def get_all_applicants():
    """Every applicant, used by stats and similarity. Returns list of dicts."""
    conn = _connect()
    try:
        rows = conn.execute("SELECT * FROM applicants ORDER BY applicant_id").fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        conn.close()


# --- ratings ----------------------------------------------------------------

def add_rating(applicant_id, rating):
    """Insert a rating (1-10) for an applicant. Returns the new rating row id.

    Raises ValueError if the applicant does not exist (so the API can return 404).
    """
    conn = _connect()
    try:
        exists = conn.execute(
            "SELECT 1 FROM applicants WHERE applicant_id = ?", (applicant_id,)
        ).fetchone()
        if not exists:
            raise ValueError(f"applicant_id {applicant_id} does not exist")
        cur = conn.execute(
            "INSERT INTO ratings (applicant_id, rating) VALUES (?, ?)",
            (applicant_id, rating),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def get_rating_summary(applicant_id):
    """Return {'count': n, 'average': x|None} for an applicant's ratings."""
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT COUNT(*) AS c, AVG(rating) AS a FROM ratings WHERE applicant_id = ?",
            (applicant_id,),
        ).fetchone()
        avg = round(row["a"], 2) if row["a"] is not None else None
        return {"count": row["c"], "average": avg}
    finally:
        conn.close()
