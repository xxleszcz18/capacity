-- Archiwum scenariuszy (NULL = aktywny, data ISO = zarchiwizowany)
ALTER TABLE scenarios ADD COLUMN archived_at TEXT;
