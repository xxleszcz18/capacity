-- Pola nadpisania mogą być NULL (puste = wartość z danych podstawowych Capacity / OCU).

CREATE TABLE working_days_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL UNIQUE,
  working_days_year INTEGER,
  working_days_jan INTEGER NOT NULL DEFAULT 0,
  working_days_feb INTEGER NOT NULL DEFAULT 0,
  working_days_mar INTEGER NOT NULL DEFAULT 0,
  working_days_apr INTEGER NOT NULL DEFAULT 0,
  working_days_may INTEGER NOT NULL DEFAULT 0,
  working_days_jun INTEGER NOT NULL DEFAULT 0,
  working_days_jul INTEGER NOT NULL DEFAULT 0,
  working_days_aug INTEGER NOT NULL DEFAULT 0,
  working_days_sep INTEGER NOT NULL DEFAULT 0,
  working_days_oct INTEGER NOT NULL DEFAULT 0,
  working_days_nov INTEGER NOT NULL DEFAULT 0,
  working_days_dec INTEGER NOT NULL DEFAULT 0,
  oee_factor REAL,
  shift_time_seconds INTEGER,
  startup_shutdown_seconds INTEGER,
  working_weeks_per_year INTEGER,
  shifts_per_day INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

INSERT INTO working_days_v2 (
  id, year, working_days_year, working_days_jan, working_days_feb, working_days_mar, working_days_apr,
  working_days_may, working_days_jun, working_days_jul, working_days_aug, working_days_sep, working_days_oct,
  working_days_nov, working_days_dec, oee_factor, shift_time_seconds, startup_shutdown_seconds,
  working_weeks_per_year, shifts_per_day, status
)
SELECT
  id, year, working_days_year, working_days_jan, working_days_feb, working_days_mar, working_days_apr,
  working_days_may, working_days_jun, working_days_jul, working_days_aug, working_days_sep, working_days_oct,
  working_days_nov, working_days_dec, oee_factor, shift_time_seconds, startup_shutdown_seconds,
  working_weeks_per_year, shifts_per_day, status
FROM working_days;

DROP TABLE working_days;
ALTER TABLE working_days_v2 RENAME TO working_days;

CREATE TABLE working_days_ocu_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL UNIQUE,
  working_days_year INTEGER,
  working_days_jan INTEGER NOT NULL DEFAULT 0,
  working_days_feb INTEGER NOT NULL DEFAULT 0,
  working_days_mar INTEGER NOT NULL DEFAULT 0,
  working_days_apr INTEGER NOT NULL DEFAULT 0,
  working_days_may INTEGER NOT NULL DEFAULT 0,
  working_days_jun INTEGER NOT NULL DEFAULT 0,
  working_days_jul INTEGER NOT NULL DEFAULT 0,
  working_days_aug INTEGER NOT NULL DEFAULT 0,
  working_days_sep INTEGER NOT NULL DEFAULT 0,
  working_days_oct INTEGER NOT NULL DEFAULT 0,
  working_days_nov INTEGER NOT NULL DEFAULT 0,
  working_days_dec INTEGER NOT NULL DEFAULT 0,
  oee_factor REAL,
  shift_time_seconds INTEGER,
  startup_shutdown_seconds INTEGER,
  working_weeks_per_year INTEGER,
  shifts_per_day INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

INSERT INTO working_days_ocu_v2 (
  id, year, working_days_year, working_days_jan, working_days_feb, working_days_mar, working_days_apr,
  working_days_may, working_days_jun, working_days_jul, working_days_aug, working_days_sep, working_days_oct,
  working_days_nov, working_days_dec, oee_factor, shift_time_seconds, startup_shutdown_seconds,
  working_weeks_per_year, shifts_per_day, status
)
SELECT
  id, year, working_days_year, working_days_jan, working_days_feb, working_days_mar, working_days_apr,
  working_days_may, working_days_jun, working_days_jul, working_days_aug, working_days_sep, working_days_oct,
  working_days_nov, working_days_dec, oee_factor, shift_time_seconds, startup_shutdown_seconds,
  working_weeks_per_year, shifts_per_day, status
FROM working_days_ocu;

DROP TABLE working_days_ocu;
ALTER TABLE working_days_ocu_v2 RENAME TO working_days_ocu;
