CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('backup_enabled', '0');
INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('backup_frequency_minutes', '1440');
INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('backup_output_dir', 'backups');
