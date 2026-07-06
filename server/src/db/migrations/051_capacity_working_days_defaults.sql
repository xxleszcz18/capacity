INSERT INTO admin_settings (key, value) VALUES
  ('capacity_default_working_days_year', '252'),
  ('capacity_default_oee_factor', '0.85'),
  ('capacity_default_shift_time_seconds', '450'),
  ('capacity_default_startup_shutdown_seconds', '720'),
  ('capacity_default_working_weeks_per_year', '48'),
  ('capacity_default_shifts_per_day', '3')
ON CONFLICT(key) DO NOTHING;
