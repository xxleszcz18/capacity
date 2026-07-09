import crypto from 'crypto';
import type { Response } from 'express';
import { db } from '../db/connection.js';

export const SESSION_COOKIE_NAME = 'capacity_session';
const SESSION_TTL_DAYS = 14;

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function sessionExpiresAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_TTL_DAYS);
  return d.toISOString();
}

export function createSession(userId: number, ip?: string, userAgent?: string): string {
  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  db.prepare(
    `INSERT INTO sessions (user_id, is_guest, token_hash, expires_at, ip_address, user_agent) VALUES (?, 0, ?, ?, ?, ?)`
  ).run(userId, tokenHash, sessionExpiresAt(), ip ?? null, userAgent ?? null);
  return token;
}

export function createGuestSession(ip?: string, userAgent?: string): string {
  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  db.prepare(
    `INSERT INTO sessions (user_id, is_guest, token_hash, expires_at, ip_address, user_agent) VALUES (NULL, 1, ?, ?, ?, ?)`
  ).run(tokenHash, sessionExpiresAt(), ip ?? null, userAgent ?? null);
  return token;
}

export function revokeSession(token: string): void {
  const tokenHash = hashToken(token);
  db.prepare(`UPDATE sessions SET revoked_at = datetime('now') WHERE token_hash = ? AND revoked_at IS NULL`).run(tokenHash);
}

export function revokeAllUserSessions(userId: number, exceptTokenHash?: string): void {
  if (exceptTokenHash) {
    db.prepare(
      `UPDATE sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL AND token_hash != ?`
    ).run(userId, exceptTokenHash);
  } else {
    db.prepare(`UPDATE sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL`).run(userId);
  }
}

export type SessionInfo = { userId: number | null; isGuest: boolean };

export function findSessionInfo(token: string): SessionInfo | null {
  const tokenHash = hashToken(token);
  const row = db
    .prepare(
      `SELECT user_id, is_guest FROM sessions
       WHERE token_hash = ? AND revoked_at IS NULL AND datetime(expires_at) > datetime('now')`
    )
    .get(tokenHash) as { user_id: number | null; is_guest: number } | undefined;
  if (!row) return null;
  return { userId: row.user_id != null ? Number(row.user_id) : null, isGuest: row.is_guest === 1 };
}

/** @deprecated Use findSessionInfo */
export function findSessionUserId(token: string): number | null {
  const info = findSessionInfo(token);
  if (!info || info.isGuest) return null;
  return info.userId;
}

export function setSessionCookie(res: Response, token: string): void {
  const maxAge = SESSION_TTL_DAYS * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === 'production';
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res: Response): void {
  const secure = process.env.NODE_ENV === 'production';
  const parts = [`${SESSION_COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    if (key) out[key] = val;
  }
  return out;
}
