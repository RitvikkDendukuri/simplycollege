-- schema.sql
-- CollegeBase database schema (SQLite).
--
-- Design notes:
--   * One applicant = one row. List-valued fields (majors, acceptances, etc.)
--     are stored as JSON text. SQLite has JSON functions if you ever need to
--     query inside them, but for this dataset the API reads them as whole values.
--   * profile_id is the primary key (the SHA-256 content hash from logic.py).
--   * ratings.profile_id references applicants, and (profile_id) + an auto id
--     lets one profile receive many ratings while still being de-dupable.

PRAGMA foreign_keys = ON;

-- Drop in dependency order so this script is safely re-runnable.
DROP TABLE IF EXISTS ratings;
DROP TABLE IF EXISTS applicants;

CREATE TABLE applicants (
    -- Stable surrogate key: never changes when content is reprocessed.
    -- Ratings attach to this, so they survive a rebuild.
    applicant_id            INTEGER PRIMARY KEY AUTOINCREMENT,
    -- Content hash from logic.py: used for duplicate detection, NOT as the rating key.
    profile_id              TEXT UNIQUE NOT NULL,

    -- Academics (REAL = float; nullable because not every profile reports all)
    gpa_unweighted          REAL,
    gpa_weighted            REAL,
    sat                     REAL,
    act                     REAL,
    sat_equivalent          REAL,
    ap_classes              INTEGER,
    ib_classes              INTEGER,
    college_credit_classes  REAL,

    -- Demographics
    gender                  TEXT,

    -- Derived flags (stored as 0/1)
    test_optional           INTEGER NOT NULL DEFAULT 0,
    stem_major              INTEGER NOT NULL DEFAULT 0,
    t5_accepted             INTEGER NOT NULL DEFAULT 0,
    t10_accepted            INTEGER NOT NULL DEFAULT 0,
    t20_accepted            INTEGER NOT NULL DEFAULT 0,
    t50_accepted            INTEGER NOT NULL DEFAULT 0,

    -- Derived counts
    num_ecs                 INTEGER NOT NULL DEFAULT 0,
    num_awards              INTEGER NOT NULL DEFAULT 0,
    num_acceptances         INTEGER NOT NULL DEFAULT 0,
    num_rejections          INTEGER NOT NULL DEFAULT 0,

    -- List fields stored as JSON text (e.g. '["Asian"]')
    majors                  TEXT NOT NULL DEFAULT '[]',
    race                    TEXT NOT NULL DEFAULT '[]',
    awards                  TEXT NOT NULL DEFAULT '[]',
    extracurriculars        TEXT NOT NULL DEFAULT '[]',
    acceptances             TEXT NOT NULL DEFAULT '[]',
    rejections              TEXT NOT NULL DEFAULT '[]',
    ec_categories           TEXT NOT NULL DEFAULT '[]',
    award_categories        TEXT NOT NULL DEFAULT '[]'
);

-- Helpful indexes for the filter-heavy queries the API will run.
CREATE INDEX idx_applicants_sat_eq   ON applicants(sat_equivalent);
CREATE INDEX idx_applicants_gpa_uw   ON applicants(gpa_unweighted);
CREATE INDEX idx_applicants_stem     ON applicants(stem_major);

CREATE TABLE ratings (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    applicant_id  INTEGER NOT NULL,
    rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 10),
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (applicant_id) REFERENCES applicants(applicant_id)
);

CREATE INDEX idx_ratings_applicant ON ratings(applicant_id);
