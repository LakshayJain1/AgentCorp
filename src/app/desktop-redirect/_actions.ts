'use server';

import { cookies } from 'next/headers';
import { auth0 } from '@/lib/auth0';

export interface DesktopAuthPayload {
  token: string;
  userId: string;
  deepLinkUrl: string;
  /** Encrypted Auth0 SDK session cookie(s), so the desktop window gets a real web session. */
  sessionCookies: { name: string; value: string }[];
}

export async function getDesktopAuthPayload(): Promise<DesktopAuthPayload | null> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) return null;

  // The access token is optional: the desktop window authenticates with the
  // session cookie below, so a missing audience/refresh token must not block sign-in.
  let token = '';
  try {
    const tokenResult = await auth0.getAccessToken();
    token = tokenResult?.token ?? '';
  } catch {
    token = '';
  }

  const userId = session.user.sub;
  const store = await cookies();
  const sessionCookies = store
    .getAll()
    .filter((c) => /^__session(__\d{1,2})?$/.test(c.name))
    .map((c) => ({ name: c.name, value: c.value }));
  if (sessionCookies.length === 0) return null;

  const deepLinkUrl =
    `agentcorp://auth-callback?userId=${encodeURIComponent(userId)}` +
    `&redirect=${encodeURIComponent('/workspace')}` +
    `&cookies=${encodeURIComponent(JSON.stringify(sessionCookies))}`;

  return { token, userId, deepLinkUrl, sessionCookies };
}

// Backwards compat alias.
export async function getDesktopRedirectUrl(): Promise<string> {
  const payload = await getDesktopAuthPayload();
  return payload ? payload.deepLinkUrl : '/onboard';
}
