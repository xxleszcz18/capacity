CREATE TABLE machines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  internal_number INTEGER NOT NULL UNIQUE,
  sap_number TEXT,
  type TEXT NOT NULL,
  oee_override REAL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  location TEXT
);
