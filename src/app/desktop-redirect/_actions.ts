'use server'

import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'

export async function getDesktopRedirectUrl(): Promise<string> {
  const authResult = await auth()
  if (!authResult.userId) {
    return '/onboard'
  }

  // Read the actual __session cookie from the request headers.
  // This is the long-lived session token Clerk manages — NOT the short-lived
  // JWT from getToken() which expires in ~60 seconds and was causing every
  // restart to require re-authentication. Server-side code can read httpOnly
  // cookies; only client-side JS is blocked from accessing them.
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('__session')
  if (!sessionCookie?.value) {
    return '/onboard'
  }

  const deepLinkUrl = `agentcorp://auth-callback?token=${encodeURIComponent(sessionCookie.value)}&userId=${encodeURIComponent(authResult.userId)}&redirect=/workspace`
  return deepLinkUrl
}
