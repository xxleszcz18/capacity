CREATE TABLE call_off_comparisons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  source_filename TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE call_off_volumes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comparison_id INTEGER NOT NULL REFERENCES call_off_comparisons(id) ON DELETE CASCADE,
  sap_ref TEXT NOT NULL,
  part_id INTEGER,
  volume_date TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  week INTEGER NOT NULL,
  quantity REAL NOT NULL
);

CREATE INDEX idx_call_off_volumes_comparison ON call_off_volumes(comparison_id);
CREATE INDEX idx_call_off_volumes_part_year ON call_off_volumes(comparison_id, part_id, year);
CREATE INDEX idx_call_off_volumes_sap_year ON call_off_volumes(comparison_id, sap_ref, year);

INSERT OR IGNORE INTO role_permissions (role_id, permission_key)
SELECT role_id, 'call_offs.view' FROM role_permissions WHERE permission_key = 'scenarios.view';
INSERT OR IGNORE INTO role_permissions (role_id, permission_key)
SELECT role_id, 'call_offs.edit' FROM role_permissions WHERE permission_key = 'scenarios.edit';
INSERT OR IGNORE INTO role_permissions (role_id, permission_key)
SELECT role_id, 'call_offs.delete' FROM role_permissions WHERE permission_key = 'scenarios.delete';
INSERT OR IGNORE INTO role_permissions (role_id, permission_key)
SELECT role_id, 'call_offs.download' FROM role_permissions WHERE permission_key = 'scenarios.download';
