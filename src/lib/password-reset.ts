import 'server-only';
import { headers } from 'next/headers';

export const RESET_TOKEN_MINUTES = 60;

/** Which reset routes are switched on, decided by environment variables. */
export function resetConfig() {
  const key = process.env.PASSWORD_RESET_KEY?.trim() ?? '';
  return {
    // Recovery key: a long secret kept in the project settings. Needs at least 16 characters.
    key: key.length >= 16 ? key : '',
    // Emailed link: needs a Resend API key and a verified sender address.
    email: Boolean(process.env.RESEND_API_KEY && process.env.RESET_EMAIL_FROM),
    // Fixed inbox that always receives the link. When empty, the link goes to the tutor's own login email.
    to: process.env.RESET_EMAIL_TO?.trim().toLowerCase() ?? '',
  };
}

export function maskEmail(address: string): string {
  const [name, domain] = address.split('@');
  return name && domain ? `${name[0]}${'*'.repeat(Math.max(2, name.length - 1))}@${domain}` : '';
}

export async function siteOrigin(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  return `${host.startsWith('localhost') ? 'http' : 'https'}://${host}`;
}

export async function sendResetEmail(to: string, link: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: process.env.RESET_EMAIL_FROM,
        to: [to],
        subject: 'Reset your Ezgili Champs password',
        text: `Someone asked to reset the tutor password for Ezgili Champs.\n\nOpen this link within ${RESET_TOKEN_MINUTES} minutes to choose a new password:\n${link}\n\nIf this was not you, ignore this email. Your password stays the same.`,
      }),
    });
    if (!res.ok) console.error('Reset email failed', res.status, await res.text().catch(() => ''));
    return res.ok;
  } catch (error) {
    console.error('Reset email failed', error);
    return false;
  }
}
