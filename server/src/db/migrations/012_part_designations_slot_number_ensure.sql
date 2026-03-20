-- Upewnij się, że kolumna slot_number istnieje (jeśli 011 nie została zapisana)
ALTER TABLE part_designations ADD COLUMN slot_number TEXT;
