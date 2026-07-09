import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 10;

export function validatePasswordStrength(password: string): string | null {
  const p = String(password ?? '');
  if (p.length < MIN_PASSWORD_LENGTH) {
    return `Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków`;
  }
  if (!/[a-zA-Z]/.test(p) || !/[0-9]/.test(p)) {
    return 'Hasło musi zawierać litery i cyfry';
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (!passwordHash) return false;
  return bcrypt.compare(password, passwordHash);
}
