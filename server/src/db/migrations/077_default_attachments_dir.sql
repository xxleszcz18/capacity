-- Domyślna lokalizacja załączników po wdrożeniu (względem katalogu danych serwera).
UPDATE admin_settings
SET value = 'attachments'
WHERE key = 'project_attachments_output_dir'
  AND (value IS NULL OR TRIM(value) = '');

INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('project_attachments_output_dir', 'attachments');
