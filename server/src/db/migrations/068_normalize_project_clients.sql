-- Ujednolicenie zapisu klientów: wielkie litery (AUDI = Audi).
UPDATE projects SET client = UPPER(TRIM(client)) WHERE client IS NOT NULL AND TRIM(client) <> '';
