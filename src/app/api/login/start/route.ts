import { NextRequest } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { clientIp, isSameOrigin, normalizeEmail } from '@/lib/loginGuard';
import { rateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/login/start { email } — emails a 6-digit sign-in code.
// Passwordless creates the account on first use, so the response never reveals
// whether an address already had one.
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!email) return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });

  // Brake abuse: don't let anyone use us to spam an inbox or burn the free email quota.
  const ip = clientIp(req);
  if (
    !rateLimit(`otp-start:cooldown:${email}`, 1, 30_000) ||
    !rateLimit(`otp-start:email:${email}`, 4, 10 * 60_000) ||
    !rateLimit(`otp-start:ip:${ip}`, 15, 60 * 60_000)
  ) {
    return Response.json({ error: 'Please wait a moment before requesting another code.' }, { status: 429 });
  }

  try {
    await auth0.passwordless.start({ connection: 'email', email, send: 'code' });
    return Response.json({ ok: true });
  } catch (e) {
    // Log the real reason for us (e.g. connection not enabled for this app); keep the client message generic.
    const err = e as { error?: string; error_description?: string; message?: string };
    console.error('[login/start] failed:', err.error ?? '', err.error_description ?? err.message ?? '');
    return Response.json({ error: "We couldn't send a code right now. Please try again." }, { status: 502 });
  }
}
