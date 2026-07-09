import { db } from '../db/connection.js';
import { generateSecureToken, hashToken } from '../auth/session.js';

const DEFAULT_TTL_HOURS = Number(process.env.PASSWORD_RESET_TTL_HOURS ?? 24);

export function resetTokenExpiresAt(): string {
  const d = new Date();
  d.setHours(d.getHours() + DEFAULT_TTL_HOURS);
  return d.toISOString();
}

export function createPasswordResetToken(
  userId: number,
  via: 'email' | 'admin_link' | 'request',
  createdByUserId?: number
): { token: string; expiresAt: string } {
  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  const expiresAt = resetTokenExpiresAt();
  db.prepare(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_by_user_id, via) VALUES (?, ?, ?, ?, ?)`
  ).run(userId, tokenHash, expiresAt, createdByUserId ?? null, via);
  return { token, expiresAt };
}

export function consumePasswordResetToken(token: string): number | null {
  const tokenHash = hashToken(token);
  const row = db
    .prepare(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = ? AND used_at IS NULL AND datetime(expires_at) > datetime('now')`
    )
    .get(tokenHash) as { id: number; user_id: number } | undefined;
  if (!row) return null;
  db.prepare(`UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?`).run(row.id);
  return Number(row.user_id);
}

export function createPasswordResetRequest(userId: number): number {
  const r = db
    .prepare(`INSERT INTO password_reset_requests (user_id, status) VALUES (?, 'pending')`)
    .run(userId);
  return Number(r.lastInsertRowid);
}

export function getAppBaseUrl(): string {
  const row = db.prepare(`SELECT value FROM admin_settings WHERE key = 'app_base_url'`).get() as { value?: string } | undefined;
  const fromDb = String(row?.value ?? '').trim();
  if (fromDb) return fromDb.replace(/\/+$/, '');
  return String(process.env.APP_BASE_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
}

export function buildResetPasswordUrl(token: string): string {
  return `${getAppBaseUrl()}/reset-hasla?token=${encodeURIComponent(token)}`;
}
