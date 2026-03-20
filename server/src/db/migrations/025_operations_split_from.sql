-- Operacja utworzona przy częściowej alokacji: link do operacji źródłowej (do scalenia wolumenów przy usunięciu)
ALTER TABLE operations ADD COLUMN split_from_operation_id INTEGER REFERENCES operations(id) ON DELETE SET NULL;
