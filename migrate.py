"""
Build the CollegeBase SQLite database from profiles.jsonl.

Runs the logic.py pipeline, recreates collegebase.db from schema.sql, and
inserts every processed profile. Safe to re-run — it rebuilds from scratch.

    python migrate.py
"""

import json
import sqlite3
from pathlib import Path

import pandas as pd

import logic

_DIR = Path(__file__).resolve().parent
PROFILES_JSONL = _DIR / "profiles.jsonl"
SCHEMA_SQL = _DIR / "schema.sql"
DB_PATH = _DIR / "collegebase.db"
OLD_RATINGS_DB = _DIR / "profile_ratings.db"

# List columns are JSON-encoded; bool columns are stored as 0/1.
LIST_COLS = [
    "majors", "race", "awards", "extracurriculars",
    "acceptances", "rejections", "ec_categories", "award_categories",
]
BOOL_COLS = [
    "test_optional", "stem_major",
    "t5_accepted", "t10_accepted", "t20_accepted", "t50_accepted",
]

# Every applicants column, in insert order.
APPLICANT_COLS = [
    "profile_id",
    "gpa_unweighted", "gpa_weighted", "sat", "act", "sat_equivalent",
    "ap_classes", "ib_classes", "college_credit_classes",
    "gender",
    "test_optional", "stem_major",
    "t5_accepted", "t10_accepted", "t20_accepted", "t50_accepted",
    "num_ecs", "num_awards", "num_acceptances", "num_rejections",
    "majors", "race", "awards", "extracurriculars",
    "acceptances", "rejections", "ec_categories", "award_categories",
]


def _clean_scalar(v):
    """NaN -> None, and numpy scalars -> plain Python types."""
    if v is None:
        return None
    if isinstance(v, float) and pd.isna(v):
        return None
    if hasattr(v, "item"):
        return v.item()
    return v


def row_to_tuple(row):
    """Turn one processed DataFrame row into a tuple matching APPLICANT_COLS."""
    out = []
    for col in APPLICANT_COLS:
        val = row.get(col)
        if col in LIST_COLS:
            val = val if isinstance(val, list) else []
            out.append(json.dumps(val, ensure_ascii=False))
        elif col in BOOL_COLS:
            out.append(1 if bool(val) else 0)
        else:
            out.append(_clean_scalar(val))
    return tuple(out)


def build_database():
    print(f"Processing {PROFILES_JSONL} through logic.py ...")
    df = logic.process_file(PROFILES_JSONL)
    df = df.reset_index(drop=True)
    # Sort by content hash so applicant_id 1..N is stable across rebuilds.
    df = df.drop_duplicates(subset="profile_id", keep="first")
    df = df.sort_values("profile_id").reset_index(drop=True)
    print(f"  -> {len(df)} profiles processed (after dedup).")

    if Path(DB_PATH).exists():
        Path(DB_PATH).unlink()
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    print(f"Creating tables from {SCHEMA_SQL} ...")
    conn.executescript(Path(SCHEMA_SQL).read_text())

    placeholders = ", ".join(["?"] * len(APPLICANT_COLS))
    sql = f"INSERT INTO applicants ({', '.join(APPLICANT_COLS)}) VALUES ({placeholders})"
    rows = [row_to_tuple(r) for _, r in df.iterrows()]
    conn.executemany(sql, rows)
    conn.commit()
    print(f"  -> inserted {len(rows)} applicants.")

    note_old_ratings()

    conn.close()
    print(f"Done. Database written to {DB_PATH}")


def note_old_ratings():
    """Old ratings keyed off stale content hashes that no longer match any
    profile, so there's nothing to carry over — just report and move on."""
    if not Path(OLD_RATINGS_DB).exists():
        return
    old = sqlite3.connect(OLD_RATINGS_DB)
    try:
        n = old.execute("SELECT COUNT(*) FROM ratings").fetchone()[0]
        print(f"Note: {n} ratings exist in {OLD_RATINGS_DB} but key off stale content "
              f"hashes and cannot be remapped. Starting ratings fresh on stable IDs.")
    except sqlite3.OperationalError:
        pass
    old.close()


if __name__ == "__main__":
    build_database()
