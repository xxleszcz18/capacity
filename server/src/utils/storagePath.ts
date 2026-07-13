import fs from 'fs';
import path from 'path';
import { getDatabasePath } from '../db/connection.js';

export function getStorageBaseDir(): string {
  const fromEnv = process.env.STORAGE_BASE_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.dirname(getDatabasePath());
}

export function isDockerDeployment(): boolean {
  if (process.env.DOCKER === '1') return true;
  try {
    return fs.existsSync('/.dockerenv');
  } catch {
    return false;
  }
}

/** Okno wyboru folderu Windows — tylko natywny serwer (nie kontener). */
export function isPickLocationAvailable(): boolean {
  return process.platform === 'win32' && !isDockerDeployment();
}

export function resolveStoragePath(rawDir: string, defaultRelative: string): string {
  const dir = rawDir.trim() || defaultRelative;
  if (/^file:\/\//i.test(dir)) {
    try {
      return path.resolve(decodeURIComponent(new URL(dir).pathname));
    } catch {
      return path.resolve(getStorageBaseDir(), defaultRelative);
    }
  }
  if (path.isAbsolute(dir)) return path.resolve(dir);
  return path.resolve(getStorageBaseDir(), dir);
}

function isPathInsideBase(targetAbs: string, baseAbs: string): boolean {
  const base = path.resolve(baseAbs);
  const target = path.resolve(targetAbs);
  if (target === base) return true;
  const prefix = base.endsWith(path.sep) ? base : base + path.sep;
  return target.startsWith(prefix);
}

export function assertPathWithinStorageBase(targetAbs: string): void {
  if (!isPathInsideBase(targetAbs, getStorageBaseDir())) {
    throw new Error('Ścieżka musi znajdować się w katalogu danych serwera.');
  }
}

export function toStorageSettingValue(absolutePath: string): string {
  const base = getStorageBaseDir();
  const abs = path.resolve(absolutePath);
  const rel = path.relative(base, abs);
  if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
    return rel.split(path.sep).join('/');
  }
  return abs.split(path.sep).join(path.sep === '\\' ? '\\' : '/');
}

export type StoragePathCheck = {
  absolute_path: string;
  exists: boolean;
  writable: boolean;
  setting_value: string;
};

export function checkStoragePath(rawDir: string, defaultRelative: string): StoragePathCheck {
  const absolute_path = resolveStoragePath(rawDir, defaultRelative);
  assertPathWithinStorageBase(absolute_path);
  let exists = false;
  let writable = false;
  try {
    fs.mkdirSync(absolute_path, { recursive: true });
    exists = fs.existsSync(absolute_path);
    fs.accessSync(absolute_path, fs.constants.W_OK);
    writable = true;
  } catch {
    writable = false;
  }
  return {
    absolute_path,
    exists,
    writable,
    setting_value: toStorageSettingValue(absolute_path),
  };
}

export type StorageBrowseEntry = {
  name: string;
  path: string;
  setting_value: string;
};

export type StorageBrowseResult = {
  current_path: string;
  setting_value: string;
  parent_path: string | null;
  parent_setting_value: string | null;
  entries: StorageBrowseEntry[];
};

export function browseStorageDirectory(requestedPath: string | undefined, defaultRelative: string): StorageBrowseResult {
  const base = getStorageBaseDir();
  const current = requestedPath?.trim()
    ? resolveStoragePath(requestedPath, defaultRelative)
    : path.resolve(base);
  assertPathWithinStorageBase(current);

  let stat: fs.Stats;
  try {
    stat = fs.statSync(current);
  } catch {
    throw new Error('Katalog nie istnieje.');
  }
  if (!stat.isDirectory()) {
    throw new Error('Wskazana ścieżka nie jest katalogiem.');
  }

  const parent = path.dirname(current);
  const hasParent = isPathInsideBase(parent, base) && path.resolve(parent) !== path.resolve(current);

  let entries: StorageBrowseEntry[] = [];
  try {
    entries = fs
      .readdirSync(current, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => {
        const full = path.join(current, d.name);
        return {
          name: d.name,
          path: full,
          setting_value: toStorageSettingValue(full),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  } catch {
    entries = [];
  }

  return {
    current_path: current,
    setting_value: toStorageSettingValue(current),
    parent_path: hasParent ? parent : null,
    parent_setting_value: hasParent ? toStorageSettingValue(parent) : null,
    entries,
  };
}

export function getStorageInfo() {
  const base = getStorageBaseDir();
  return {
    pick_location_available: isPickLocationAvailable(),
    is_docker: isDockerDeployment(),
    storage_base_dir: base,
    suggested_backup_dir: 'backups',
    suggested_attachments_dir: 'attachments',
  };
}
