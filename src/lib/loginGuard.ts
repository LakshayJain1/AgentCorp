import 'server-only';

import type { NextRequest } from 'next/server';

export const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

/** Reject cross-site form posts: the Origin header must match this deployment's host. */
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false; // browsers always send Origin on fetch POST
  try {
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0] : req.headers.get('x-real-ip') ?? 'unknown').trim().slice(0, 64);
}

/** Lowercase + trim; returns null if it isn't a plausible email. */
export function normalizeEmail(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const e = v.trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}
