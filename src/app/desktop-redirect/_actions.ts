'use server'

import { auth } from '@clerk/nextjs/server'

export async function getDesktopRedirectUrl(): Promise<string> {
  const authResult = await auth()
  if (!authResult.userId) {
    return '/onboard'
  }

  // Generate a session token for the desktop app
  const token = authResult.userId
  const deepLinkUrl = `agentcorp://auth-callback?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(authResult.userId)}&redirect=/workspace`

  return deepLinkUrl
}
