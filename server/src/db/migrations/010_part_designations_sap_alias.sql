-- Rozszerzenie detali o Nr SAP, Alias, Free text
ALTER TABLE part_designations ADD COLUMN sap_number TEXT;
ALTER TABLE part_designations ADD COLUMN alias TEXT;
ALTER TABLE part_designations ADD COLUMN free_text TEXT;

-- Powiązanie części projektu z detalami (opcjonalne)
ALTER TABLE parts ADD COLUMN designation_id INTEGER REFERENCES part_designations(id);
