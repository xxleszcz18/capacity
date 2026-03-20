-- Typ override wolumenu operacji per rok: manual (użytkownik) lub allocation (podział/scalenie alokacji)
ALTER TABLE operation_volume_by_year ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
