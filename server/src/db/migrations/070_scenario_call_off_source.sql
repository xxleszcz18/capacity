ALTER TABLE scenarios ADD COLUMN source_call_off_comparison_id INTEGER REFERENCES call_off_comparisons(id);
