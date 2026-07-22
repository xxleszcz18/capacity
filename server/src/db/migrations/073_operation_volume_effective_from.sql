-- Alokacja od miesiąca/tygodnia: wolumen „przed” i „od” wskazanego okresu w roku.
ALTER TABLE operation_volume_by_year ADD COLUMN volume_value_before REAL;
ALTER TABLE operation_volume_by_year ADD COLUMN effective_from_month INTEGER;
ALTER TABLE operation_volume_by_year ADD COLUMN effective_from_week INTEGER;
