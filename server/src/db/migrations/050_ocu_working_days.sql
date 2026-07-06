-- OCU: osobny zestaw ustawień dni roboczych (ta sama struktura co working_days)
CREATE TABLE working_days_ocu (
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
  working_weeks_per_year INTEGER NOT NULL DEFAULT 48,
  shifts_per_day INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

INSERT INTO admin_settings (key, value) VALUES ('ocu_enabled', '0')
ON CONFLICT(key) DO NOTHING;

INSERT INTO admin_settings (key, value) VALUES
  ('ocu_default_working_days_year', '252'),
  ('ocu_default_oee_factor', '0.85'),
  ('ocu_default_shift_time_seconds', '450'),
  ('ocu_default_startup_shutdown_seconds', '720'),
  ('ocu_default_working_weeks_per_year', '48'),
  ('ocu_default_shifts_per_day', '3')
ON CONFLICT(key) DO NOTHING;
