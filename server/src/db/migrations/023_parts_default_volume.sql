-- W trybie "Własna wartość": wartość domyślna dla wszystkich lat (gdy brak wpisu na dany rok w part_volume_by_year)
ALTER TABLE parts ADD COLUMN default_volume_value REAL;
ALTER TABLE parts ADD COLUMN default_volume_unit TEXT;
