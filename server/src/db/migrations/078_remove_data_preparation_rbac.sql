-- Usuń uprawnienia modułu Data preparation (funkcjonalność wycofana).
DELETE FROM role_permissions
WHERE permission_key IN ('admin_data_preparation.view', 'admin_data_preparation.edit');
