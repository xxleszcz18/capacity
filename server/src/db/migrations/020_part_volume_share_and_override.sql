CREATE TABLE IF NOT EXISTS part_volume_by_year (
  part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  volume_value REAL NOT NULL,
  volume_unit TEXT NOT NULL CHECK (volume_unit IN ('annual', 'monthly', 'weekly')),
  PRIMARY KEY (part_id, year)
);

ALTER TABLE parts ADD COLUMN volume_share_percent REAL;
