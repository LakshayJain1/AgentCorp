import { redirect } from 'next/navigation';

// Legacy entry point (old desktop builds / bookmarks): sign-in now lives in
// onboarding as an email-code form.
export default function SignInPage() {
  redirect('/onboard');
}
