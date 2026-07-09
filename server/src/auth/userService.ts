import { db } from '../db/connection.js';
import { ALL_PERMISSION_KEYS } from './permissions.js';
import { hashPassword } from './password.js';

export type UserRoleRef = { id: number; name: string };

export type AuthUserRow = {
  id: number;
  username: string | null;
  email: string | null;
  display_name: string | null;
  role_id: number;
  role_name: string;
  role_ids: number[];
  role_names: string[];
  is_active: number;
  must_change_password: number;
  is_guest?: number;
};

export function userLoginLabel(u: Pick<AuthUserRow, 'username' | 'email' | 'display_name' | 'id'>): string {
  return String(u.display_name ?? u.username ?? u.email ?? `user#${u.id}`).trim();
}

export function getUserRoles(userId: number): UserRoleRef[] {
  return db
    .prepare(
      `SELECT r.id, r.name
       FROM user_roles ur
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = ?
       ORDER BY r.name`
    )
    .all(userId) as UserRoleRef[];
}

function attachRoles(row: any): AuthUserRow {
  const roles = getUserRoles(Number(row.id));
  const role_ids = roles.map((r) => r.id);
  const role_names = roles.map((r) => r.name);
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    display_name: row.display_name,
    role_id: role_ids[0] ?? Number(row.role_id ?? 0),
    role_name: role_names.length > 0 ? role_names.join(', ') : String(row.role_name ?? ''),
    role_ids,
    role_names,
    is_active: row.is_active,
    must_change_password: row.must_change_password,
    is_guest: 0,
  };
}

export function findUserByLogin(login: string): (AuthUserRow & { password_hash: string }) | null {
  const q = String(login ?? '').trim();
  if (!q) return null;
  const lower = q.toLowerCase();
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.email, u.password_hash, u.display_name, u.role_id, u.is_active, u.must_change_password,
              r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE (LOWER(u.username) = ? OR LOWER(u.email) = ?)
       LIMIT 1`
    )
    .get(lower, lower) as any;
  if (!row) return null;
  return { ...attachRoles(row), password_hash: row.password_hash };
}

export function getUserById(id: number): AuthUserRow | null {
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.email, u.display_name, u.role_id, u.is_active, u.must_change_password,
              r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`
    )
    .get(id) as any;
  if (!row) return null;
  return attachRoles(row);
}

export function getPermissionsForRole(roleId: number): string[] {
  const rows = db
    .prepare('SELECT permission_key FROM role_permissions WHERE role_id = ? ORDER BY permission_key')
    .all(roleId) as { permission_key: string }[];
  return rows.map((r) => r.permission_key);
}

export function getPermissionsForUser(userId: number): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT rp.permission_key
       FROM user_roles ur
       INNER JOIN role_permissions rp ON rp.role_id = ur.role_id
       WHERE ur.user_id = ?
       ORDER BY rp.permission_key`
    )
    .all(userId) as { permission_key: string }[];
  if (rows.length > 0) return rows.map((r) => r.permission_key);
  const user = db.prepare('SELECT role_id FROM users WHERE id = ?').get(userId) as { role_id: number } | undefined;
  if (!user?.role_id) return [];
  return getPermissionsForRole(user.role_id);
}

export function getGuestPermissions(): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT rp.permission_key
       FROM roles r
       INNER JOIN role_permissions rp ON rp.role_id = r.id
       WHERE r.login_required = 0
       ORDER BY rp.permission_key`
    )
    .all() as { permission_key: string }[];
  return rows.map((r) => r.permission_key);
}

export function isGuestLoginAvailable(): boolean {
  const row = db.prepare('SELECT COUNT(*) AS c FROM roles WHERE login_required = 0').get() as { c: number };
  return Number(row.c) > 0 && getGuestPermissions().length > 0;
}

export type AdministratorContact = {
  display_name: string | null;
  email: string | null;
  username: string | null;
  label: string;
  contact: string;
};

export function listAdministratorContacts(): AdministratorContact[] {
  const adminRole = db
    .prepare(`SELECT id FROM roles WHERE TRIM(name) = 'Administrator' COLLATE NOCASE LIMIT 1`)
    .get() as { id: number } | undefined;
  if (!adminRole) return [];

  const rows = db
    .prepare(
      `SELECT DISTINCT u.id, u.display_name, u.email, u.username
       FROM users u
       WHERE u.is_active = 1
         AND (
           u.role_id = ?
           OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = ?)
         )
       ORDER BY LOWER(COALESCE(u.email, u.display_name, u.username, ''))`
    )
    .all(adminRole.id, adminRole.id) as {
    id: number;
    display_name: string | null;
    email: string | null;
    username: string | null;
  }[];

  return rows.map((row) => {
    const email = row.email?.trim() || null;
    const username = row.username?.trim() || null;
    const contact = email || username || userLoginLabel(row);
    return {
      display_name: row.display_name,
      email,
      username,
      label: userLoginLabel(row),
      contact,
    };
  });
}

export function setUserRoles(userId: number, roleIds: number[]): void {
  const unique = [...new Set(roleIds.filter((id) => Number.isFinite(id) && id > 0))];
  db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(userId);
  const ins = db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)');
  for (const roleId of unique) ins.run(userId, roleId);
  const primary = unique[0] ?? null;
  db.prepare(`UPDATE users SET role_id = ?, updated_at = datetime('now') WHERE id = ?`).run(primary, userId);
}

export function setRolePermissions(roleId: number, keys: string[]): void {
  db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(roleId);
  const ins = db.prepare('INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)');
  for (const key of keys) ins.run(roleId, key);
}

export function grantAllPermissionsToRole(roleId: number): void {
  setRolePermissions(roleId, [...ALL_PERMISSION_KEYS]);
}

export function ensureGuestRole(): void {
  let guest = db.prepare(`SELECT id FROM roles WHERE name = 'Gość'`).get() as { id: number } | undefined;
  if (!guest) {
    const r = db
      .prepare(`INSERT INTO roles (name, description, is_system, login_required) VALUES ('Gość', 'Dostęp bez logowania', 1, 0)`)
      .run();
    guest = { id: Number(r.lastInsertRowid) };
  }
  const existing = new Set(getPermissionsForRole(guest.id));
  if (!existing.has('calculator.view')) {
    db.prepare('INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)').run(guest.id, 'calculator.view');
  }
}

export function syncAdministratorPermissions(): void {
  const admin = db.prepare(`SELECT id FROM roles WHERE name = 'Administrator'`).get() as { id: number } | undefined;
  if (!admin) return;
  grantAllPermissionsToRole(admin.id);
}

export async function bootstrapAuthIfEmpty(): Promise<void> {
  ensureGuestRole();
  syncAdministratorPermissions();

  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number };
  if (Number(count.c) > 0) return;

  let adminRoleId = db.prepare(`SELECT id FROM roles WHERE name = 'Administrator'`).get() as { id: number } | undefined;
  if (!adminRoleId) {
    const r = db
      .prepare(`INSERT INTO roles (name, description, is_system, login_required) VALUES ('Administrator', 'Pełny dostęp', 1, 1)`)
      .run();
    adminRoleId = { id: Number(r.lastInsertRowid) };
    grantAllPermissionsToRole(adminRoleId.id);
  }

  const login = String(process.env.BOOTSTRAP_ADMIN_LOGIN ?? 'admin').trim();
  const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'Admin12345');
  const passwordHash = await hashPassword(password);
  const isEmail = login.includes('@');
  const username = isEmail ? null : login;
  const email = isEmail ? login.toLowerCase() : null;

  const r = db
    .prepare(
      `INSERT INTO users (username, email, password_hash, display_name, role_id, is_active, must_change_password)
       VALUES (?, ?, ?, ?, ?, 1, 1)`
    )
    .run(username, email, passwordHash, 'Administrator', adminRoleId.id);
  setUserRoles(Number(r.lastInsertRowid), [adminRoleId.id]);

  console.log(`[auth] Utworzono konto bootstrap (${login}). Zmień hasło po pierwszym logowaniu.`);
}

export function guestUserDto(): AuthUserRow {
  return {
    id: 0,
    username: null,
    email: null,
    display_name: 'Gość',
    role_id: 0,
    role_name: 'Gość',
    role_ids: [],
    role_names: ['Gość'],
    is_active: 1,
    must_change_password: 0,
    is_guest: 1,
  };
}
