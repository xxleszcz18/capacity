-- Global settings per year (dni robocze)
CREATE TABLE working_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL UNIQUE,
  working_days_year INTEGER NOT NULL,
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
  oee_factor REAL NOT NULL DEFAULT 0.85,
  shift_time_seconds INTEGER NOT NULL DEFAULT 450,
  startup_shutdown_seconds INTEGER NOT NULL DEFAULT 720,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);
