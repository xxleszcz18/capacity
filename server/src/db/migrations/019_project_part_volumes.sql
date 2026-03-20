-- Wolumeny na poziomie projektu (per rok; wybór roczny/miesięczny/tygodniowy)
CREATE TABLE IF NOT EXISTS project_volumes (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  volume_value REAL NOT NULL,
  volume_unit TEXT NOT NULL CHECK (volume_unit IN ('annual', 'monthly', 'weekly')),
  PRIMARY KEY (project_id, year)
);

-- Dla każdego detalu: tryb wolumenu (project / share / override)
ALTER TABLE parts ADD COLUMN volume_mode TEXT NOT NULL DEFAULT 'project' CHECK (volume_mode IN ('project', 'share', 'override'));
