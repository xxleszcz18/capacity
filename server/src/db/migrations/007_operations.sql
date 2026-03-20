-- Volume: store one of annual/monthly/weekly; backend converts using working_days
CREATE TABLE operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  phase_id INTEGER NOT NULL REFERENCES process_phases(id),
  machine_id INTEGER NOT NULL REFERENCES machines(id),
  cycle_time_seconds INTEGER NOT NULL,
  volume_value REAL NOT NULL,
  volume_unit TEXT NOT NULL CHECK (volume_unit IN ('annual', 'monthly', 'weekly')),
  nests_count INTEGER NOT NULL DEFAULT 1,
  oee_override REAL,
  capacity_percent REAL NOT NULL DEFAULT 100 CHECK (capacity_percent > 0 AND capacity_percent <= 100),
  opf INTEGER NOT NULL DEFAULT 0 CHECK (opf IN (0, 1)),
  sap TEXT,
  description TEXT
);
