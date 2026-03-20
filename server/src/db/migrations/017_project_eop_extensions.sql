-- Historia przedłużeń EOP (data poprzednia → data nowa, przy każdym przedłużeniu)
CREATE TABLE IF NOT EXISTS project_eop_extensions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  eop_before TEXT NOT NULL,
  eop_after TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (date('now'))
);
