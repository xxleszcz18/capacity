import type { Request } from 'express';
import { userLoginLabel, type AuthUserRow } from '../auth/userService.js';
import os from 'os';

export function resolveActor(req: Request): string {
  if (req.user) return userLoginLabel(req.user);
  if (String(process.env.AUTH_LEGACY_ACTOR ?? '0').trim() === '1') {
    const fromHeader = String(req.headers?.['x-user-login'] ?? req.headers?.['x-user'] ?? '').trim();
    if (fromHeader) return fromHeader;
    const envUser = String(process.env.USERNAME ?? process.env.USER ?? '').trim();
    if (envUser) return envUser;
    try {
      return os.userInfo().username || 'system';
    } catch {
      return 'system';
    }
  }
  return req.user ? userLoginLabel(req.user as AuthUserRow) : 'system';
}
