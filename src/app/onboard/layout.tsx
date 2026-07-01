import { auth, clerkClient } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function OnboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session.userId) {
    return <>{children}</>
  }

  // Fetch user metadata directly from Clerk API rather than relying on JWT claims,
  // which may be stale if metadata was just updated via the server action.
  try {
    const client = await clerkClient()
    const user = await client.users.getUser(session.userId)
    if (user.publicMetadata?.onboardingComplete === true) {
      redirect('/workspace')
    }
  } catch {
    // If Clerk API is unavailable, fall back to JWT claims
    if (session.sessionClaims?.metadata?.onboardingComplete === true) {
      redirect('/workspace')
    }
  }

  return <>{children}</>
}
