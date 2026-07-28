-- Pobieranie załączników projektów: admin_attachments.download (nie projects.download)

INSERT OR IGNORE INTO role_permissions (role_id, permission_key)
SELECT DISTINCT rp.role_id, 'admin_attachments.download'
FROM role_permissions rp
WHERE rp.permission_key = 'projects.download';
