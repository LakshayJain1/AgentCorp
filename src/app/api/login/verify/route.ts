import { NextRequest } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { clientIp, isSameOrigin, normalizeEmail } from '@/lib/loginGuard';
import { rateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/login/verify { email, code } — checks the 6-digit code and, on success,
// sets the normal Auth0 session cookie (same as any other login).
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  let body: { email?: unknown; code?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  const code = typeof body.code === 'string' ? body.code.replace(/\s+/g, '') : '';
  if (!email || !/^\d{6}$/.test(code)) {
    return Response.json({ error: 'Enter the 6-digit code from your email.' }, { status: 400 });
  }

  // Guessing a 6-digit code must stay impractical: tight per-email and per-IP limits.
  const ip = clientIp(req);
  if (!rateLimit(`otp-verify:email:${email}`, 6, 15 * 60_000) || !rateLimit(`otp-verify:ip:${ip}`, 30, 60 * 60_000)) {
    return Response.json({ error: 'Too many attempts. Request a new code in a few minutes.' }, { status: 429 });
  }

  try {
    await auth0.passwordless.verify({ connection: 'email', email, verificationCode: code });
    return Response.json({ ok: true });
  } catch (e) {
    const err = e as { error?: string; error_description?: string; message?: string };
    console.error('[login/verify] failed:', err.error ?? '', err.error_description ?? err.message ?? '');
    return Response.json({ error: 'That code is invalid or has expired.' }, { status: 401 });
  }
}
