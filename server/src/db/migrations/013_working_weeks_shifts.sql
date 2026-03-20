-- Liczba pracujących tygodni w roku (np. 48) i liczba zmian na dobę (1, 2, 3)
ALTER TABLE working_days ADD COLUMN working_weeks_per_year INTEGER NOT NULL DEFAULT 48;
ALTER TABLE working_days ADD COLUMN shifts_per_day INTEGER NOT NULL DEFAULT 1;
