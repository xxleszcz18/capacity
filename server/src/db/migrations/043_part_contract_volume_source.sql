-- Osobne źródło wolumenu kontraktowego dla detalu (jak produkcja: z projektu / udział / własna wartość).
ALTER TABLE parts ADD COLUMN contract_volume_mode TEXT NOT NULL DEFAULT 'project';
ALTER TABLE parts ADD COLUMN contract_volume_share_percent REAL;
ALTER TABLE parts ADD COLUMN contract_default_volume_value REAL;
ALTER TABLE parts ADD COLUMN contract_default_volume_unit TEXT;

CREATE TABLE IF NOT EXISTS part_volume_contract_share_by_year (
  part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  share_percent REAL NOT NULL,
  PRIMARY KEY (part_id, year)
);

-- Zachowanie po migracji: skopiuj dotychczasowe ustawienia produkcyjne jako punkt wyjścia dla kontraktu.
UPDATE parts SET contract_volume_mode = COALESCE(volume_mode, 'project');

INSERT OR REPLACE INTO part_volume_contract_share_by_year (part_id, year, share_percent)
SELECT part_id, year, share_percent FROM part_volume_share_by_year;

UPDATE parts SET contract_volume_share_percent = volume_share_percent WHERE contract_volume_share_percent IS NULL;

UPDATE parts SET contract_default_volume_value = default_volume_value, contract_default_volume_unit = default_volume_unit
WHERE contract_default_volume_value IS NULL AND contract_default_volume_unit IS NULL
  AND default_volume_value IS NOT NULL AND default_volume_unit IS NOT NULL;
