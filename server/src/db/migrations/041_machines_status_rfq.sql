-- Status maszyny RFQ: widoczny w kalkulatorze tylko w scenariuszu (wg powiązań z projektami active/RFQ w snapshotcie), nie w capacity produkcyjnym.
PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

CREATE TABLE machines_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  internal_number INTEGER UNIQUE,
  sap_number TEXT,
  type TEXT NOT NULL,
  oee_override REAL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'RFQ')),
  location TEXT,
  machine_usage REAL DEFAULT 1
);

INSERT INTO machines_new (id, internal_number, sap_number, type, oee_override, status, location, machine_usage)
SELECT id, internal_number, sap_number, type, oee_override, status, location, COALESCE(machine_usage, 1)
FROM machines;

DROP TABLE machines;
ALTER TABLE machines_new RENAME TO machines;

COMMIT;
PRAGMA foreign_keys = ON;
