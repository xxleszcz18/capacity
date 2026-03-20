-- Wolumen operacji per rok (opcjonalny override; brak wpisu = używany volume_value/volume_unit z operacji)
CREATE TABLE IF NOT EXISTS operation_volume_by_year (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id INTEGER NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  volume_value REAL NOT NULL,
  volume_unit TEXT NOT NULL CHECK (volume_unit IN ('annual', 'monthly', 'weekly')),
  UNIQUE(operation_id, year)
);
