-- Machine usage: 0..1, step 0.1, default 1. Affects capacity (e.g. 0.5 doubles effective capacity).
ALTER TABLE machines ADD COLUMN machine_usage REAL DEFAULT 1;
