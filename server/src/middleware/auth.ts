import type { Request, Response, NextFunction } from 'express';
import {
  actionForHttpMethod,
  isStatusOnlyBody,
  type PermissionResource,
} from '../auth/permissions.js';
import { parseCookies, SESSION_COOKIE_NAME, findSessionInfo } from '../auth/session.js';
import {
  getGuestPermissions,
  getPermissionsForUser,
  getUserById,
  guestUserDto,
  userLoginLabel,
  type AuthUserRow,
} from '../auth/userService.js';
import { db } from '../db/connection.js';

export type AuthenticatedUser = AuthUserRow & {
  login: string;
  permissions: string[];
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function isAuthEnforced(): boolean {
  return String(process.env.AUTH_ENFORCE ?? '1').trim() !== '0';
}

function loadUserFromSessionToken(token: string): AuthenticatedUser | null {
  const info = findSessionInfo(token);
  if (!info) return null;

  if (info.isGuest) {
    const permissions = getGuestPermissions();
    if (permissions.length === 0) return null;
    const guest = guestUserDto();
    return { ...guest, login: userLoginLabel(guest), permissions };
  }

  if (!info.userId) return null;
  const user = getUserById(info.userId);
  if (!user || !user.is_active) return null;
  const permissions = getPermissionsForUser(user.id);
  return { ...user, login: userLoginLabel(user), permissions };
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE_NAME];
  if (token) {
    const user = loadUserFromSessionToken(token);
    if (user) req.user = user;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isAuthEnforced()) {
    optionalAuth(req, res, () => next());
    return;
  }
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: 'Wymagane logowanie' });
    return;
  }
  const user = loadUserFromSessionToken(token);
  if (!user) {
    res.status(401).json({ error: 'Sesja wygasła lub jest nieprawidłowa' });
    return;
  }
  req.user = user;
  next();
}

export function requirePermission(permissionKey: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!isAuthEnforced()) {
      next();
      return;
    }
    if (!req.user) {
      res.status(401).json({ error: 'Wymagane logowanie' });
      return;
    }
    if (!req.user.permissions.includes(permissionKey)) {
      res.status(403).json({ error: 'Brak uprawnień' });
      return;
    }
    next();
  };
}

export function requirePermissionForResource(resource: PermissionResource) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!isAuthEnforced()) {
      next();
      return;
    }
    if (!req.user) {
      res.status(401).json({ error: 'Wymagane logowanie' });
      return;
    }

    const custom = resolveResourcePermission(req, resource);
    if (custom) {
      const keys = Array.isArray(custom) ? custom : [custom];
      if (keys.some((k) => req.user!.permissions.includes(k))) {
        next();
        return;
      }
      res.status(403).json({ error: 'Brak uprawnień' });
      return;
    }

    const action = actionForHttpMethod(req.method);
    return requirePermission(`${resource}.${action}`)(req, res, next);
  };
}

function resolveResourcePermission(req: Request, resource: PermissionResource): string | string[] | null {
  const method = req.method.toUpperCase();
  const path = req.path;

  if (resource === 'machines') {
    if (method === 'GET') {
      if (path === '/' || path === '/types') return 'machines.view';
      if (/^\/\d+\/active-project-operation-count$/.test(path)) {
        return ['machines.change_status', 'machines.edit'];
      }
      if (/^\/\d+(\/|$)/.test(path)) return ['machines.details', 'machines.edit'];
    }
    if (method === 'PUT' && /^\/\d+$/.test(path)) {
      return isStatusOnlyBody(req.body) ? ['machines.change_status', 'machines.edit'] : 'machines.edit';
    }
    if (method === 'POST') return 'machines.edit';
    if (method === 'DELETE') return 'machines.delete';
  }

  if (resource === 'projects') {
    if (method === 'GET') {
      if (
        path === '/' ||
        path === '/clients' ||
        path === '/session/actor' ||
        path === '/operations-copy-sources' ||
        path === '/history' ||
        path === '/history/filters'
      ) {
        return 'projects.view';
      }
      if (/\/attachments\/\d+\/download$/.test(path)) return 'admin_attachments.download';
      // create_rfq: podgląd szczegółów (żeby zarządzać RFQ po utworzeniu)
      if (/^\/\d+(\/|$)/.test(path)) return ['projects.details', 'projects.edit', 'projects.create_rfq'];
    }
    if (method === 'PUT' && /^\/\d+$/.test(path)) {
      if (isStatusOnlyBody(req.body)) {
        return ['projects.change_status', 'projects.edit'];
      }
      return ['projects.edit', 'projects.create_rfq'];
    }
    if (method === 'POST' && (path === '/' || path === '')) {
      return ['projects.edit', 'projects.create_rfq'];
    }
    if (method === 'POST') return ['projects.edit', 'projects.create_rfq'];
    if (method === 'PUT' || method === 'PATCH') return ['projects.edit', 'projects.create_rfq'];
    if (method === 'DELETE') return 'projects.delete';
  }

  if (resource === 'admin_settings') {
    if (method === 'GET' && path === '/visual') {
      return ['calculator.view', 'admin_settings.view'];
    }
  }

  if (resource === 'call_offs') {
    if (method === 'GET' && /^\/\d+\/(source-file|unmatched-report)$/.test(path)) {
      return 'call_offs.download';
    }
  }

  if (resource === 'designations') {
    // delete-cascade is POST but must require delete, not edit
    if (method === 'POST' && /\/\d+\/delete-cascade$/.test(path)) return 'designations.delete';
    if (method === 'GET' && /\/\d+\/related-operations$/.test(path)) {
      return ['designations.delete', 'designations.edit'];
    }
  }

  return null;
}

/**
 * Dla użytkowników z projects.create_rfq (bez projects.edit):
 * - tworzenie tylko status=RFQ
 * - mutacje tylko na projektach RFQ
 * - bez DELETE i bez zmiany statusu na non-RFQ
 */
export function enforceProjectMutationScope(req: Request, res: Response, next: NextFunction): void {
  if (!isAuthEnforced()) {
    next();
    return;
  }
  if (!req.user) {
    res.status(401).json({ error: 'Wymagane logowanie' });
    return;
  }
  const perms = req.user.permissions;
  if (perms.includes('projects.edit')) {
    next();
    return;
  }
  if (!perms.includes('projects.create_rfq')) {
    next();
    return;
  }

  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next();
    return;
  }
  if (method === 'DELETE') {
    res.status(403).json({ error: 'Brak uprawnień do usuwania (uprawnienie RFQ nie obejmuje usuwania).' });
    return;
  }

  const path = req.path || '/';
  if (method === 'POST' && (path === '/' || path === '')) {
    const status = req.body?.status === 'RFQ' ? 'RFQ' : req.body?.status === 'inactive' ? 'inactive' : 'active';
    if (status !== 'RFQ') {
      res.status(403).json({ error: 'Możesz tworzyć tylko projekty o statusie RFQ.' });
      return;
    }
    next();
    return;
  }

  const idMatch = path.match(/^\/(\d+)(?:\/|$)/);
  if (!idMatch) {
    next();
    return;
  }
  const projectId = Number(idMatch[1]);
  const project = db.prepare('SELECT status FROM projects WHERE id = ?').get(projectId) as
    | { status: string }
    | undefined;
  if (!project) {
    next();
    return;
  }
  if (project.status !== 'RFQ') {
    res.status(403).json({
      error: 'Przy uprawnieniu „Tworzenie RFQ” możesz edytować tylko projekty o statusie RFQ.',
    });
    return;
  }

  if (method === 'PUT' && /^\/\d+$/.test(path) && req.body && typeof req.body === 'object') {
    const nextStatus = (req.body as { status?: unknown }).status;
    if (nextStatus != null && nextStatus !== 'RFQ') {
      res.status(403).json({ error: 'Nie możesz zmieniać statusu projektu RFQ na inny przy tym uprawnieniu.' });
      return;
    }
  }

  next();
}

export function requireAnyPermission(permissionKeys: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!isAuthEnforced()) {
      next();
      return;
    }
    if (!req.user) {
      res.status(401).json({ error: 'Wymagane logowanie' });
      return;
    }
    if (permissionKeys.some((k) => req.user!.permissions.includes(k))) {
      next();
      return;
    }
    res.status(403).json({ error: 'Brak uprawnień' });
  };
}

export function requireAdminAccess(req: Request, res: Response, next: NextFunction): void {
  const action = actionForHttpMethod(req.method);
  const path = req.path || '';

  if (path.startsWith('/ocu-data')) {
    const key = action === 'view' ? 'admin_ocu.view' : 'admin_ocu.edit';
    return requirePermission(key)(req, res, next);
  }
  if (path.startsWith('/attachments')) {
    return requirePermission('admin_attachments.view')(req, res, next);
  }

  return requireAnyPermission([`admin_settings.${action}`, `admin_database.${action}`])(req, res, next);
}
