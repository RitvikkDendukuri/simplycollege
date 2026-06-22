# db.py — all SQL lives here, rest of the app talks through these functions

import json
import sqlite3
from pathlib import Path

DB_PATH = "collegebase.db"

_LIST_COLS = [
    "majors", "race", "awards", "extracurriculars",
    "acceptances", "rejections", "ec_categories", "award_categories",
]
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
    d = dict(row)
    for col in _LIST_COLS:
        if col in d and isinstance(d[col], str):
            d[col] = json.loads(d[col])
    for col in _BOOL_COLS:
        if col in d and d[col] is not None:
            d[col] = bool(d[col])
    return d


def list_applicants(filters):
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

    def _escape_like(s):
        return s.replace("%", "\\%").replace("_", "\\_")

    for key, col in [("major", "majors"), ("race", "race"),
                     ("accepted_at", "acceptances"),
                     ("ec_category", "ec_categories"),
                     ("award_category", "award_categories")]:
        if filters.get(key):
            where.append(f'{col} LIKE ? ESCAPE "\\"')
            params.append(f'%"{_escape_like(filters[key])}"%')

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
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT * FROM applicants WHERE applicant_id = ?", (applicant_id,)
        ).fetchone()
        return _row_to_dict(row) if row else None
    finally:
        conn.close()


def get_all_applicants():
    conn = _connect()
    try:
        rows = conn.execute("SELECT * FROM applicants ORDER BY applicant_id").fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        conn.close()


def add_rating(applicant_id, rating):
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
