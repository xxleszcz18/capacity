-- Alternatywny wariant czasu cyklu (mniej rentowny) i wybór wersji dla kalkulatora
ALTER TABLE operations ADD COLUMN alt_cycle_time_seconds REAL;
ALTER TABLE operations ADD COLUMN alt_nests_count INTEGER;
ALTER TABLE operations ADD COLUMN alt_oee_override REAL;
ALTER TABLE operations ADD COLUMN alt_comment TEXT;
ALTER TABLE operations ADD COLUMN use_alternative_in_calculator INTEGER NOT NULL DEFAULT 0;
