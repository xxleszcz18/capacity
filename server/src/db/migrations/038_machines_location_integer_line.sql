-- Nr linii (machines.location): tylko liczby całkowite zapisane jako tekst; niepoprawne / puste -> '1'
UPDATE machines
SET location = '1'
WHERE location IS NULL
   OR TRIM(COALESCE(location, '')) = ''
   OR TRIM(location) GLOB '*[^0-9]*';

UPDATE machines
SET location = CAST(CAST(TRIM(location) AS INTEGER) AS TEXT)
WHERE location IS NOT NULL AND TRIM(location) != '';
