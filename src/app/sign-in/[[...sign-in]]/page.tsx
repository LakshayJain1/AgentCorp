import { redirect } from 'next/navigation';

// Bridge for old Electron builds that use Clerk-style /sign-in?redirect_url=...
// Forwards redirect_url → returnTo so Auth0 lands the user on the right page.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await searchParams;
  // Only same-site relative paths: reject absolute URLs, protocol-relative (//host) and backslash tricks.
  const safe = typeof redirect_url === 'string' && /^\/(?![/\\])/.test(redirect_url) && redirect_url.length < 512;
  const returnTo = safe ? (redirect_url as string) : '/workspace';
  redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
}
