'use server';

import { auth0 } from '@/lib/auth0';

export interface DesktopAuthPayload {
  token: string;
  userId: string;
  deepLinkUrl: string;
}

export async function getDesktopAuthPayload(): Promise<DesktopAuthPayload | null> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) return null;

  // Get the access token — Auth0 issues a proper long-lived JWT (not a 60s cookie).
  const tokenResult = await auth0.getAccessToken();
  const token = tokenResult?.token;
  if (!token) return null;

  const userId = session.user.sub;
  const deepLinkUrl = `agentcorp://auth-callback?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(userId)}&redirect=/workspace`;

  return { token, userId, deepLinkUrl };
}

// Backwards compat alias.
export async function getDesktopRedirectUrl(): Promise<string> {
  const payload = await getDesktopAuthPayload();
  return payload ? payload.deepLinkUrl : '/onboard';
}
