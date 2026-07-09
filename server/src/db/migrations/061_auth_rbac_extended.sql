-- RBAC: wiele ról na użytkownika, rola gościa (bez logowania), uprawnienie download

ALTER TABLE roles ADD COLUMN login_required INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

INSERT OR IGNORE INTO user_roles (user_id, role_id)
SELECT id, role_id FROM users;

CREATE TABLE IF NOT EXISTS sessions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  is_guest INTEGER NOT NULL DEFAULT 0,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip_address TEXT,
  user_agent TEXT,
  CHECK (is_guest = 1 OR user_id IS NOT NULL)
);

INSERT INTO sessions_new (id, user_id, is_guest, token_hash, expires_at, revoked_at, created_at, ip_address, user_agent)
SELECT id, user_id, 0, token_hash, expires_at, revoked_at, created_at, ip_address, user_agent FROM sessions;

DROP TABLE sessions;
ALTER TABLE sessions_new RENAME TO sessions;

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);

INSERT INTO roles (name, description, is_system, login_required)
SELECT 'Gość', 'Dostęp bez logowania — uprawnienia konfigurowalne w tej roli', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Gość');

INSERT OR IGNORE INTO role_permissions (role_id, permission_key)
SELECT r.id, 'calculator.view'
FROM roles r
WHERE r.name = 'Gość';
