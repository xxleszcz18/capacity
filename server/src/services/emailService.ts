import nodemailer from 'nodemailer';
import { db } from '../db/connection.js';

export type SmtpConfig = {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  from: string;
  secure: boolean;
};

function getSetting(key: string): string {
  const row = db.prepare('SELECT value FROM admin_settings WHERE key = ?').get(key) as { value?: string } | undefined;
  return String(row?.value ?? '').trim();
}

export function loadSmtpConfig(): SmtpConfig {
  return {
    enabled: getSetting('smtp_enabled') === '1',
    host: getSetting('smtp_host'),
    port: Number(getSetting('smtp_port') || 587),
    user: getSetting('smtp_user'),
    from: getSetting('smtp_from'),
    secure: getSetting('smtp_secure') === '1',
  };
}

export function isSmtpReady(): boolean {
  const cfg = loadSmtpConfig();
  const pass = String(process.env.SMTP_PASS ?? '').trim();
  return cfg.enabled && Boolean(cfg.host && cfg.from && (cfg.user ? pass : true));
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const cfg = loadSmtpConfig();
  const pass = String(process.env.SMTP_PASS ?? '').trim();
  if (!cfg.enabled) throw new Error('SMTP jest wyłączone');
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass } : undefined,
  });
  await transporter.sendMail({
    from: cfg.from,
    to,
    subject: 'Capacity — reset hasła',
    text: `Otrzymaliśmy prośbę o reset hasła.\n\nUżyj linku (ważny ograniczony czas):\n${resetUrl}\n\nJeśli to nie Ty — zignoruj tę wiadomość.`,
    html: `<p>Otrzymaliśmy prośbę o reset hasła.</p><p><a href="${resetUrl}">Ustaw nowe hasło</a></p><p>Jeśli to nie Ty — zignoruj tę wiadomość.</p>`,
  });
}
