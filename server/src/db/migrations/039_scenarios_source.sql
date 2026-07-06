ALTER TABLE scenarios ADD COLUMN source_scenario_id INTEGER REFERENCES scenarios(id);
ALTER TABLE scenarios ADD COLUMN updated_at TEXT;
