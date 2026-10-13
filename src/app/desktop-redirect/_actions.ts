'use server'

import { auth } from '@clerk/nextjs/server'

export async function getDesktopRedirectUrl(): Promise<string> {
  const authResult = await auth()
  if (!authResult.userId) {
    return '/onboard'
  }

  // Use the real Clerk session JWT (not the userId) so the desktop app can
  // inject it as the __session cookie and arrive genuinely authenticated.
  const token = await authResult.getToken()
  if (!token) {
    return '/onboard'
  }
  const deepLinkUrl = `agentcorp://auth-callback?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(authResult.userId)}&redirect=/workspace`

  return deepLinkUrl
}
