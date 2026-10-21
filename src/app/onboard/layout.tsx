import { auth0 } from '@/lib/auth0';
import { redirect } from 'next/navigation';

export default async function OnboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth0.getSession();
  // Unauthenticated users see the onboard page (wizard handles sign-in step).
  // Authenticated users who have already completed onboarding (isInitialized in
  // Zustand) are redirected server-side only if we can detect it — but since
  // Zustand lives in localStorage we can't read it here. The workspace page
  // already handles the reverse redirect (/workspace → /onboard when not initialized).
  if (!session) {
    return <>{children}</>;
  }
  // If the user somehow lands on /onboard while authenticated and initialized,
  // the workspace page guards against that. Just render children.
  return <>{children}</>;
}
