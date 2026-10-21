import { redirect } from 'next/navigation';

// Bridge for old Electron builds that use Clerk-style /sign-in?redirect_url=...
// Forwards redirect_url → returnTo so Auth0 lands the user on the right page.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await searchParams;
  const returnTo = redirect_url || '/';
  redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
}
