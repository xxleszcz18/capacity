-- RBAC: widoczność OCU / załączników admin, create_rfq, projects.download dla ról z dotychczasowym dostępem do załączników

INSERT OR IGNORE INTO role_permissions (role_id, permission_key)
SELECT DISTINCT rp.role_id, 'admin_ocu.view'
FROM role_permissions rp
WHERE rp.permission_key = 'admin_settings.view';

INSERT OR IGNORE INTO role_permissions (role_id, permission_key)
SELECT DISTINCT rp.role_id, 'admin_ocu.edit'
FROM role_permissions rp
WHERE rp.permission_key = 'admin_settings.edit';

INSERT OR IGNORE INTO role_permissions (role_id, permission_key)
SELECT DISTINCT rp.role_id, 'admin_attachments.view'
FROM role_permissions rp
WHERE rp.permission_key = 'admin_settings.view';

-- Dotąd pobieranie załączników szło na projects.details / projects.edit — zachowaj dostęp
INSERT OR IGNORE INTO role_permissions (role_id, permission_key)
SELECT DISTINCT rp.role_id, 'projects.download'
FROM role_permissions rp
WHERE rp.permission_key IN ('projects.details', 'projects.edit', 'projects.download');
