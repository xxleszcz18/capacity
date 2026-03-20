CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client TEXT NOT NULL,
  name TEXT NOT NULL,
  sop TEXT NOT NULL,
  eop TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'RFQ'))
);

CREATE TABLE parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  designation TEXT NOT NULL,
  side TEXT CHECK (side IN ('RH', 'LH', NULL))
);

CREATE TABLE project_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  note_date TEXT NOT NULL DEFAULT (date('now')),
  author TEXT,
  note TEXT NOT NULL
);
