-- Pobieranie załączników tylko przez admin_attachments.download.
-- Role bez Podglądu załączników tracą też Pobieranie (stan po wyłączeniu „Załączników”).
-- projects.download nie steruje już załącznikami — usuń z ról.

DELETE FROM role_permissions
WHERE permission_key = 'admin_attachments.download'
  AND role_id NOT IN (
    SELECT role_id FROM role_permissions WHERE permission_key = 'admin_attachments.view'
  );

DELETE FROM role_permissions
WHERE permission_key = 'projects.download';
