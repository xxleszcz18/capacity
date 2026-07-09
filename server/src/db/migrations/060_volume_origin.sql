-- Skąd pochodzi wolumen roku: default_all_years (ta sama wartość dla wszystkich lat) vs manual_year (ręczna edycja roku).
ALTER TABLE project_volumes ADD COLUMN volume_origin TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE project_volumes_contract ADD COLUMN volume_origin TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE part_volume_by_year ADD COLUMN volume_origin TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE part_volume_contract_by_year ADD COLUMN volume_origin TEXT NOT NULL DEFAULT 'manual';
