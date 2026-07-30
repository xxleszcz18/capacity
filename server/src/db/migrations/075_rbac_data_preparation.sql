-- Data preparation module permissions (inherit from admin_ocu where present)
INSERT OR IGNORE INTO role_permissions (role_id, permission_key)
SELECT DISTINCT rp.role_id, 'admin_data_preparation.view'
FROM role_permissions rp
WHERE rp.permission_key = 'admin_ocu.view';

INSERT OR IGNORE INTO role_permissions (role_id, permission_key)
SELECT DISTINCT rp.role_id, 'admin_data_preparation.edit'
FROM role_permissions rp
WHERE rp.permission_key = 'admin_ocu.edit';

-- Admin roles with settings edit also get access
INSERT OR IGNORE INTO role_permissions (role_id, permission_key)
SELECT DISTINCT rp.role_id, 'admin_data_preparation.view'
FROM role_permissions rp
WHERE rp.permission_key IN ('admin_settings.view', 'admin_settings.edit', 'role_management.edit');

INSERT OR IGNORE INTO role_permissions (role_id, permission_key)
SELECT DISTINCT rp.role_id, 'admin_data_preparation.edit'
FROM role_permissions rp
WHERE rp.permission_key IN ('admin_settings.edit', 'role_management.edit');
