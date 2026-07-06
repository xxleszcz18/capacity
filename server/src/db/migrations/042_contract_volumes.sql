-- Wolumeny kontraktowe (mirror produkcyjnych): projekt per rok + nadpisania detalu per rok.
CREATE TABLE IF NOT EXISTS project_volumes_contract (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  volume_value REAL NOT NULL,
  volume_unit TEXT NOT NULL CHECK (volume_unit IN ('annual', 'monthly', 'weekly')),
  include_in_calculator_after_eop INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, year)
);

CREATE TABLE IF NOT EXISTS part_volume_contract_by_year (
  part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  volume_value REAL NOT NULL,
  volume_unit TEXT NOT NULL CHECK (volume_unit IN ('annual', 'monthly', 'weekly')),
  PRIMARY KEY (part_id, year)
);
